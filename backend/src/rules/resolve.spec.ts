import { parseIstDate } from '../common/dates';
import { CENTRAL_PACK, MAHARASHTRA_PACK, PackSeed } from './rule-packs.data';
import { multiplierFor, PackLike, resolveRules, ruleValue } from './resolve';

const toPack = (s: PackSeed, overrides: Partial<PackLike> = {}): PackLike => ({
  code: s.code,
  actCode: s.actCode,
  stateCode: s.stateCode,
  version: s.version,
  status: 'ACTIVE',
  effectiveFrom: parseIstDate(s.effectiveFrom),
  effectiveTo: s.effectiveTo ? parseIstDate(s.effectiveTo) : null,
  entries: s.entries.map((e) => ({ ...e, unverified: e.unverified ?? false })),
  ...overrides,
});

const central = toPack(CENTRAL_PACK);
const mh = toPack(MAHARASHTRA_PACK);
const d = parseIstDate;

describe('resolveRules', () => {
  it('a Gujarat case in 2025 gets only the central pack', () => {
    const r = resolveRules([central, mh], 'RFCTLARR_2013', 'GJ', d('2025-06-10'));
    expect(r.centralPack).toBe('IN-RFCTLARR-2013-v1');
    expect(r.statePack).toBeNull();
    expect(r.rules['money.rr.linear_lumpsum.bp']).toBeUndefined();
    expect(ruleValue<number>(r, 'money.solatium.bp').value).toBe(10_000);
  });

  it('a Maharashtra case in 2025 inherits central keys and gains s.31A', () => {
    const r = resolveRules([central, mh], 'RFCTLARR_2013', 'MH', d('2025-06-10'));
    expect(r.statePack).toBe('MH-RFCTLARR-2013-v1');
    expect(r.rules['deadline.award.months']).toMatchObject({ value: 12, packCode: 'IN-RFCTLARR-2013-v1', stateOverride: false });
    expect(r.rules['money.rr.linear_lumpsum.bp']).toMatchObject({ value: 5_000, stateOverride: true });
    expect(r.rules['money.multiplier.rural'].packCode).toBe('MH-RFCTLARR-2013-v1'); // overridden
  });

  it('a Maharashtra case from 2016 is judged by the rules then in force (no 2018 amendment)', () => {
    const r = resolveRules([central, mh], 'RFCTLARR_2013', 'MH', d('2016-03-01'));
    expect(r.statePack).toBeNull();
    expect(r.rules['money.rr.linear_lumpsum.bp']).toBeUndefined();
  });

  it('nothing resolves before the Act commenced on 1 Jan 2014', () => {
    const r = resolveRules([central, mh], 'RFCTLARR_2013', 'MH', d('2013-12-31'));
    expect(r.centralPack).toBeNull();
    expect(() => ruleValue(r, 'money.solatium.bp')).toThrow(/No rule 'money.solatium.bp'/);
  });

  it('a newer version supersedes on and after its effective date, and draft packs are ignored', () => {
    const v2 = toPack(CENTRAL_PACK, { code: 'IN-v2', version: 2, effectiveFrom: d('2027-01-01'), entries: [{ key: 'money.solatium.bp', category: 'MONEY', label: 's', value: 12_000, citation: 'hypothetical', unverified: true }] });
    const draft = toPack(CENTRAL_PACK, { code: 'IN-draft', version: 9, status: 'DRAFT' });
    const before = resolveRules([central, v2, draft], 'RFCTLARR_2013', 'KA', d('2026-12-31'));
    const after = resolveRules([central, v2, draft], 'RFCTLARR_2013', 'KA', d('2027-01-01'));
    expect(before.centralPack).toBe('IN-RFCTLARR-2013-v1');
    expect(after.centralPack).toBe('IN-v2');
  });

  it('a retired pack stops applying at its effectiveTo', () => {
    const ended = toPack(MAHARASHTRA_PACK, { effectiveTo: d('2026-01-01') });
    expect(resolveRules([central, ended], 'RFCTLARR_2013', 'MH', d('2025-12-31')).statePack).toBe('MH-RFCTLARR-2013-v1');
    expect(resolveRules([central, ended], 'RFCTLARR_2013', 'MH', d('2026-01-01')).statePack).toBeNull();
  });
});

describe('multiplierFor (First Schedule)', () => {
  const gj = resolveRules([central, mh], 'RFCTLARR_2013', 'GJ', d('2025-06-10'));
  const mhR = resolveRules([central, mh], 'RFCTLARR_2013', 'MH', d('2025-06-10'));
  it.each([
    // [resolution, isRural, km, expected hundredths]
    ['central', false, 3, 100], // urban: 1.00
    ['central', true, 0, 120],
    ['central', true, 10, 120],
    ['central', true, 10.5, 140],
    ['central', true, 55, 200],
    ['MH', true, 15, 130],
    ['MH', true, 41, 200],
  ])('%s, rural=%s, %s km → ×%s/100', (which, rural, km, expected) => {
    const r = which === 'MH' ? mhR : gj;
    const m = multiplierFor(r, rural as boolean, km as number);
    expect(m.hundredths).toBe(expected);
    expect(m.hundredths).toBeGreaterThanOrEqual(100);
    expect(m.hundredths).toBeLessThanOrEqual(200);
  });

  it('flags the rural bands as unverified', () => {
    expect(multiplierFor(mhR, true, 5).rule.unverified).toBe(true);
    expect(multiplierFor(mhR, false, 5).rule.unverified).toBe(false);
  });
});
