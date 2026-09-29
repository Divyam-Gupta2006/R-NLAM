import { matchPersons, PersonFacts } from './matcher';

const base = (p: Partial<PersonFacts>): PersonFacts => ({
  id: 'x',
  name: '',
  fatherName: null,
  villageCode: 'MH-WRD-SLK',
  idHash: null,
  source: 'LAND_RECORDS',
  parcelIds: [],
  holderParcelIds: [],
  hasCompensation: false,
  ...p,
});

describe('matchPersons', () => {
  const landRecord = base({ id: 'a', name: 'रामकुमार भाऊराव वानखेडे', fatherName: 'भाऊराव वानखेडे', parcelIds: ['p1'], holderParcelIds: ['p1'] });
  const awardRegister = base({ id: 'b', name: 'Ramkumar B. Wankhede', fatherName: 'Bhaurao Wankhede', source: 'AWARD', parcelIds: ['p1'], hasCompensation: true });

  it('Devanagari 7/12 vs Latin award register for the same man: high confidence, but money means a human confirms', () => {
    const m = matchPersons(landRecord, awardRegister)!;
    expect(m.confidence).toBeGreaterThanOrEqual(0.9);
    expect(m.requiresHuman).toBe(true);
    expect(m.band).toBe('REVIEW');
    expect(m.reasons.map((r) => r.signal)).toEqual(['name', 'phonetic', 'father', 'village', 'parcel']);
    expect(m.reasons[0].detail).toMatch(/Deva→Latn transliterated/);
  });

  it('the same pair with no money attached is auto-linked (visible and reversible, never silent)', () => {
    const m = matchPersons(landRecord, { ...awardRegister, hasCompensation: false })!;
    expect(m.band).toBe('AUTO_LINK');
  });

  it('co-holders on the same land record are never matched, however alike', () => {
    const brother = base({ id: 'c', name: 'Ramesh Bhaurao Patil', holderParcelIds: ['p9'], parcelIds: ['p9'] });
    const other = base({ id: 'd', name: 'Ramesh Bhaurao Patil', holderParcelIds: ['p9'], parcelIds: ['p9'] });
    expect(matchPersons(brother, other)).toBeNull();
  });

  it('a shared surname and village are not enough', () => {
    expect(matchPersons(base({ name: 'Ramesh Patil', fatherName: 'Dadarao Patil' }), base({ id: 'e', name: 'Suresh Patil', fatherName: 'Dadarao Patil' }))).toBeNull();
  });

  it('different fathers pull a same-name pair down to review', () => {
    const m = matchPersons(base({ name: 'Ganesh Kolhe', fatherName: 'Motiram Kolhe' }), base({ id: 'f', name: 'Ganesh Kolhe', fatherName: 'Narayan Kolhe', source: 'FIELD_SURVEY' }))!;
    expect(m.band).toBe('REVIEW');
    expect(m.confidence).toBeLessThan(0.95);
  });

  it('the same ID hash is near-certain', () => {
    expect(matchPersons(base({ idHash: 'h1', name: 'A B' }), base({ id: 'g', idHash: 'h1', name: 'X Y' }))!.confidence).toBe(0.99);
  });
});
