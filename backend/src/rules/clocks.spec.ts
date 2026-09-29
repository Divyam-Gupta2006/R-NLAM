import { istDateString, parseIstDate } from '../common/dates';
import { computeClocks, ParcelFacts } from './clocks';
import { CENTRAL_PACK, MAHARASHTRA_PACK, PackSeed } from './rule-packs.data';
import { PackLike, resolveRules } from './resolve';

const toPack = (s: PackSeed): PackLike => ({
  code: s.code,
  actCode: s.actCode,
  stateCode: s.stateCode,
  version: s.version,
  status: 'ACTIVE',
  effectiveFrom: parseIstDate(s.effectiveFrom),
  effectiveTo: null,
  entries: s.entries.map((e) => ({ ...e, unverified: e.unverified ?? false })),
});
const packs = [toPack(CENTRAL_PACK), toPack(MAHARASHTRA_PACK)];
const rulesAt = (on: Date) => resolveRules(packs, 'RFCTLARR_2013', 'MH', on);
const d = parseIstDate;

function clocks(f: Partial<ParcelFacts>, now: string) {
  return computeClocks({ stage: 'PRELIM_NOTIFIED', hasCompensation: false, hasMonetaryRR: false, ...f }, rulesAt, d(now));
}
const by = (cs: ReturnType<typeof clocks>, kind: string) => cs.find((c) => c.kind === kind)!;

describe('computeClocks', () => {
  const sec11 = { date: d('2025-11-05'), noticeId: 'n11' };

  it('s.11 on 5 Nov 2025 → objections close 4 Jan 2026 (60 days), declaration due 5 Nov 2026 (12 months)', () => {
    const cs = clocks({ sec11 }, '2026-09-29');
    expect(istDateString(by(cs, 'OBJECTION_WINDOW').dueOn)).toBe('2026-01-04');
    expect(by(cs, 'OBJECTION_WINDOW').status).toBe('MET');
    const decl = by(cs, 'DECLARATION_DEADLINE');
    expect(istDateString(decl.dueOn)).toBe('2026-11-05');
    expect(decl.status).toBe('RUNNING');
    expect(decl.citation).toBe('RFCTLARR 2013, s.19(7)');
  });

  it('declaration missed: no s.19 by 5 Nov 2026 and today is 6 Nov 2026 → MISSED (deemed rescinded)', () => {
    expect(by(clocks({ sec11 }, '2026-11-06'), 'DECLARATION_DEADLINE').status).toBe('MISSED');
  });

  it('a 40-day court stay pushes the declaration deadline to 15 Dec 2026', () => {
    const decl = by(clocks({ sec11, excludedDays: 40 }, '2026-11-20'), 'DECLARATION_DEADLINE');
    expect(istDateString(decl.dueOn)).toBe('2026-12-15');
    expect(decl.status).toBe('RUNNING');
  });

  it('s.19 on 15 Jul 2026 meets the declaration clock and starts the award clock (due 15 Jul 2027, s.25)', () => {
    const cs = clocks({ stage: 'DECLARED', sec11, sec19: { date: d('2026-07-15'), noticeId: 'n19' } }, '2026-09-29');
    expect(by(cs, 'DECLARATION_DEADLINE')).toMatchObject({ status: 'MET' });
    const aw = by(cs, 'AWARD_DEADLINE');
    expect(istDateString(aw.dueOn)).toBe('2027-07-15');
    expect(aw).toMatchObject({ status: 'RUNNING', citation: 'RFCTLARR 2013, s.25', noticeId: 'n19' });
  });

  it('award on 4 May 2026: payment due 4 Aug 2026 (3 months); paid 20 Aug → MISSED; paid 1 Jul → MET', () => {
    const base = { stage: 'AWARDED', sec11, sec19: { date: d('2026-02-16'), noticeId: 'n19' }, awardDate: d('2026-05-04'), hasCompensation: true };
    const late = by(clocks({ ...base, allPaidOn: d('2026-08-20') }, '2026-09-29'), 'PAYMENT_DEADLINE');
    expect(istDateString(late.dueOn)).toBe('2026-08-04');
    expect(late.status).toBe('MISSED');
    expect(by(clocks({ ...base, allPaidOn: d('2026-07-01') }, '2026-09-29'), 'PAYMENT_DEADLINE').status).toBe('MET');
    expect(by(clocks({ ...base, allPaidOn: null }, '2026-07-01'), 'PAYMENT_DEADLINE').status).toBe('RUNNING');
  });

  it('monetary R&R clock runs 6 months from the award (s.38(1)) only when there is monetary R&R', () => {
    const base = { stage: 'COMPENSATION_PAID', sec11, awardDate: d('2026-05-04'), hasCompensation: true, allPaidOn: d('2026-06-01') };
    expect(clocks({ ...base, hasMonetaryRR: false }, '2026-09-29').some((c) => c.kind === 'RR_MONETARY_DEADLINE')).toBe(false);
    const rr = by(clocks({ ...base, hasMonetaryRR: true, allMonetaryRRDeliveredOn: null }, '2026-09-29'), 'RR_MONETARY_DEADLINE');
    expect(istDateString(rr.dueOn)).toBe('2026-11-04');
    expect(rr.status).toBe('RUNNING');
  });

  it('withdrawn parcels have no clocks', () => {
    expect(clocks({ stage: 'WITHDRAWN', sec11 }, '2026-09-29')).toEqual([]);
  });
});
