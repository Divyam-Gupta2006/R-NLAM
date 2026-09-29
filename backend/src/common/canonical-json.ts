/**
 * Deterministic JSON: object keys sorted recursively, BigInt as decimal string,
 * Dates as ISO-8601 UTC, undefined dropped. Used wherever a hash must be
 * recomputable byte-for-byte (audit chain, evidence bundles, Merkle leaves).
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalise(value));
}

function normalise(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === 'object') {
    // Prisma Decimal and similar expose toJSON; honour it before walking keys.
    const maybe = value as { toJSON?: () => unknown };
    if (typeof maybe.toJSON === 'function' && !(value.constructor === Object)) {
      return normalise(maybe.toJSON());
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = normalise(v);
    }
    return out;
  }
  return value;
}
