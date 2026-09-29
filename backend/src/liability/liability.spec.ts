import { parseIstDate } from '../common/dates';
import { formatInr, rupeesToPaise } from '../common/money';
import { additionalAccrued, AdditionalFact, liabilityAt, S80Fact, s80Daily, s80Interest, savingsIfActed } from './liability';

const R = { firstYearBp: 900, afterYearBp: 1500, basis: 365 };
const A = { bpPerYear: 1200, basis: 365 };
const d = parseIstDate;
const L = (n: number) => rupeesToPaise(n * 100_000); // lakh

describe('s.80 interest', () => {
  it.each([
    // [principal, possession, until, expected, why]
    [L(10), '2025-07-01', '2025-07-01', '₹0.00', 'same day'],
    [L(10), '2025-07-01', '2025-12-28', '₹44,383.56', '180 days at 9%: 10L × 9% × 180/365'],
    [L(10), '2025-07-01', '2026-07-01', '₹90,000.00', 'exactly one year at 9%'],
    [L(10), '2025-07-01', '2026-09-29', '₹1,26,986.30', '1 yr at 9% + 90 days at 15% (1,26,986.30)'],
    [L(1), '2024-02-29', '2025-02-28', '₹9,000.00', 'leap-day possession: anniversary clamps to 28 Feb'],
  ])('%s paise from %s to %s → %s (%s)', (p, from, to, expected) => {
    expect(formatInr(s80Interest(p as bigint, d(from as string), d(to as string), R))).toBe(expected);
  });

  it('daily accrual switches from 9% to 15% on the first anniversary of possession', () => {
    expect(formatInr(s80Daily(L(10), d('2025-07-01'), d('2026-06-30'), R))).toBe('₹246.58'); // 10L × 9% / 365
    expect(formatInr(s80Daily(L(10), d('2025-07-01'), d('2026-07-01'), R))).toBe('₹410.96'); // 10L × 15% / 365
  });
});

describe('s.30(3) additional amount', () => {
  it('12% p.a. on ₹20 lakh market value for 73 days is ₹48,000', () => {
    expect(formatInr(additionalAccrued(L(20), d('2026-01-01'), d('2026-03-15'), A))).toBe('₹48,000.00');
  });
});

describe('liabilityAt and savings', () => {
  const s80: S80Fact = { kind: 's80', compensationId: 'c1', parcelId: 'p1', beneficiary: 'X', principalPaise: L(10), possessionOn: d('2025-07-01'), paidOn: null, rates: R };
  const paid: S80Fact = { ...s80, compensationId: 'c2', paidOn: d('2025-10-01') };
  const pending: AdditionalFact = { kind: 'additional', parcelId: 'p2', marketValuePaise: L(20), startOn: d('2025-05-12'), stopOn: null, rate: A };
  const awarded: AdditionalFact = { ...pending, parcelId: 'p3', stopOn: d('2026-01-01') };

  it('counts only lines unpaid and awards still pending on the date', () => {
    const at = liabilityAt([s80, paid], [pending, awarded], d('2026-09-29'));
    expect(formatInr(at.s80OutstandingPaise)).toBe('₹1,26,986.30');
    expect(formatInr(at.s80DailyPaise)).toBe('₹410.96');
    // 20L × 12% × 505 days / 365 = 3,32,054.79
    expect(formatInr(at.additionalAccruedPaise)).toBe('₹3,32,054.79');
    expect(formatInr(at.additionalDailyPaise)).toBe('₹657.53');
  });

  it('before possession nothing accrues under s.80', () => {
    expect(liabilityAt([s80], [], d('2025-06-30')).s80OutstandingPaise).toBe(0n);
  });

  it('paying a 15%-stage line now saves a full year of 15% interest: 10L × 15% = ₹1,50,000', () => {
    expect(formatInr(savingsIfActed(s80, d('2026-10-06'), 365))).toBe('₹1,50,000.00');
  });

  it('declaring a pending award now avoids 12% p.a. on its market value for the horizon', () => {
    expect(formatInr(savingsIfActed(pending, d('2026-10-06'), 90))).toBe('₹59,178.08'); // 20L × 12% × 90/365
  });
});
