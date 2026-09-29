import { CANDIDATE_THRESHOLD, normaliseSurvey, proposeLink } from './case-matcher';

const parcel = {
  districtCode: 'MH-YTL',
  villageName: 'Babhulgaon',
  surveyNumber: '311/4',
  holderNames: ['Suresh Dadarao Burade', 'Kamal Dadarao Patil'],
};
const kase = (over: Partial<Parameters<typeof proposeLink>[0]> = {}) => ({
  districtCode: 'MH-YTL',
  villageName: 'Babhulgaon',
  surveyNumbers: ['311/4'],
  parties: ['Ramesh Dadarao Burade', 'Suresh Dadarao Burde'],
  ...over,
});
const signals = (r: ReturnType<typeof proposeLink>) => r?.reasons.map((x) => x.signal);

describe('normaliseSurvey', () => {
  it.each([
    ['S. No. 311 / 4', '311/4'],
    ['Survey No. 441/3', '441/3'],
    ['Gat No. 88-A', '88a'],
    ['311/4', '311/4'],
  ])('%s → %s', (raw, out) => expect(normaliseSurvey(raw)).toBe(out));
});

describe('proposeLink', () => {
  it('survey 0.45 + village 0.20 + party 0.35×name score → capped at 0.99 for the partition suit', () => {
    const r = proposeLink(kase(), parcel)!;
    expect(signals(r)).toEqual(['SURVEY_EXACT', 'VILLAGE', 'PARTY_NAME']);
    expect(r.score).toBeGreaterThanOrEqual(0.95);
    expect(r.score).toBeLessThanOrEqual(0.99);
    expect(r.reasons[2].detail).toMatch(/Suresh Dadarao Burde.*resembles.*Suresh Dadarao Burade/);
  });

  it('a different district is never a candidate, however similar', () => {
    expect(proposeLink(kase({ districtCode: 'MH-WRD' }), parcel)).toBeNull();
  });

  it('same survey number in another village: 0.45 − 0.20 = 0.25 → not a candidate', () => {
    expect(proposeLink(kase({ villageName: 'Kalamb', parties: ['Someone Else'] }), parcel)).toBeNull();
  });

  it('a namesake holder in the same village about another survey number: 0.20 + 0.35 = 0.55 → candidate for a human to reject', () => {
    const r = proposeLink(kase({ surveyNumbers: ['88/1'], parties: ['Suresh Dadarao Burade'] }), parcel)!;
    expect(signals(r)).toEqual(['VILLAGE', 'PARTY_NAME']);
    expect(r.score).toBe(0.55);
  });

  it('a name alone (no village or survey in the case) is not enough: 0.35 < 0.50', () => {
    expect(proposeLink(kase({ villageName: null, surveyNumbers: [], parties: ['Suresh Dadarao Burade'] }), parcel)).toBeNull();
  });

  it('bare survey number 311 covers 311/4 (+0.20), but 311/2 is a different plot', () => {
    expect(signals(proposeLink(kase({ surveyNumbers: ['311'] }), parcel))).toContain('SURVEY_BASE');
    expect(signals(proposeLink(kase({ surveyNumbers: ['311/2'] }), parcel))).not.toContain('SURVEY_BASE');
  });

  it('a party in Devanagari matches a Latin holder name through 6.5 transliteration', () => {
    const r = proposeLink(kase({ parties: ['सुरेश दादाराव बुराडे'] }), parcel)!;
    expect(signals(r)).toContain('PARTY_NAME');
  });

  it('a different given name with the same surname does not count as the holder (brother ≠ holder)', () => {
    const r = proposeLink(kase({ surveyNumbers: [], parties: ['Ramesh Dadarao Burade'] }), parcel);
    expect(r).toBeNull();
  });

  it('threshold is 0.50', () => expect(CANDIDATE_THRESHOLD).toBe(0.5));
});
