import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { createApp } from '../src/main';
import { resetDemo } from './reset';
import { PrismaService } from '../src/prisma/prisma.service';
import { makePdf } from '../prisma/seed/pdf';

/**
 * 6.3: parcels overlapping constraint layers are hard-blocked in the backend
 * from award and possession until the required documents are on file.
 */
describe('GIS consent gate (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const as = (k: string) => ({ Authorization: `Bearer ${tokens[k]}` });
  const login = async (k: string, email: string) => {
    tokens[k] = (await request(app.getHttpServer()).post('/api/auth/dev-login').send({ email }).expect(200)).body.token;
  };
  const upload = (token: string, parcelId: string, kind: string, ref: string) =>
    request(app.getHttpServer())
      .post('/api/documents')
      .set(as(token))
      .field('kind', kind)
      .field('title', `${kind} ${ref}`)
      .field('parcelId', parcelId)
      .field('referenceNo', ref)
      .attach('file', makePdf(kind, [ref]), { filename: `${ref}.pdf`, contentType: 'application/pdf' });

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDemo(app);
    prisma = app.get(PrismaService);
    await login('yavatmal', 'collector.yavatmal@demo.rnlam.in');
    await login('wardha', 'collector.wardha@demo.rnlam.in');
    await login('gis', 'gis.mh@demo.rnlam.in');
    await login('field', 'surveyor.wardha@demo.rnlam.in');
    await login('stateAdmin', 'ps.revenue.mh@demo.rnlam.in');
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the forest parcel as blocked and the Scheduled Area parcel as satisfied', async () => {
    const res = await request(app.getHttpServer()).get('/api/gis/conflicts').set(as('yavatmal')).expect(200);
    const forest = res.body.find((c: { parcel: { parcelNumber: string } }) => c.parcel.parcelNumber === 'YTL-KRS-004');
    expect(forest.blocked).toBe(true);
    expect(forest.items.map((i: { kind: string }) => i.kind).sort()).toEqual(['FOREST', 'FRA_CLAIM']);
    expect(forest.items.find((i: { kind: string }) => i.kind === 'FOREST').overlapPct).toBeCloseTo(50, 0);
    const sa = res.body.find((c: { parcel: { parcelNumber: string } }) => c.parcel.parcelNumber === 'YTL-DHN-006');
    expect(sa.blocked).toBe(false);
    expect(sa.items[0]).toMatchObject({ kind: 'SCHEDULED_AREA', satisfied: true, overridable: false, citation: 'RFCTLARR 2013, s.41(3)' });
  });

  it('blocks the forest parcel’s award until forest clearance and FRA certificate are on file', async () => {
    const parcel = await prisma.parcel.findFirstOrThrow({ where: { parcelNumber: 'YTL-KRS-004' } });
    const blocked = await request(app.getHttpServer()).post('/api/awards').set(as('yavatmal')).send({ parcelId: parcel.id, awardDate: '2026-09-29' }).expect(409);
    const codes = blocked.body.blockers.map((b: { code: string }) => b.code).sort();
    expect(codes).toEqual(['GIS_FOREST_OVERLAP', 'GIS_FRA_CLAIM_OVERLAP']);
    expect(blocked.body.blockers[0].unblockedBy.length).toBeGreaterThan(0);

    await upload('yavatmal', parcel.id, 'FOREST_CLEARANCE', 'FC-8-12-2026').expect(201);
    const stillBlocked = await request(app.getHttpServer()).post('/api/awards').set(as('yavatmal')).send({ parcelId: parcel.id, awardDate: '2026-09-29' }).expect(409);
    // Forest land needs both clearance and settled forest rights; only the FRA certificate is now missing.
    for (const b of stillBlocked.body.blockers) expect(b.unblockedBy).toEqual(['FRA_SETTLEMENT_CERTIFICATE']);

    await upload('yavatmal', parcel.id, 'FRA_SETTLEMENT_CERTIFICATE', 'SDLC-KHR-07-2026').expect(201);
    await request(app.getHttpServer()).post('/api/awards').set(as('yavatmal')).send({ parcelId: parcel.id, awardDate: '2026-09-29' }).expect(201);
  });

  it('screens every parcel as soon as a new layer is loaded, and only GIS roles may load one', async () => {
    const target = await prisma.parcel.findFirstOrThrow({ where: { parcelNumber: 'YTL-BBL-002' } });
    const ring = (target.geometry as { coordinates: number[][][] }).coordinates[0];
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    const pad = 0.002;
    const geojson = { type: 'Polygon', coordinates: [[[Math.min(...xs) - pad, Math.min(...ys) - pad], [Math.max(...xs) + pad, Math.min(...ys) - pad], [Math.max(...xs) + pad, Math.max(...ys) + pad], [Math.min(...xs) - pad, Math.max(...ys) + pad], [Math.min(...xs) - pad, Math.min(...ys) - pad]]] };
    const body = { code: 'TEST-FOREST-BBL', kind: 'FOREST', name: 'Test forest over Babhulgaon', source: 'e2e', geojson };

    await request(app.getHttpServer()).post('/api/gis/layers').set(as('field')).send(body).expect(403);
    const loaded = await request(app.getHttpServer()).post('/api/gis/layers').set(as('gis')).send(body).expect(201);
    expect(loaded.body.overlaps).toBeGreaterThanOrEqual(4);

    const gate = await request(app.getHttpServer()).get(`/api/gis/parcels/${target.id}/gate`).set(as('yavatmal')).expect(200);
    expect(gate.body[0]).toMatchObject({ layerCode: 'TEST-FOREST-BBL', satisfied: false });
    expect(gate.body[0].overlapPct).toBeCloseTo(100, 0);
  });

  it('allows a senior officer to override a forest block with a reason, recorded as a highlighted audit entry', async () => {
    const target = await prisma.parcel.findFirstOrThrow({ where: { parcelNumber: 'YTL-BBL-002' } });
    await request(app.getHttpServer()).post('/api/awards').set(as('yavatmal')).send({ parcelId: target.id, awardDate: '2026-09-29' }).expect(409);
    await request(app.getHttpServer())
      .post('/api/awards')
      .set(as('stateAdmin'))
      .send({ parcelId: target.id, awardDate: '2026-09-29', override: true, reason: 'Stage-I forest clearance FC/2026/88 granted; certified copy awaited' })
      .expect(201);
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: target.id, action: 'DECLARE_AWARD_OVERRIDE' } });
    expect(audit.highlighted).toBe(true);
    expect(audit.actorRole).toBe('STATE_ADMIN');
  });
});
