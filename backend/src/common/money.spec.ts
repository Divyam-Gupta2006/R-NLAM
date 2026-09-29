import { applyBasisPoints, divRound, formatInr, rupeesToPaise } from './money';

describe('money', () => {
  it.each([
    [0, 0n],
    [1, 100n],
    [0.29, 29n], // the float trap: 0.29 * 100 = 28.999…
    [1234567.89, 123456789n],
    ['12.5', 1250n],
    ['-3.07', -307n],
  ])('rupeesToPaise(%s) = %s', (rupees, paise) => {
    expect(rupeesToPaise(rupees)).toBe(paise);
  });

  it.each([
    [10n, 3n, 3n],
    [11n, 2n, 6n], // 5.5 rounds half up
    [-11n, 2n, -6n],
    [0n, 7n, 0n],
  ])('divRound(%s, %s) = %s', (n, d, q) => {
    expect(divRound(n, d)).toBe(q);
  });

  it('applyBasisPoints: 12% of ₹1,00,000 is ₹12,000', () => {
    expect(applyBasisPoints(rupeesToPaise(100_000), 1200)).toBe(rupeesToPaise(12_000));
  });

  it.each([
    [0n, '₹0.00'],
    [5n, '₹0.05'],
    [123456789n, '₹12,34,567.89'],
    [100000000000n, '₹1,00,00,00,000.00'], // one hundred crore
    [-150n, '-₹1.50'],
  ])('formatInr(%s) = %s', (paise, s) => {
    expect(formatInr(paise)).toBe(s);
  });
});
