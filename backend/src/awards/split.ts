/**
 * Split a total in paise across holders by share percentage so that the parts
 * add up exactly to the total. Largest-remainder method: floor every share,
 * then give the leftover paise one at a time to the largest fractional parts.
 */
export function splitByShare<T extends { sharePct: number }>(totalPaise: bigint, holders: T[]): Array<T & { amountPaise: bigint }> {
  if (holders.length === 0) return [];
  const totalShare = holders.reduce((s, h) => s + h.sharePct, 0);
  if (totalShare <= 0) throw new RangeError('shares must be positive');

  // Work in millionths of a share for integer maths.
  const weights = holders.map((h) => BigInt(Math.round((h.sharePct / totalShare) * 1_000_000)));
  const weightSum = weights.reduce((a, b) => a + b, 0n);
  const raw = weights.map((w) => ({ floor: (totalPaise * w) / weightSum, rem: (totalPaise * w) % weightSum }));
  let leftover = totalPaise - raw.reduce((s, r) => s + r.floor, 0n);

  const order = raw.map((r, i) => ({ i, rem: r.rem })).sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : a.i - b.i));
  const amounts = raw.map((r) => r.floor);
  for (const { i } of order) {
    if (leftover <= 0n) break;
    amounts[i] += 1n;
    leftover -= 1n;
  }
  return holders.map((h, i) => ({ ...h, amountPaise: amounts[i] }));
}
