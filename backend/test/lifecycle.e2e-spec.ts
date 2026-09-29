import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { createApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';
import { STORY } from '../prisma/seed/demo';

/**
 * End-to-end: the real Nest app against the seeded test database. Proves the
 * trust properties from the gap report: closed-by-default auth, jurisdiction
 * scoping, validation, guarded transitions, atomic audit + outbox, and a
 * recomputable, tamper-evident audit chain.
 */
describe('R-NLAM API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};

  const login = async (key: string, email: string) => {
    const res = await request(app.getHttpServer()).post('/api/auth/dev-login').send({ email }).expect(200);
    tokens[key] = res.body.token;
  };
  const as = (key: string) => ({ Authorization: `Bearer ${tokens[key]}` });
  const parcelId = async (parcelNumber: string) => (await prisma.parcel.findFirstOrThrow({ where: { parcelNumber } })).id;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    prisma = app.get(PrismaService);
    await login('central', 'js.landreforms@demo.rnlam.in');
    await login('wardha', 'collector.wardha@demo.rnlam.in');
    await login('yavatmal', 'collector.yavatmal@demo.rnlam.in');
    await login('field', 'surveyor.wardha@demo.rnlam.in');
    await login('finance', 'finance.mh@demo.rnlam.in');
    await login('pia', 'pd.nhai.wardha@demo.rnlam.in');
    await login('stateAdmin', 'ps.revenue.mh@demo.rnlam.in');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication is closed by default', () => {
    it('rejects a request without a token (401)', async () => {
      await request(app.getHttpServer()).get('/api/projects').expect(401);
    });

    it('ignores a forged X-User-Role header (401, not admin)', async () => {
      await request(app.getHttpServer()).get('/api/audit').set('X-User-Role', 'CENTRAL_ADMIN').expect(401);
    });

    it('rejects a token signed with another secret', async () => {
      const forged = tokens.central.slice(0, -4) + 'AAAA';
      await request(app.getHttpServer()).get('/api/projects').set('Authorization', `Bearer ${forged}`).expect(401);
    });

    it('lets public routes through without a token', async () => {
      const res = await request(app.getHttpServer()).get('/api/system/health').expect(200);
      expect(res.body.postgis).toMatch(/^3\./);
    });

    it('computes spatial totals in PostGIS from the trigger-maintained geometry', async () => {
      const res = await request(app.getHttpServer()).get('/api/gis/stats').set(as('central')).expect(200);
      expect(res.body.parcelsWithGeometry).toBe(res.body.parcels);
      expect(res.body.surveyedAreaHa).toBeGreaterThan(50);
    });
  });

  describe('scoping and validation', () => {
    it('national admin sees all 6 projects; Wardha collector sees only Wardha parcels', async () => {
      const p = await request(app.getHttpServer()).get('/api/projects').set(as('central')).expect(200);
      expect(p.body).toHaveLength(6);
      const w = await request(app.getHttpServer()).get('/api/parcels?pageSize=500').set(as('wardha')).expect(200);
      expect(w.body.total).toBeGreaterThan(40);
      expect(new Set(w.body.items.map((x: { districtCode: string }) => x.districtCode))).toEqual(new Set(['MH-WRD']));
    });

    it('returns 400 (not 500) for an invalid body', async () => {
      const res = await request(app.getHttpServer()).post('/api/projects').set(as('pia')).send({}).expect(400);
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('returns 403 when the role is not allowed', async () => {
      await request(app.getHttpServer()).post('/api/projects').set(as('field')).send({}).expect(403);
    });
  });

  describe('lifecycle guards', () => {
    it('blocks possession while R&R entitlements are undelivered (s.38(1)) with a 409 explaining why', async () => {
      const id = await parcelId(STORY.rrBlockedParcel);
      const res = await request(app.getHttpServer()).post(`/api/possession/${id}/take`).set(as('field')).send({}).expect(409);
      expect(res.body.error).toBe('TRANSITION_BLOCKED');
      expect(res.body.blockers[0]).toMatchObject({ code: 'RR_PENDING', citation: 'RFCTLARR 2013, s.38(1)', overridable: false });
      const parcel = await prisma.parcel.findUniqueOrThrow({ where: { id } });
      expect(parcel.stage).toBe('COMPENSATION_PAID'); // nothing changed
    });

    it('takes possession when payment and R&R are complete, writing transition + audit + outbox atomically', async () => {
      const id = await parcelId(STORY.livePossessionParcel);
      const auditBefore = await prisma.auditEvent.count();
      await request(app.getHttpServer()).post(`/api/possession/${id}/take`).set(as('field')).send({ latitude: 20.7, longitude: 78.5 }).expect(200);
      expect((await prisma.parcel.findUniqueOrThrow({ where: { id } })).stage).toBe('POSSESSION_TAKEN');
      expect(await prisma.auditEvent.count()).toBe(auditBefore + 2); // parcel + possession record
      const events = await prisma.outboxEvent.findMany({ where: { aggregateId: id } });
      expect(events.map((e) => e.type)).toContain('parcel.stage_changed.v1');
    });

    it('refuses domain-only events on the generic endpoint', async () => {
      const id = await parcelId(STORY.forestParcel);
      await request(app.getHttpServer()).post(`/api/lifecycle/Parcel/${id}/transitions`).set(as('yavatmal')).send({ event: 'DECLARE_AWARD' }).expect(400);
    });

    it('does not let an objection be decided before the objector is heard (s.15(2))', async () => {
      const o = await prisma.objection.findFirstOrThrow({ where: { parcel: { parcelNumber: 'YTL-WDG-002' } } });
      const res = await request(app.getHttpServer()).post(`/api/lifecycle/Objection/${o.id}/transitions`).set(as('yavatmal')).send({ event: 'REJECT' }).expect(409);
      expect(res.body.blockers[0].code).toBe('NOT_HEARD');
    });

    it('lists available transitions with their blockers', async () => {
      const id = await parcelId(STORY.rrBlockedParcel);
      const res = await request(app.getHttpServer()).get(`/api/lifecycle/Parcel/${id}`).set(as('wardha')).expect(200);
      expect(res.body.state).toBe('COMPENSATION_PAID');
      const take = res.body.options.find((o: { event: string }) => o.event === 'TAKE_POSSESSION');
      expect(take.blockers.map((b: { code: string }) => b.code)).toEqual(['RR_PENDING']);
      expect(res.body.history.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('money flows', () => {
    it('paying the last approved beneficiary moves the parcel to COMPENSATION_PAID', async () => {
      const id = await parcelId(STORY.livePayParcel);
      const comps = await prisma.compensation.findMany({ where: { parcelId: id }, orderBy: { amountPaise: 'asc' } });
      expect(comps.every((c) => c.status === 'APPROVED')).toBe(true);
      let last: { body: { status: string; parcelAdvanced: boolean; utrNumber: string } } | undefined;
      for (const c of comps) {
        await prisma.compensation.update({ where: { id: c.id }, data: { bankAccountLast4: '4321' } }); // not the synthetic failure account
        last = await request(app.getHttpServer()).post(`/api/compensation/${c.id}/pay`).set(as('finance')).expect(200);
        expect(last.body.status).toBe('PAID');
        expect(last.body.utrNumber).toMatch(/^SYN/);
      }
      expect(last!.body.parcelAdvanced).toBe(true);
      expect((await prisma.parcel.findUniqueOrThrow({ where: { id } })).stage).toBe('COMPENSATION_PAID');
    });

    it('declares an award whose per-holder compensation adds up exactly to the total', async () => {
      const id = await parcelId('YTL-RLG-001');
      const preview = await request(app.getHttpServer()).post('/api/awards/preview').set(as('yavatmal')).send({ parcelId: id, awardDate: '2026-09-28' }).expect(200);
      expect(preview.body.breakdown.lines).toHaveLength(7);
      const award = await request(app.getHttpServer()).post('/api/awards').set(as('yavatmal')).send({ parcelId: id, awardDate: '2026-09-28' }).expect(201);
      const comps = await prisma.compensation.findMany({ where: { awardId: award.body.id } });
      expect(comps.reduce((s, c) => s + c.amountPaise, 0n)).toBe(BigInt(award.body.totalPaise));
      expect((await prisma.parcel.findUniqueOrThrow({ where: { id } })).stage).toBe('AWARDED');
    });

    it('s.19 notice skips parcels with undisposed objections and reports why', async () => {
      const project = await prisma.project.findUniqueOrThrow({ where: { code: 'NH-WY-4L' } });
      const wadgaon = await prisma.parcel.findMany({ where: { villageName: 'Wadgaon' } });
      const res = await request(app.getHttpServer())
        .post('/api/notices')
        .set(as('yavatmal'))
        .send({ projectId: project.id, kind: 'SEC_19_DECLARATION', referenceNo: 'LAQ/YTL/19/2026/03', publishedOn: '2026-09-28', parcelIds: wadgaon.map((p) => p.id) })
        .expect(201);
      expect(res.body.included).toBe(wadgaon.length - 2);
      expect(res.body.excluded.map((e: { parcelNumber: string }) => e.parcelNumber).sort()).toEqual(['YTL-WDG-002', 'YTL-WDG-005']);
    });
  });

  describe('tamper-evident audit', () => {
    it('verifies the whole chain, then detects a row edited behind the API', async () => {
      const ok = await request(app.getHttpServer()).get('/api/audit/verify').set(as('central')).expect(200);
      expect(ok.body.valid).toBe(true);
      expect(ok.body.checked).toBeGreaterThan(900);

      const victim = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'DECLARE_AWARD' }, orderBy: { seq: 'asc' } });
      await prisma.auditEvent.update({ where: { seq: victim.seq }, data: { reason: 'edited by an insider' } });
      const bad = await request(app.getHttpServer()).get('/api/audit/verify').set(as('central')).expect(200);
      expect(bad.body.valid).toBe(false);
      expect(bad.body.break).toMatchObject({ kind: 'CONTENT_ALTERED', seq: Number(victim.seq) });

      await prisma.auditEvent.update({ where: { seq: victim.seq }, data: { reason: victim.reason } });
      const again = await request(app.getHttpServer()).get('/api/audit/verify').set(as('central')).expect(200);
      expect(again.body.valid).toBe(true);
    });
  });

  describe('citizen', () => {
    it('logs in with OTP and sees only their own parcel', async () => {
      const otp = await request(app.getHttpServer()).post('/api/auth/citizen/otp').send({ phone: '9800000001' }).expect(200);
      const v = await request(app.getHttpServer()).post('/api/auth/citizen/verify').send({ requestId: otp.body.requestId, code: otp.body.devOtp }).expect(200);
      const me = await request(app.getHttpServer()).get('/api/citizen/me').set('Authorization', `Bearer ${v.body.token}`).expect(200);
      expect(me.body.holdings).toHaveLength(1);
      expect(me.body.holdings[0].parcel.parcelNumber).toBe(STORY.livePossessionParcel);
      await request(app.getHttpServer()).get('/api/audit').set('Authorization', `Bearer ${v.body.token}`).expect(403);
      const list = await request(app.getHttpServer()).get('/api/parcels').set('Authorization', `Bearer ${v.body.token}`).expect(200);
      expect(list.body.total).toBe(1);
    });
  });
});
