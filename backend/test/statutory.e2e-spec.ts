import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { Clock } from '../src/common/clock';
import { createApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * 6.1: rule packs resolve by state and date, statutory clocks are derived from
 * notices, lapse guards block late actions, and T-60/T-30/T-7 alerts reach the
 * right officers. The clock is pinned so the story is date-independent.
 */
describe('Statutory rule engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clock: Clock;
  const tokens: Record<string, string> = {};
  const as = (k: string) => ({ Authorization: `Bearer ${tokens[k]}` });
  const login = async (k: string, email: string) => {
    tokens[k] = (await request(app.getHttpServer()).post('/api/auth/dev-login').send({ email }).expect(200)).body.token;
  };

  beforeAll(async () => {
    process.env.STATUTORY_SCHEDULER = 'off';
    app = await createApp();
    await app.init();
    prisma = app.get(PrismaService);
    clock = app.get(Clock);
    clock.pin(new Date('2026-09-29T12:00:00+05:30'));
    await login('yavatmal', 'collector.yavatmal@demo.rnlam.in');
    await login('stateAdmin', 'ps.revenue.mh@demo.rnlam.in');
    await login('central', 'js.landreforms@demo.rnlam.in');
    await request(app.getHttpServer()).post('/api/statutory/recompute').set(as('stateAdmin')).expect(200);
  });

  afterAll(async () => {
    clock.pin(null);
    await app.close();
  });

  it('resolves Maharashtra rules as central + state overlay, publicly, with citations', async () => {
    const r = await request(app.getHttpServer()).get('/api/rules/resolve?stateCode=MH&date=2026-09-29').expect(200);
    expect(r.body.centralPack).toBe('IN-RFCTLARR-2013-v1');
    expect(r.body.statePack).toBe('MH-RFCTLARR-2013-v1');
    expect(r.body.rules['deadline.award.months']).toMatchObject({ value: 12, citation: 'RFCTLARR 2013, s.25' });
    expect(r.body.rules['money.additional.start_event'].value).toBe('SEC_4_SIA');
    expect(r.body.rules['money.multiplier.rural'].unverified).toBe(true);
    const gj = await request(app.getHttpServer()).get('/api/rules/resolve?stateCode=GJ&date=2026-09-29').expect(200);
    expect(gj.body.statePack).toBeNull();
  });

  it('puts Dhanora’s s.19 declaration (due 5 Nov 2026) on the Yavatmal calendar, 37 days out', async () => {
    const cal = await request(app.getHttpServer()).get('/api/statutory/calendar').set(as('yavatmal')).expect(200);
    const decl = cal.body.find((g: { kind: string; villages: string[] }) => g.kind === 'DECLARATION_DEADLINE' && g.villages.includes('Dhanora'));
    expect(decl).toBeDefined();
    expect(decl.status).toBe('RUNNING');
    expect(decl.daysLeft).toBe(37);
    expect(decl.citation).toBe('RFCTLARR 2013, s.19(7)');
    expect(decl.parcelCount).toBeGreaterThanOrEqual(7);
  });

  it('raises a T-60 alert for that deadline to the Yavatmal Collector only, once', async () => {
    const mine = await request(app.getHttpServer()).get('/api/notifications').set(as('yavatmal')).expect(200);
    const t60 = mine.body.filter((n: { title: string }) => n.title.startsWith('T-60: s.19 declaration due in 37 days'));
    expect(t60.length).toBe(1);
    await request(app.getHttpServer()).post('/api/statutory/recompute').set(as('stateAdmin')).expect(200);
    const again = await request(app.getHttpServer()).get('/api/notifications').set(as('yavatmal')).expect(200);
    expect(again.body.filter((n: { title: string }) => n.title.startsWith('T-60: s.19 declaration')).length).toBe(1);
    const wardha = await login('wardha', 'collector.wardha@demo.rnlam.in').then(() => request(app.getHttpServer()).get('/api/notifications').set(as('wardha')).expect(200));
    expect(wardha.body.some((n: { title: string }) => n.title.includes('s.19 declaration due in 37 days'))).toBe(false);
  });

  it('flags missed s.38 payment deadlines for awarded-but-unpaid Wardha parcels', async () => {
    const missed = await prisma.statutoryClock.count({ where: { kind: 'PAYMENT_DEADLINE', status: 'MISSED', districtCode: 'MH-WRD' } });
    expect(missed).toBeGreaterThan(0);
  });

  it('blocks an award after the s.25 period, and allows it only as a senior override with the extension recorded', async () => {
    const parcel = await prisma.parcel.findFirstOrThrow({ where: { parcelNumber: 'YTL-KRS-001' } });
    clock.pin(new Date('2027-08-01T12:00:00+05:30')); // s.19 was 15 Jul 2026 → award due 15 Jul 2027
    try {
      const blocked = await request(app.getHttpServer()).post('/api/awards').set(as('yavatmal')).send({ parcelId: parcel.id, awardDate: '2027-08-01' }).expect(409);
      expect(blocked.body.blockers[0]).toMatchObject({ code: 'AWARD_PERIOD_EXPIRED', citation: 'RFCTLARR 2013, s.25', overridable: true });

      // A Collector cannot override; a State Admin can, with a reason.
      await request(app.getHttpServer()).post('/api/awards').set(as('yavatmal')).send({ parcelId: parcel.id, awardDate: '2027-08-01', override: true, reason: 'Extension order RFD/LAQ/2027/114 dated 10 Jul 2027' }).expect(409);
      await request(app.getHttpServer()).post('/api/awards').set(as('stateAdmin')).send({ parcelId: parcel.id, awardDate: '2027-08-01', override: true, reason: 'short' }).expect(400);
      const ok = await request(app.getHttpServer()).post('/api/awards').set(as('stateAdmin')).send({ parcelId: parcel.id, awardDate: '2027-08-01', override: true, reason: 'Extension order RFD/LAQ/2027/114 dated 10 Jul 2027' }).expect(201);
      expect(ok.body.calculation.additionalFromEvent).toBe('SEC_4_SIA');
      const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: parcel.id, action: 'DECLARE_AWARD_OVERRIDE' } });
      expect(audit.highlighted).toBe(true);
      expect(audit.reason).toContain('RFD/LAQ/2027/114');
    } finally {
      clock.pin(new Date('2026-09-29T12:00:00+05:30'));
    }
  });

  it('shows a parcel’s clocks with the pack that produced them', async () => {
    const parcel = await prisma.parcel.findFirstOrThrow({ where: { parcelNumber: 'YTL-DHN-001' } });
    const clocks = await request(app.getHttpServer()).get(`/api/statutory/parcels/${parcel.id}`).set(as('yavatmal')).expect(200);
    expect(clocks.body.map((c: { kind: string }) => c.kind).sort()).toEqual(['DECLARATION_DEADLINE', 'OBJECTION_WINDOW']);
    expect(clocks.body[0].packCode).toBe('IN-RFCTLARR-2013-v1');
  });
});
