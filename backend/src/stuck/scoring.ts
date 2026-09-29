/**
 * "Why is this project stuck?": scoring as pure, explainable functions.
 *
 *   priority = statutoryRisk × money × families        (each in [0, 1])
 *
 * - statutoryRisk: how close the governing legal deadline is (or that money is
 *   already being lost), from a fixed table that is shown to the officer.
 * - money: log-scaled ₹ exposure relative to the largest in the set, so one
 *   large award does not flatten everything else; floored at 0.1 so a
 *   zero-rupee blocker (e.g. a missing consent) still ranks.
 * - families: affected families relative to the largest in the set, also
 *   floored at 0.1.
 *
 * Officer feedback adjusts the result transparently: a disputed brief is
 * halved (and says so), an accepted one keeps its score and shows its owner.
 */

export type BottleneckType =
  | 'GIS_BLOCK'
  | 'DECLARATION_AT_RISK'
  | 'OBJECTIONS_PENDING'
  | 'AWARD_AT_RISK'
  | 'PAYMENT_OVERDUE'
  | 'INTEREST_RUNNING'
  | 'RR_BLOCKING_POSSESSION'
  | 'PAYMENT_HELD'
  | 'PAYMENT_FAILED'
  | 'LITIGATION';

export interface RiskInput {
  /** Days to the governing deadline; negative = missed; null = none. */
  daysToDeadline: number | null;
  /** Typical days needed to clear the blocker (planning assumption); risk uses deadline − lead time. */
  leadTimeDays?: number;
  leadTimeWhy?: string;
  /** Money is being lost every day (s.80 interest, s.30(3) accrual). */
  accruing: boolean;
  /** A legal bar, not a delay (e.g. consent missing): at least moderate risk. */
  legalBar: boolean;
}

export interface Component {
  value: number; // 0..1
  why: string;
}

export function statutoryRisk(r: RiskInput): Component {
  const lead = r.leadTimeDays ?? 0;
  const d = r.daysToDeadline === null ? null : r.daysToDeadline < 0 ? r.daysToDeadline : r.daysToDeadline - lead;
  const slack = (x: number) => (lead ? `${x} days of slack (deadline in ${r.daysToDeadline} days − ${lead} days ${r.leadTimeWhy ?? 'lead time'})` : `Statutory deadline in ${x} days`);
  let value = 0.2;
  let why = 'No statutory deadline in sight';
  if (d !== null) {
    if (r.daysToDeadline !== null && r.daysToDeadline < 0) [value, why] = [1, `Statutory deadline missed ${-r.daysToDeadline} days ago`];
    else if (d < 0) [value, why] = [0.97, `Cannot be cleared in time: ${slack(d)}`];
    else if (d <= 7) [value, why] = [0.95, `${slack(d)} (T-7)`];
    else if (d <= 30) [value, why] = [0.8, `${slack(d)} (T-30)`];
    else if (d <= 60) [value, why] = [0.6, `${slack(d)} (T-60)`];
    else if (d <= 180) [value, why] = [0.4, slack(d)];
    else [value, why] = [0.25, slack(d)];
  }
  if (r.accruing && value < 0.9) [value, why] = [0.9, `${why}; money is being lost every day`];
  if (r.legalBar && value < 0.5) [value, why] = [0.5, `${why}; a legal bar blocks progress`];
  return { value, why };
}

export function moneyComponent(exposurePaise: bigint, maxPaise: bigint): Component {
  if (maxPaise <= 0n || exposurePaise <= 0n) return { value: 0.1, why: 'No direct ₹ exposure (floor 0.1)' };
  const rupees = Number(exposurePaise) / 100;
  const maxRupees = Number(maxPaise) / 100;
  const raw = Math.log10(1 + rupees) / Math.log10(1 + maxRupees);
  const value = 0.1 + 0.9 * Math.min(1, raw);
  return { value: round3(value), why: `log-scaled against the largest exposure in view (${round3(raw)} → ${round3(value)} after the 0.1 floor)` };
}

/** Square-root scaled so that large groups lead without flattening single parcels. */
export function familiesComponent(families: number, maxFamilies: number): Component {
  if (maxFamilies <= 0 || families <= 0) return { value: 0.1, why: 'No families directly affected (floor 0.1)' };
  const raw = Math.sqrt(families / maxFamilies);
  const value = 0.1 + 0.9 * Math.min(1, raw);
  return { value: round3(value), why: `${families} families; √(${families}/${maxFamilies}) against the largest group in view` };
}

export type Decision = 'ACCEPTED' | 'DISPUTED' | null;

export interface Score {
  risk: Component;
  money: Component;
  families: Component;
  raw: number; // product, 0..1
  adjustment: { factor: number; why: string } | null;
  priority: number; // 0..100
}

export const DISPUTE_FACTOR = 0.5;

export function score(risk: Component, money: Component, families: Component, decision: Decision): Score {
  const raw = risk.value * money.value * families.value;
  const adjustment = decision === 'DISPUTED' ? { factor: DISPUTE_FACTOR, why: 'Disputed by an officer: halved until re-examined' } : null;
  const priority = Math.round(raw * (adjustment?.factor ?? 1) * 1000) / 10;
  return { risk, money, families, raw: round3(raw), adjustment, priority };
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
