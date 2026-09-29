/**
 * Statutory cost of delay, as pure functions of dated facts. Two liabilities
 * accrue under RFCTLARR 2013, and they are reported separately:
 *
 * 1. s.80 interest on compensation not paid on or before possession: 9% p.a.
 *    from possession until paid; 15% p.a. once a year has passed since
 *    possession (proviso). Arises when possession precedes payment (s.40
 *    urgency).
 * 2. s.30(3) additional amount: 12% p.a. on market value from the s.4(2) SIA
 *    notification until the award or possession, whichever is earlier. Every
 *    day an award is delayed adds to what the award must pay.
 *
 * A payment that is late after the award but before possession carries no
 * statutory interest; it is reported as overdue, never as accruing interest.
 * Money is integer paise; rates are basis points.
 */
import { addDays, addMonths, daysBetween } from '../common/dates';
import { divRound } from '../common/money';

export interface InterestRates {
  firstYearBp: number; // 900
  afterYearBp: number; // 1500
  basis: number; // 365
}

export interface AdditionalRate {
  bpPerYear: number; // 1200
  basis: number;
}

/** Unrounded numerator of s.80 interest: principal × (bp₁·days₁ + bp₂·days₂). */
function s80Numerator(principalPaise: bigint, possession: Date, until: Date, r: InterestRates): bigint {
  if (until <= possession || principalPaise <= 0n) return 0n;
  const anniversary = addMonths(possession, 12);
  const firstEnd = until < anniversary ? until : anniversary;
  const d1 = BigInt(Math.max(0, daysBetween(possession, firstEnd)));
  const d2 = BigInt(Math.max(0, until > anniversary ? daysBetween(anniversary, until) : 0));
  return principalPaise * (BigInt(r.firstYearBp) * d1 + BigInt(r.afterYearBp) * d2);
}

/** s.80 interest on `principal` from `possession` up to `until`, rounded once to the paisa. */
export function s80Interest(principalPaise: bigint, possession: Date, until: Date, r: InterestRates): bigint {
  return divRound(s80Numerator(principalPaise, possession, until, r), 10_000n * BigInt(r.basis));
}

/** Interest accruing per day on `on`: 9% or 15% p.a. depending on the anniversary. */
export function s80DailyRateBp(possession: Date, on: Date, r: InterestRates): number {
  if (on < possession) return 0;
  return on >= addMonths(possession, 12) ? r.afterYearBp : r.firstYearBp;
}

export function s80Daily(principalPaise: bigint, possession: Date, on: Date, r: InterestRates): bigint {
  return divRound(principalPaise * BigInt(s80DailyRateBp(possession, on, r)), 10_000n * BigInt(r.basis));
}

/** s.30(3) additional amount accrued on market value from `from` to `until`. */
export function additionalAccrued(marketValuePaise: bigint, from: Date, until: Date, r: AdditionalRate): bigint {
  const days = BigInt(Math.max(0, daysBetween(from, until)));
  return divRound(marketValuePaise * BigInt(r.bpPerYear) * days, 10_000n * BigInt(r.basis));
}

export function additionalDaily(marketValuePaise: bigint, r: AdditionalRate): bigint {
  return divRound(marketValuePaise * BigInt(r.bpPerYear), 10_000n * BigInt(r.basis));
}

/* ------------------------------------------------------------------ facts */

/** One compensation line that was unpaid when possession was taken. */
export interface S80Fact {
  kind: 's80';
  compensationId: string;
  parcelId: string;
  beneficiary: string;
  principalPaise: bigint;
  possessionOn: Date;
  paidOn: Date | null;
  rates: InterestRates;
}

/** One parcel whose award is pending while the s.30(3) additional amount runs. */
export interface AdditionalFact {
  kind: 'additional';
  parcelId: string;
  marketValuePaise: bigint;
  startOn: Date; // s.4(2) SIA notification (s.11 if exempted)
  stopOn: Date | null; // award or possession, whichever came first
  rate: AdditionalRate;
}

export interface LiabilityAt {
  s80OutstandingPaise: bigint; // accrued on lines still unpaid at the date
  s80DailyPaise: bigint;
  additionalAccruedPaise: bigint; // accrued on awards still pending at the date
  additionalDailyPaise: bigint;
}

/** Liability as it stood on `on`, from the facts. */
export function liabilityAt(s80: S80Fact[], additional: AdditionalFact[], on: Date): LiabilityAt {
  let s80Out = 0n;
  let s80Day = 0n;
  for (const f of s80) {
    if (f.possessionOn > on) continue;
    if (f.paidOn && f.paidOn <= on) continue;
    s80Out += s80Interest(f.principalPaise, f.possessionOn, on, f.rates);
    s80Day += s80Daily(f.principalPaise, f.possessionOn, on, f.rates);
  }
  let addOut = 0n;
  let addDay = 0n;
  for (const f of additional) {
    if (f.startOn > on) continue;
    if (f.stopOn && f.stopOn <= on) continue;
    addOut += additionalAccrued(f.marketValuePaise, f.startOn, on, f.rate);
    addDay += additionalDaily(f.marketValuePaise, f.rate);
  }
  return { s80OutstandingPaise: s80Out, s80DailyPaise: s80Day, additionalAccruedPaise: addOut, additionalDailyPaise: addDay };
}

/**
 * Money avoided by acting on `actOn` instead of staying on the current path for
 * `horizonDays`: for an s.80 line, the interest that would accrue between
 * `actOn` and `actOn + horizon`; for a pending award, the additional amount
 * over the same window.
 */
export function savingsIfActed(f: S80Fact | AdditionalFact, actOn: Date, horizonDays: number): bigint {
  const end = addDays(actOn, horizonDays);
  // Round once over the window, not as a difference of two rounded totals.
  if (f.kind === 's80') {
    const num = s80Numerator(f.principalPaise, f.possessionOn, end, f.rates) - s80Numerator(f.principalPaise, f.possessionOn, actOn, f.rates);
    return divRound(num, 10_000n * BigInt(f.rates.basis));
  }
  const from = actOn > f.startOn ? actOn : f.startOn;
  return additionalAccrued(f.marketValuePaise, from, end, f.rate);
}
