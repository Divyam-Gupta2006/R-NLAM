import { splitByShare } from './split';

describe('splitByShare', () => {
  it.each([
    // [total paise, shares, expected parts]
    [100n, [50, 50], [50n, 50n]],
    [101n, [50, 50], [51n, 50n]], // the odd paisa goes to the first of equal remainders
    [100n, [33.34, 33.33, 33.33], [34n, 33n, 33n]],
    [1_000_000n, [40, 30, 30], [400_000n, 300_000n, 300_000n]],
    [7n, [1, 1, 1], [3n, 2n, 2n]],
    [6_580_000_00n, [60, 40], [3_948_000_00n, 2_632_000_00n]], // ₹65.8 lakh award split 60:40
  ])('%p paise split %p → %p', (total, shares, expected) => {
    const parts = splitByShare(total as bigint, (shares as number[]).map((sharePct) => ({ sharePct })));
    expect(parts.map((p) => p.amountPaise)).toEqual(expected);
    expect(parts.reduce((s, p) => s + p.amountPaise, 0n)).toBe(total);
  });

  it('normalises shares that do not add up to 100', () => {
    const parts = splitByShare(300n, [{ sharePct: 1 }, { sharePct: 2 }]);
    expect(parts.map((p) => p.amountPaise)).toEqual([100n, 200n]);
  });

  it('returns nothing for no holders', () => {
    expect(splitByShare(100n, [])).toEqual([]);
  });
});
