import { addMonths, daysBetween, istDateString, parseIstDate } from './dates';

describe('dates (IST calendar)', () => {
  it.each([
    ['2025-06-10', '2026-06-10', 365],
    ['2024-02-28', '2024-03-01', 2], // leap year
    ['2026-01-01', '2025-12-31', -1],
  ])('daysBetween(%s, %s) = %s', (a, b, n) => {
    expect(daysBetween(parseIstDate(a), parseIstDate(b))).toBe(n);
  });

  it('counts IST days: 23:30 IST and 00:30 IST next day are one day apart', () => {
    const late = new Date('2026-03-01T18:00:00Z'); // 23:30 IST on 1 Mar
    const early = new Date('2026-03-01T19:00:00Z'); // 00:30 IST on 2 Mar
    expect(daysBetween(late, early)).toBe(1);
  });

  it.each([
    ['2025-06-10', 12, '2026-06-10'], // s.19 window
    ['2026-01-31', 1, '2026-02-28'], // clamps to month end
    ['2024-02-29', 12, '2025-02-28'],
  ])('addMonths(%s, %s) = %s', (d, m, out) => {
    expect(istDateString(addMonths(parseIstDate(d), m))).toBe(out);
  });
});
