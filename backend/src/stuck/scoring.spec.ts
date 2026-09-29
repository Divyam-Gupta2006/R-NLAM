import { familiesComponent, moneyComponent, score, statutoryRisk } from './scoring';

describe('statutoryRisk', () => {
  it.each([
    // [daysToDeadline, accruing, legalBar, expected value]
    [-5, false, false, 1],
    [0, false, false, 0.95],
    [7, false, false, 0.95],
    [8, false, false, 0.8],
    [30, false, false, 0.8],
    [37, false, false, 0.6], // Dhanora s.19 declaration on 29 Sep 2026
    [60, false, false, 0.6],
    [120, false, false, 0.4],
    [290, false, false, 0.25],
    [null, false, false, 0.2],
    [290, true, false, 0.9], // interest running outranks a distant deadline
    [null, false, true, 0.5], // missing consent is a legal bar
    [-1, false, true, 1], // missed wins over the bar floor
  ])('deadline %s days, accruing=%s, legalBar=%s → %s', (d, accruing, legalBar, expected) => {
    expect(statutoryRisk({ daysToDeadline: d as number | null, accruing: accruing as boolean, legalBar: legalBar as boolean }).value).toBe(expected);
  });

  it.each([
    // [deadline days, lead time, expected]: risk is judged on the slack left after the lead time
    [289, 270, 0.8], // forest clearance vs a 289-day award deadline: 19 days of slack
    [289, 0, 0.25],
    [37, 30, 0.95], // hearings needed before a 37-day declaration deadline
    [100, 270, 0.97], // cannot be cleared in time
    [-3, 270, 1], // missed is missed
  ])('deadline %s days with %s days lead time → %s', (d, lead, expected) => {
    expect(statutoryRisk({ daysToDeadline: d, leadTimeDays: lead, accruing: false, legalBar: false }).value).toBe(expected);
  });

  it('explains itself', () => {
    expect(statutoryRisk({ daysToDeadline: 37, accruing: false, legalBar: false }).why).toBe('Statutory deadline in 37 days (T-60)');
  });
});

describe('moneyComponent (log-scaled, floored)', () => {
  const crore = 100_00_000_00n; // ₹1 crore in paise
  it.each([
    [0n, crore, 0.1],
    [crore, crore, 1],
    [crore / 100n, crore, 0.743], // ₹1 lakh vs ₹1 crore: log ratio 5/7 = 0.714 → 0.1 + 0.9 × 0.714
    [crore / 10n, crore, 0.871], // ₹10 lakh: 6/7 = 0.857
  ])('%s paise vs max %s → %s', (x, max, expected) => {
    expect(moneyComponent(x as bigint, max as bigint).value).toBeCloseTo(expected as number, 3);
  });
});

describe('familiesComponent', () => {
  it.each([
    [0, 4, 0.1],
    [4, 4, 1],
    [1, 4, 0.55], // √(1/4) = 0.5 → 0.1 + 0.9 × 0.5
    [3, 0, 0.1],
  ])('%s of %s families → %s', (f, max, expected) => {
    expect(familiesComponent(f, max).value).toBeCloseTo(expected, 3);
  });
});

describe('score', () => {
  it('forest-blocked parcel: legal bar 0.9 (accruing) × ₹ 0.93 × 3/4 families 0.775 → 64.9', () => {
    const s = score({ value: 0.9, why: '' }, { value: 0.93, why: '' }, { value: 0.775, why: '' }, null);
    expect(s.raw).toBeCloseTo(0.649, 3);
    expect(s.priority).toBe(64.9);
  });

  it('a disputed brief is halved and says why', () => {
    const s = score({ value: 1, why: '' }, { value: 1, why: '' }, { value: 1, why: '' }, 'DISPUTED');
    expect(s.priority).toBe(50);
    expect(s.adjustment?.why).toMatch(/Disputed/);
  });

  it('an accepted brief keeps its score', () => {
    expect(score({ value: 0.6, why: '' }, { value: 0.5, why: '' }, { value: 0.5, why: '' }, 'ACCEPTED').priority).toBe(15);
  });
});
