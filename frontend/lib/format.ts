/**
 * Display formatting. Money arrives from the API as integer paise (number, or a
 * string if beyond 2^53). Dates arrive as UTC ISO strings and are shown in IST.
 */

export type Paise = number | string | bigint | null | undefined;

function toBig(p: Paise): bigint {
  if (p === null || p === undefined || p === '') return 0n;
  return typeof p === 'bigint' ? p : BigInt(typeof p === 'number' ? Math.round(p) : p);
}

/** ₹12,34,567.89 with Indian digit grouping. */
/** Whole rupees by default (rounded), ₹12,34,568; pass { paise: true } for ₹12,34,567.89. */
export function inr(p: Paise, opts: { paise?: boolean } = {}): string {
  let v = toBig(p);
  if (!opts.paise) v = ((v < 0n ? v - 50n : v + 50n) / 100n) * 100n;
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const rupees = (abs / 100n).toString();
  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const whole = `${rest ? rest + ',' : ''}${last3}`;
  const frac = opts.paise ? `.${(abs % 100n).toString().padStart(2, '0')}` : '';
  return `${neg ? '-' : ''}₹${whole}${frac}`;
}

/** Compact: ₹4.21 Cr, ₹38.6 L, ₹12,400. */
export function inrShort(p: Paise): string {
  const rupees = Number(toBig(p)) / 100;
  const abs = Math.abs(rupees);
  if (abs >= 1e7) return `₹${(rupees / 1e7).toFixed(abs >= 1e9 ? 0 : 2)} Cr`;
  if (abs >= 1e5) return `₹${(rupees / 1e5).toFixed(1)} L`;
  return inr(p, { paise: false });
}

const IST: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata' };

export function dateIST(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTimeIST(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Whole days from now to `iso` in IST (negative = past). */
export function daysFromNow(iso: string | Date): number {
  const dayIST = (d: Date) => {
    const s = d.toLocaleDateString('en-CA', IST); // YYYY-MM-DD
    return Date.parse(`${s}T00:00:00Z`);
  };
  return Math.round((dayIST(new Date(iso)) - dayIST(new Date())) / 86_400_000);
}

export function ha(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '—';
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: digits })} ha`;
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-IN');
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return '—';
  return `${n.toFixed(digits)}%`;
}

// Kept in capitals when a code is turned into words (FRA_SETTLEMENT_CERTIFICATE → FRA settlement certificate).
const ACRONYMS = new Set(['fra', 'sia', 'crz', 'rr', 'utr', 'pia', 'gis', 'sla', 'lar', 'cnr', 'ulpin', 'nh', 'pdf', 'otp', 'ifsc', 'dbt', 'gnss', 'esz', 'cfr']);
const SPECIAL: Record<string, string> = { rr: 'R&R' };

/** PRELIM_NOTIFIED → Prelim notified; FRA_CLAIM → FRA claim; RR_OFFICER → R&R officer */
export function humanize(code: string | null | undefined): string {
  if (!code) return '—';
  const words = code
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((w) => SPECIAL[w] ?? (ACRONYMS.has(w) ? w.toUpperCase() : w));
  const s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
