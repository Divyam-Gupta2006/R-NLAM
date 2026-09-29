/**
 * Money helpers. All amounts are integer paise (BigInt). Rates and percentages
 * are expressed in basis points (1 bp = 0.01%) so arithmetic stays integral.
 */

export const PAISE_PER_RUPEE = 100n;

export function rupeesToPaise(rupees: number | string): bigint {
  // Parse via string to avoid binary float error on values like 0.29.
  const s = typeof rupees === 'number' ? rupees.toFixed(2) : rupees.trim();
  const neg = s.startsWith('-');
  const [whole, frac = ''] = (neg ? s.slice(1) : s).split('.');
  const paise = BigInt(whole || '0') * 100n + BigInt((frac + '00').slice(0, 2));
  return neg ? -paise : paise;
}

/** Round-half-up integer division for non-negative operands. */
export function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('denominator must be positive');
  if (numerator < 0n) return -divRound(-numerator, denominator);
  return (numerator * 2n + denominator) / (2n * denominator);
}

/** amount × bp / 10 000, rounded to the nearest paisa. */
export function applyBasisPoints(amountPaise: bigint, bp: bigint | number): bigint {
  return divRound(amountPaise * BigInt(bp), 10_000n);
}

/** Format paise as Indian-grouped rupees, e.g. 123456789n → "₹12,34,567.89". */
export function formatInr(paise: bigint): string {
  const neg = paise < 0n;
  const abs = neg ? -paise : paise;
  const rupees = abs / 100n;
  const p = (abs % 100n).toString().padStart(2, '0');
  const r = rupees.toString();
  const last3 = r.slice(-3);
  const rest = r.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}₹${rest ? rest + ',' : ''}${last3}.${p}`;
}

/**
 * JSON encoding for BigInt: a number when it is exactly representable
 * (every realistic paise amount, up to ~₹90 lakh crore), otherwise a string.
 */
export function installBigIntJson(): void {
  const proto = BigInt.prototype as unknown as { toJSON?: () => number | string };
  if (proto.toJSON) return;
  proto.toJSON = function (this: bigint) {
    const n = Number(this);
    return Number.isSafeInteger(n) ? n : this.toString();
  };
}
