/**
 * Name normalisation, Jaro-Winkler similarity and a phonetic key for Indian
 * names. Pure functions; see names.spec.ts for worked examples.
 */
import { toLatin } from './transliterate';

const HONORIFICS = new Set(['shri', 'shree', 'sri', 'smt', 'shrimati', 'sau', 'kum', 'kumari', 'late', 'kai', 'dr', 'mr', 'mrs', 'ms', 'md', 'mohd', 'sh', 'shr']);

/** Latin, lower-case, honorifics removed, common spelling variants folded. */
export function normaliseName(raw: string): string[] {
  const latin = toLatin(raw.normalize('NFC'))
    .toLowerCase()
    .replace(/[^a-z\s.]/g, ' ')
    .replace(/\./g, ' ');
  return latin
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !HONORIFICS.has(t))
    .map((t) =>
      t
        .replace(/w/g, 'v')
        .replace(/ph/g, 'f')
        .replace(/z/g, 'j')
        .replace(/q/g, 'k')
        .replace(/aa/g, 'a')
        .replace(/ee/g, 'i')
        .replace(/oo/g, 'u')
        .replace(/ou/g, 'u')
        .replace(/rao$/, 'rav')
        .replace(/(.)\1+/g, '$1'),
    );
}

export function jaro(a: string, b: string): number {
  if (a === b) return a.length ? 1 : 0;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aM = new Array<boolean>(a.length).fill(false);
  const bM = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (bM[j] || a[i] !== b[j]) continue;
      aM[i] = bM[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aM[i]) continue;
    while (!bM[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  return (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
}

/** Jaro-Winkler with the standard prefix scale 0.1 over up to 4 characters. */
export function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  let l = 0;
  while (l < 4 && l < a.length && l < b.length && a[l] === b[l]) l++;
  return j + l * 0.1 * (1 - j);
}

/**
 * Phonetic key for Indian names: aspiration, sibilants and vowel length are
 * folded; vowels after the first letter dropped; repeats collapsed.
 * Wankhede / वानखेडे / Vankhede → "vnkd".
 */
export function phoneticKey(token: string): string {
  const t = token
    .replace(/(kh|gh)/g, (m) => m[0])
    .replace(/(chh|ch|jh)/g, (m) => (m[0] === 'j' ? 'j' : 'c'))
    .replace(/(th|dh|bh|ph)/g, (m) => m[0])
    .replace(/sh/g, 's')
    .replace(/x/g, 'ks')
    .replace(/v/g, 'v')
    .replace(/y/g, 'i');
  if (!t) return '';
  const first = t[0];
  const rest = t
    .slice(1)
    .replace(/[aeiouh]/g, '')
    .replace(/(.)\1+/g, '$1');
  return (first + rest).slice(0, 6);
}

export interface NameComparison {
  score: number; // 0..1
  joined: number;
  tokens: number;
  given: number;
  phoneticMatch: boolean;
  a: string;
  b: string;
}

/**
 * Compare two names in any supported script. Combines Jaro-Winkler on the
 * joined names (robust to "Ram Kumar" vs "Ramkumar") with a token-by-token
 * best match (robust to order and initials: "B." matches "Bhaurao").
 */
export function compareNames(rawA: string, rawB: string): NameComparison {
  const A = normaliseName(rawA);
  const B = normaliseName(rawB);
  const a = A.join('');
  const b = B.join('');
  const joined = jaroWinkler(a, b);
  const tokenScore = (x: string[], y: string[]) => {
    if (!x.length || !y.length) return 0;
    let sum = 0;
    for (const t of x) {
      let best = 0;
      for (const u of y) {
        const s = t.length === 1 || u.length === 1 ? (t[0] === u[0] ? 0.9 : 0) : jaroWinkler(t, u);
        if (s > best) best = s;
      }
      sum += best;
    }
    return sum / x.length;
  };
  // The shorter name's tokens are matched into the longer one's.
  const tokens = A.length <= B.length ? tokenScore(A, B) : tokenScore(B, A);
  const phoneticMatch = phoneticKey(a) === phoneticKey(b) || (A.length > 0 && B.length > 0 && phoneticKey(A[A.length - 1]) === phoneticKey(B[B.length - 1]) && phoneticKey(A[0]) === phoneticKey(B[0]));
  // Given names carry identity; a shared surname alone must not make a match.
  // Compare first tokens, allowing a split given name ("Ram Kumar" ~ "Ramkumar").
  const given = A.length && B.length
    ? Math.max(
        A[0].length === 1 || B[0].length === 1 ? (A[0][0] === B[0][0] ? 0.9 : 0) : jaroWinkler(A[0], B[0]),
        A.length > 1 ? jaroWinkler(A[0] + A[1], B[0]) : 0,
        B.length > 1 ? jaroWinkler(A[0], B[0] + B[1]) : 0,
      )
    : 0;
  let score = Math.max(joined, 0.5 * joined + 0.5 * tokens);
  if (given < 0.85) score *= given;
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return { score: r(score), joined: r(joined), tokens: r(tokens), given: r(given), phoneticMatch, a: A.join(' '), b: B.join(' ') };
}
