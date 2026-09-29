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
export function inr(p: Paise, opts: { paise?: boolean } = {}): string {
  const v = toBig(p);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const rupees = (abs / 100n).toString();
  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const whole = `${rest ? rest + ',' : ''}${last3}`;
  const frac = opts.paise === false ? '' : `.${(abs % 100n).toString().padStart(2, '0')}`;
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

/** PRELIM_NOTIFIED → Prelim notified */
export function humanize(code: string | null | undefined): string {
  if (!code) return '—';
  const s = code.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
