import { compareNames } from '../reconciliation/names';

/**
 * Proposes links between court cases and parcels (6.9). Pure: the same inputs
 * always give the same score and reasons. A link is only ever a candidate; an
 * officer confirms or rejects it.
 *
 * Signals (the district must match first; cases are fetched per district):
 *   survey number   exact +0.45, same base number (311 vs 311/4) +0.20
 *   village         same village +0.20; a different named village -0.20
 *   party name      best case party vs parcel holder, via the 6.5 name
 *                   comparison (any script), counted when ≥ 0.85: +0.35 × score
 * A candidate needs ≥ 0.50, so a survey number alone (a common number in
 * another village) or a name alone (a namesake) is not enough.
 */

export interface CaseFacts {
  districtCode: string;
  villageName: string | null;
  surveyNumbers: string[];
  parties: string[];
}

export interface ParcelFacts {
  districtCode: string;
  villageName: string;
  surveyNumber: string;
  holderNames: string[];
}

export interface LinkReason {
  signal: 'SURVEY_EXACT' | 'SURVEY_BASE' | 'VILLAGE' | 'VILLAGE_MISMATCH' | 'PARTY_NAME';
  detail: string;
  weight: number;
}

export interface LinkProposal {
  score: number;
  reasons: LinkReason[];
}

export const CANDIDATE_THRESHOLD = 0.5;
const W = { surveyExact: 0.45, surveyBase: 0.2, village: 0.2, villageMismatch: -0.2, party: 0.35 };
const NAME_MIN = 0.85;

/** "S. No. 311 / 4-A" → "311/4a" */
export function normaliseSurvey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^(?:s\.?\s*no\.?|survey\s*no\.?|gat\s*no\.?|khasra\s*no\.?)\s*/, '')
    .replace(/\s+/g, '')
    .replace(/[-–]/g, '');
}

const base = (s: string) => s.split('/')[0];

export function proposeLink(c: CaseFacts, p: ParcelFacts): LinkProposal | null {
  if (c.districtCode !== p.districtCode) return null;
  const reasons: LinkReason[] = [];

  const ps = normaliseSurvey(p.surveyNumber);
  const cs = c.surveyNumbers.map(normaliseSurvey);
  if (cs.includes(ps)) {
    reasons.push({ signal: 'SURVEY_EXACT', detail: `Survey no. ${p.surveyNumber} appears in the case`, weight: W.surveyExact });
  } else {
    // "311" covers 311/4; "311/2" is a different plot from 311/4.
    const hit = cs.find((s) => base(s) === base(ps) && (!s.includes('/') || !ps.includes('/')));
    if (hit) reasons.push({ signal: 'SURVEY_BASE', detail: `Case cites survey no. ${hit}; parcel is ${p.surveyNumber}`, weight: W.surveyBase });
  }

  if (c.villageName) {
    const v = compareNames(c.villageName, p.villageName);
    if (v.score >= 0.9) reasons.push({ signal: 'VILLAGE', detail: `Same village (${c.villageName})`, weight: W.village });
    else reasons.push({ signal: 'VILLAGE_MISMATCH', detail: `Case is about ${c.villageName}, parcel is in ${p.villageName}`, weight: W.villageMismatch });
  }

  let best: { party: string; holder: string; score: number } | null = null;
  for (const party of c.parties) {
    for (const holder of p.holderNames) {
      const s = compareNames(party, holder).score;
      if (s >= NAME_MIN && (!best || s > best.score)) best = { party, holder, score: s };
    }
  }
  if (best) {
    const exact = best.score >= 0.999;
    reasons.push({
      signal: 'PARTY_NAME',
      detail: `Party "${best.party}" ${exact ? 'is' : `resembles (${Math.round(best.score * 100)}%)`} holder "${best.holder}"`,
      weight: Math.round(W.party * best.score * 1000) / 1000,
    });
  }

  const score = Math.max(0, Math.min(0.99, reasons.reduce((s, r) => s + r.weight, 0)));
  if (score < CANDIDATE_THRESHOLD) return null;
  return { score: Math.round(score * 100) / 100, reasons };
}
