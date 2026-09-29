import { parseIstDate } from '../common/dates';
import { formatInr, rupeesToPaise } from '../common/money';
import { AwardRules, calculateAward } from './award-calculator';

const RFCTLARR: AwardRules = {
  multiplierHundredths: 200,
  multiplierCitation: 'First Schedule',
  solatiumBp: 10_000,
  solatiumCitation: 's.30(1)',
  additionalBpPerYear: 1_200,
  additionalCitation: 's.30(3)',
  dayCountBasis: 365,
};

describe('calculateAward', () => {
  it('1.5 ha at ₹10,00,000/ha, ×2.00, ₹2,00,000 assets, 365 days after s.11 → total ₹65,80,000', () => {
    const b = calculateAward(
      {
        areaHa: 1.5,
        marketRatePaisePerHa: rupeesToPaise(1_000_000),
        assetsValuePaise: rupeesToPaise(200_000),
        additionalFrom: parseIstDate('2025-06-10'),
        cutoffDate: parseIstDate('2026-06-10'),
      },
      RFCTLARR,
    );
    expect(formatInr(b.marketValuePaise)).toBe('₹15,00,000.00');
    expect(formatInr(b.multipliedValuePaise)).toBe('₹30,00,000.00');
    expect(formatInr(b.compensationPaise)).toBe('₹32,00,000.00');
    expect(formatInr(b.solatiumPaise)).toBe('₹32,00,000.00'); // 100% of compensation
    expect(b.additionalDays).toBe(365);
    expect(formatInr(b.additionalAmountPaise)).toBe('₹1,80,000.00'); // 12% of MV for one year
    expect(formatInr(b.totalPaise)).toBe('₹65,80,000.00');
    expect(b.lines.map((l) => l.key)).toEqual(['marketValue', 'multipliedValue', 'assets', 'compensation', 'solatium', 'additional', 'total']);
  });

  it.each([
    // [area ha, rate ₹/ha, multiplier, days, expected additional ₹, expected total ₹]
    [1, 1_000_000, 100, 0, '₹0.00', '₹20,00,000.00'], // urban (×1), award on the s.11 date
    [1, 1_000_000, 100, 73, '₹24,000.00', '₹20,24,000.00'], // 73/365 = 0.2 yr → 12% × 0.2 × 10L
    [0.75, 800_000, 150, 180, '₹35,506.85', '₹18,35,506.85'], // MV 6L; ×1.5 = 9L; solatium 9L; addl 6L×12%×180/365
    [2.25, 1_250_000, 200, 400, '₹3,69,863.01', '₹1,16,19,863.01'], // MV 28.125L; ×2 = 56.25L; +56.25L; addl 28.125L×12%×400/365
  ])('%s ha at ₹%s/ha, factor %s, %s days → additional %s, total %s', (area, rate, mult, days, addl, total) => {
    const sec11 = parseIstDate('2025-01-01');
    const cutoff = new Date(sec11.getTime() + Number(days) * 86_400_000);
    const b = calculateAward(
      { areaHa: Number(area), marketRatePaisePerHa: rupeesToPaise(Number(rate)), assetsValuePaise: 0n, additionalFrom: sec11, cutoffDate: cutoff },
      { ...RFCTLARR, multiplierHundredths: Number(mult) },
    );
    expect(b.additionalDays).toBe(days);
    expect(formatInr(b.additionalAmountPaise)).toBe(addl);
    expect(formatInr(b.totalPaise)).toBe(total);
  });

  it('components always add up to the total, to the paisa', () => {
    const b = calculateAward(
      { areaHa: 0.333, marketRatePaisePerHa: rupeesToPaise(987_654.32), assetsValuePaise: rupeesToPaise(12_345.67), additionalFrom: parseIstDate('2025-02-03'), cutoffDate: parseIstDate('2026-03-17') },
      { ...RFCTLARR, multiplierHundredths: 137 },
    );
    expect(b.multipliedValuePaise + b.assetsValuePaise + b.solatiumPaise + b.additionalAmountPaise).toBe(b.totalPaise);
  });

  it('rejects a cutoff before the s.11 notification', () => {
    expect(() =>
      calculateAward(
        { areaHa: 1, marketRatePaisePerHa: 100n, assetsValuePaise: 0n, additionalFrom: parseIstDate('2026-01-02'), cutoffDate: parseIstDate('2026-01-01') },
        RFCTLARR,
      ),
    ).toThrow(RangeError);
  });
});
