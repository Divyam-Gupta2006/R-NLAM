/**
 * Candidate identity links between Person records, with a confidence and the
 * reasons for it. Pure function; the service decides what to store.
 */
import { compareNames } from './names';
import { detectScript } from './transliterate';

export interface PersonFacts {
  id: string;
  name: string;
  fatherName: string | null;
  villageCode: string | null;
  idHash: string | null;
  source: string;
  /** Parcels this record is tied to (as holder or as award beneficiary). */
  parcelIds: string[];
  /** Parcels on which this record is a land-records co-holder. */
  holderParcelIds: string[];
  hasCompensation: boolean;
}

export interface Reason {
  signal: string;
  weight: number;
  score: number; // 0..1
  detail: string;
}

export interface MatchResult {
  confidence: number; // 0..1
  reasons: Reason[];
  /** Links that would release money always need a human (maker-checker). */
  requiresHuman: boolean;
  band: 'AUTO_LINK' | 'REVIEW' | 'NONE';
}

export const AUTO_LINK_AT = 0.95;
export const REVIEW_AT = 0.7;

export function matchPersons(a: PersonFacts, b: PersonFacts): MatchResult | null {
  // Co-holders on the same land record are different people by definition.
  if (a.holderParcelIds.some((p) => b.holderParcelIds.includes(p)) && a.source === b.source) return null;

  const reasons: Reason[] = [];
  if (a.idHash && b.idHash && a.idHash === b.idHash) {
    return { confidence: 0.99, reasons: [{ signal: 'id', weight: 1, score: 1, detail: 'Same salted ID hash' }], requiresHuman: a.hasCompensation || b.hasCompensation, band: a.hasCompensation || b.hasCompensation ? 'REVIEW' : 'AUTO_LINK' };
  }

  const n = compareNames(a.name, b.name);
  const scripts = `${detectScript(a.name)}→${detectScript(b.name)}`;
  reasons.push({ signal: 'name', weight: 0.55, score: n.score, detail: `“${n.a}” vs “${n.b}”: Jaro-Winkler ${n.joined}, token match ${n.tokens}, given name ${n.given}, surname ${n.surname}${scripts !== 'Latn→Latn' ? ` (${scripts} transliterated)` : ''}` });
  reasons.push({ signal: 'phonetic', weight: 0.1, score: n.phoneticMatch ? 1 : 0, detail: n.phoneticMatch ? 'Phonetic keys agree' : 'Phonetic keys differ' });

  let fatherScore: number | null = null;
  if (a.fatherName && b.fatherName) {
    const f = compareNames(a.fatherName, b.fatherName);
    fatherScore = f.score;
    reasons.push({ signal: 'father', weight: 0.15, score: f.score, detail: `Father’s name “${f.a}” vs “${f.b}”: ${f.score}` });
  }
  if (a.villageCode && b.villageCode) {
    const same = a.villageCode === b.villageCode;
    reasons.push({ signal: 'village', weight: 0.1, score: same ? 1 : 0, detail: same ? `Same village (${a.villageCode})` : `Different villages (${a.villageCode} / ${b.villageCode})` });
  }
  const shared = a.parcelIds.filter((p) => b.parcelIds.includes(p));
  if (shared.length && a.source !== b.source) {
    reasons.push({ signal: 'parcel', weight: 0.1, score: 1, detail: `Tied to the same parcel in two different records (${a.source.toLowerCase().replace(/_/g, ' ')} and ${b.source.toLowerCase().replace(/_/g, ' ')})` });
  }

  const totalWeight = reasons.reduce((s, r) => s + r.weight, 0);
  let confidence = reasons.reduce((s, r) => s + r.weight * r.score, 0) / totalWeight;
  // A weak name cannot be rescued by circumstantial signals.
  if (n.score < 0.75) confidence = Math.min(confidence, n.score);
  // Different fathers: at most a weak candidate for review.
  if (fatherScore !== null && fatherScore < 0.8) confidence = Math.min(confidence, 0.75);
  confidence = Math.round(confidence * 1000) / 1000;

  const requiresHuman = a.hasCompensation || b.hasCompensation;
  const band = confidence >= AUTO_LINK_AT && !requiresHuman ? 'AUTO_LINK' : confidence >= REVIEW_AT ? 'REVIEW' : 'NONE';
  if (band === 'NONE') return null;
  return { confidence, reasons, requiresHuman, band };
}
