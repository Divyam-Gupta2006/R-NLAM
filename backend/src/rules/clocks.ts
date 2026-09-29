/**
 * Statutory clocks for one parcel, as a pure function of its dated facts and
 * the rules in force when each clock started.
 */
import { addDays, addMonths } from '../common/dates';
import { Resolution, ruleValue } from './resolve';

export type ClockKind = 'OBJECTION_WINDOW' | 'DECLARATION_DEADLINE' | 'AWARD_DEADLINE' | 'PAYMENT_DEADLINE' | 'RR_MONETARY_DEADLINE';
export type ClockStatus = 'RUNNING' | 'MET' | 'MISSED';

export interface ParcelFacts {
  stage: string;
  sec11?: { date: Date; noticeId: string };
  sec19?: { date: Date; noticeId: string };
  awardDate?: Date;
  /** Date the last beneficiary was paid, when everyone is paid. */
  allPaidOn?: Date | null;
  hasCompensation: boolean;
  hasMonetaryRR: boolean;
  /** Date the last monetary R&R grant was delivered, when all are delivered. */
  allMonetaryRRDeliveredOn?: Date | null;
  /** Days excluded for court stays (s.19(7) first proviso). */
  excludedDays?: number;
}

export interface ComputedClock {
  kind: ClockKind;
  noticeId: string | null;
  startsOn: Date;
  dueOn: Date;
  status: ClockStatus;
  metOn: Date | null;
  excludedDays: number;
  ruleKey: string;
  packCode: string;
  citation: string;
  consequence: string;
  unverified: boolean;
}

/** `rulesAt(date)` gives the resolution in force on a date (each clock uses its own start date). */
export function computeClocks(f: ParcelFacts, rulesAt: (d: Date) => Resolution, now: Date): ComputedClock[] {
  if (f.stage === 'WITHDRAWN') return [];
  const out: ComputedClock[] = [];
  const excluded = f.excludedDays ?? 0;

  const settle = (dueOn: Date, doneOn: Date | null | undefined): { status: ClockStatus; metOn: Date | null } => {
    if (doneOn) return { status: doneOn <= dueOn ? 'MET' : 'MISSED', metOn: doneOn };
    return { status: now > dueOn ? 'MISSED' : 'RUNNING', metOn: null };
  };

  if (f.sec11) {
    const r = rulesAt(f.sec11.date);
    const obj = ruleValue<number>(r, 'deadline.objection.days');
    const objDue = addDays(f.sec11.date, obj.value);
    out.push({
      kind: 'OBJECTION_WINDOW',
      noticeId: f.sec11.noticeId,
      startsOn: f.sec11.date,
      dueOn: objDue,
      // A window, not a duty: it simply closes.
      status: now > objDue ? 'MET' : 'RUNNING',
      metOn: now > objDue ? objDue : null,
      excludedDays: 0,
      ruleKey: obj.rule.key,
      packCode: obj.rule.packCode,
      citation: obj.rule.citation,
      consequence: 'Objections filed after this date are out of time.',
      unverified: obj.rule.unverified,
    });

    const decl = ruleValue<number>(r, 'deadline.declaration.months');
    const declDue = addDays(addMonths(f.sec11.date, decl.value), excluded);
    out.push({
      kind: 'DECLARATION_DEADLINE',
      noticeId: f.sec11.noticeId,
      startsOn: f.sec11.date,
      dueOn: declDue,
      ...settle(declDue, f.sec19?.date),
      excludedDays: excluded,
      ruleKey: decl.rule.key,
      packCode: decl.rule.packCode,
      citation: decl.rule.citation,
      consequence: 'Without a s.19 declaration by this date the preliminary notification is deemed rescinded, unless the Government extends the period in writing.',
      unverified: decl.rule.unverified,
    });
  }

  if (f.sec19) {
    const r = rulesAt(f.sec19.date);
    const aw = ruleValue<number>(r, 'deadline.award.months');
    const awDue = addDays(addMonths(f.sec19.date, aw.value), excluded);
    out.push({
      kind: 'AWARD_DEADLINE',
      noticeId: f.sec19.noticeId,
      startsOn: f.sec19.date,
      dueOn: awDue,
      ...settle(awDue, f.awardDate),
      excludedDays: excluded,
      ruleKey: aw.rule.key,
      packCode: aw.rule.packCode,
      citation: aw.rule.citation,
      consequence: 'Without an award by this date the entire acquisition proceedings lapse, unless the Government extends the period in writing.',
      unverified: aw.rule.unverified,
    });
  }

  if (f.awardDate && f.hasCompensation) {
    const r = rulesAt(f.awardDate);
    const pay = ruleValue<number>(r, 'deadline.payment.months');
    const payDue = addMonths(f.awardDate, pay.value);
    out.push({
      kind: 'PAYMENT_DEADLINE',
      noticeId: null,
      startsOn: f.awardDate,
      dueOn: payDue,
      ...settle(payDue, f.allPaidOn),
      excludedDays: 0,
      ruleKey: pay.rule.key,
      packCode: pay.rule.packCode,
      citation: pay.rule.citation,
      consequence: 'Compensation should be paid or tendered within three months of the award; possession cannot be taken until it is.',
      unverified: pay.rule.unverified,
    });
  }

  if (f.awardDate && f.hasMonetaryRR) {
    const r = rulesAt(f.awardDate);
    const rr = ruleValue<number>(r, 'deadline.rr_monetary.months');
    const rrDue = addMonths(f.awardDate, rr.value);
    out.push({
      kind: 'RR_MONETARY_DEADLINE',
      noticeId: null,
      startsOn: f.awardDate,
      dueOn: rrDue,
      ...settle(rrDue, f.allMonetaryRRDeliveredOn),
      excludedDays: 0,
      ruleKey: rr.rule.key,
      packCode: rr.rule.packCode,
      citation: rr.rule.citation,
      consequence: 'Monetary R&R entitlements should be paid within six months of the award; possession waits for them.',
      unverified: rr.rule.unverified,
    });
  }
  return out;
}
