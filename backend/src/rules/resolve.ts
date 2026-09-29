/**
 * Which rules apply to a case: pure functions, no database.
 *
 * For an act, a state and a date, take the ACTIVE central pack in force on that
 * date and the ACTIVE state pack in force on that date (highest version wins if
 * several overlap), then overlay the state pack's entries on the central
 * pack's, key by key. A case is therefore judged by the rules in force on its
 * own event date, not today's.
 */

export interface PackLike {
  code: string;
  actCode: string;
  stateCode: string | null;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  effectiveFrom: Date;
  effectiveTo: Date | null;
  entries: EntryLike[];
}

export interface EntryLike {
  key: string;
  category: string;
  label: string;
  value: unknown;
  unit?: string | null;
  citation: string;
  quote?: string | null;
  unverified: boolean;
  note?: string | null;
}

export interface ResolvedRule extends EntryLike {
  packCode: string;
  /** true when the value comes from the state pack, overriding the central one */
  stateOverride: boolean;
}

export interface Resolution {
  actCode: string;
  stateCode: string;
  onDate: Date;
  centralPack: string | null;
  statePack: string | null;
  rules: Record<string, ResolvedRule>;
}

export function inForce(p: PackLike, on: Date): boolean {
  return p.status === 'ACTIVE' && p.effectiveFrom <= on && (p.effectiveTo === null || on < p.effectiveTo);
}

function pick(packs: PackLike[]): PackLike | null {
  return packs.sort((a, b) => b.version - a.version || +b.effectiveFrom - +a.effectiveFrom)[0] ?? null;
}

export function resolveRules(packs: PackLike[], actCode: string, stateCode: string, on: Date): Resolution {
  const forAct = packs.filter((p) => p.actCode === actCode && inForce(p, on));
  const central = pick(forAct.filter((p) => p.stateCode === null));
  const state = pick(forAct.filter((p) => p.stateCode === stateCode));

  const rules: Record<string, ResolvedRule> = {};
  for (const e of central?.entries ?? []) rules[e.key] = { ...e, packCode: central!.code, stateOverride: false };
  for (const e of state?.entries ?? []) rules[e.key] = { ...e, packCode: state!.code, stateOverride: true };

  return { actCode, stateCode, onDate: on, centralPack: central?.code ?? null, statePack: state?.code ?? null, rules };
}

export class MissingRuleError extends Error {
  constructor(
    public readonly key: string,
    public readonly resolution: Resolution,
  ) {
    super(`No rule '${key}' in force for ${resolution.actCode} in ${resolution.stateCode} on ${resolution.onDate.toISOString().slice(0, 10)}`);
  }
}

export function ruleValue<T>(r: Resolution, key: string): { value: T; rule: ResolvedRule } {
  const rule = r.rules[key];
  if (!rule) throw new MissingRuleError(key, r);
  return { value: rule.value as T, rule };
}

/** First Schedule multiplier (hundredths) for a parcel, from the resolved bands. */
export function multiplierFor(r: Resolution, isRural: boolean, distanceKm: number | null): { hundredths: number; rule: ResolvedRule } {
  if (!isRural) {
    const { value, rule } = ruleValue<number>(r, 'money.multiplier.urban');
    return { hundredths: Math.round(value * 100), rule };
  }
  const { value, rule } = ruleValue<{ range: [number, number]; bands: Array<{ maxKm: number | null; factor: number }> }>(r, 'money.multiplier.rural');
  const km = distanceKm ?? 0;
  const band = value.bands.find((b) => b.maxKm === null || km <= b.maxKm) ?? value.bands[value.bands.length - 1];
  const factor = Math.min(value.range[1], Math.max(value.range[0], band.factor));
  return { hundredths: Math.round(factor * 100), rule };
}
