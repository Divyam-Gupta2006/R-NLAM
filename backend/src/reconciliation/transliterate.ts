/**
 * Brahmic → Latin transliteration for personal names (Devanagari, Gujarati,
 * Kannada). The three Unicode blocks share the ISCII layout: consonants,
 * independent vowels and vowel signs sit at the same offset from each block's
 * start, so one table serves all three. Output is plain ASCII tuned for name
 * matching (not scholarly ISO 15919): ā → a, ś/ṣ → sh, retroflexes → dental.
 *
 * Schwa deletion follows the Hindi/Marathi pattern names are pronounced with:
 * the inherent "a" is dropped word-finally, and medially when the syllable
 * before has a vowel and the one after is a consonant carrying a vowel
 * (राम → ram, रामकुमार → ramkumar, वानखेडे → vankhede).
 */

export type Script = 'Deva' | 'Gujr' | 'Knda' | 'Latn' | 'Other';

const BLOCKS: Array<{ script: Script; start: number }> = [
  { script: 'Deva', start: 0x0900 },
  { script: 'Gujr', start: 0x0a80 },
  { script: 'Knda', start: 0x0c80 },
];

const CONSONANTS: Record<number, string> = {
  0x15: 'k', 0x16: 'kh', 0x17: 'g', 0x18: 'gh', 0x19: 'n',
  0x1a: 'ch', 0x1b: 'chh', 0x1c: 'j', 0x1d: 'jh', 0x1e: 'n',
  0x1f: 't', 0x20: 'th', 0x21: 'd', 0x22: 'dh', 0x23: 'n',
  0x24: 't', 0x25: 'th', 0x26: 'd', 0x27: 'dh', 0x28: 'n', 0x29: 'n',
  0x2a: 'p', 0x2b: 'ph', 0x2c: 'b', 0x2d: 'bh', 0x2e: 'm',
  0x2f: 'y', 0x30: 'r', 0x31: 'r', 0x32: 'l', 0x33: 'l', 0x34: 'l',
  0x35: 'v', 0x36: 'sh', 0x37: 'sh', 0x38: 's', 0x39: 'h',
};

const INDEPENDENT_VOWELS: Record<number, string> = {
  0x05: 'a', 0x06: 'a', 0x07: 'i', 0x08: 'i', 0x09: 'u', 0x0a: 'u', 0x0b: 'ri',
  0x0d: 'e', 0x0e: 'e', 0x0f: 'e', 0x10: 'ai', 0x11: 'o', 0x12: 'o', 0x13: 'o', 0x14: 'au',
};

const VOWEL_SIGNS: Record<number, string> = {
  0x3e: 'a', 0x3f: 'i', 0x40: 'i', 0x41: 'u', 0x42: 'u', 0x43: 'ri',
  0x45: 'e', 0x46: 'e', 0x47: 'e', 0x48: 'ai', 0x49: 'o', 0x4a: 'o', 0x4b: 'o', 0x4c: 'au',
};

const VIRAMA = 0x4d;
const NUKTA = 0x3c;
const NASALS = new Set([0x01, 0x02]); // candrabindu, anusvara
const VISARGA = 0x03;

function blockOf(cp: number): { script: Script; off: number } | null {
  for (const b of BLOCKS) if (cp >= b.start && cp < b.start + 0x80) return { script: b.script, off: cp - b.start };
  return null;
}

export function detectScript(text: string): Script {
  const counts = new Map<Script, number>();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const b = blockOf(cp);
    const s: Script = b ? b.script : /[A-Za-z]/.test(ch) ? 'Latn' : 'Other';
    if (s !== 'Other') counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let best: Script = 'Other';
  let n = 0;
  for (const [s, c] of counts) if (c > n) [best, n] = [s, c];
  return best;
}

interface Syllable {
  consonant: string | null; // null for an independent vowel
  vowel: string | null; // explicit vowel sign / independent vowel
  inherent: boolean; // consonant with implicit "a"
  tail: string; // anusvara / visarga
}

function transliterateWord(word: string): string {
  const syl: Syllable[] = [];
  let other = '';
  const cps = [...word].map((c) => c.codePointAt(0)!);
  for (let i = 0; i < cps.length; i++) {
    const b = blockOf(cps[i]);
    if (!b) {
      other += String.fromCodePoint(cps[i]);
      continue;
    }
    const o = b.off;
    if (CONSONANTS[o] !== undefined) {
      syl.push({ consonant: CONSONANTS[o], vowel: null, inherent: true, tail: '' });
    } else if (INDEPENDENT_VOWELS[o] !== undefined) {
      syl.push({ consonant: null, vowel: INDEPENDENT_VOWELS[o], inherent: false, tail: '' });
    } else if (VOWEL_SIGNS[o] !== undefined && syl.length) {
      const last = syl[syl.length - 1];
      last.vowel = VOWEL_SIGNS[o];
      last.inherent = false;
    } else if (o === VIRAMA && syl.length) {
      syl[syl.length - 1].inherent = false; // conjunct / dead consonant
    } else if ((NASALS.has(o) || o === VISARGA) && syl.length) {
      syl[syl.length - 1].tail += NASALS.has(o) ? 'n' : 'h';
    } else if (o === NUKTA) {
      // ज़ → z, फ़ → f: refine the previous consonant
      const last = syl[syl.length - 1];
      if (last?.consonant === 'j') last.consonant = 'z';
      if (last?.consonant === 'ph') last.consonant = 'f';
    }
  }
  // Schwa deletion (see header).
  const hasVowel = (s: Syllable | undefined) => !!s && (s.vowel !== null || s.inherent);
  for (let i = 0; i < syl.length; i++) {
    const s = syl[i];
    if (!s.inherent || s.tail) continue;
    const isLast = i === syl.length - 1;
    if (isLast && i > 0) s.inherent = false;
    else if (i > 0 && hasVowel(syl[i - 1]) && syl[i + 1]?.consonant && hasVowel(syl[i + 1]) && !isLast) {
      // keep a schwa if deleting it would create a three-consonant cluster
      if (syl[i - 1].vowel !== null || syl[i - 1].inherent) s.inherent = false;
    }
  }
  const out = syl.map((s) => `${s.consonant ?? ''}${s.vowel ?? (s.inherent ? 'a' : '')}${s.tail}`).join('');
  return out + other;
}

/** Transliterate any Brahmic-script words in `text`; Latin passes through. */
export function toLatin(text: string): string {
  return text
    .split(/(\s+)/)
    .map((w) => (/\s+/.test(w) ? w : [...w].some((c) => blockOf(c.codePointAt(0)!)) ? transliterateWord(w) : w))
    .join('');
}
