import { INestApplication } from '@nestjs/common';
import * as crypto from 'crypto';
import request = require('supertest');
import * as device from '../../frontend/lib/field/bundle';
import { createApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDemo } from './reset';

// Smallest valid PNG (1×1 px).
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

/**
 * 6.10: bundles sealed on the device (with the same code the field app runs)
 * are re-verified by the server; tampering is refused and audited; repeats
 * are idempotent; a survey that crossed another officer's while offline is
 * kept as a conflict for the Collector.
 */
describe('Field evidence (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const as = (k: string) => ({ Authorization: `Bearer ${tokens[k]}` });
  const login = async (k: string, email: string) => {
    tokens[k] = (await request(app.getHttpServer()).post('/api/auth/dev-login').send({ email }).expect(200)).body.token;
  };
  let parcel: { id: string; centre: [number, number] };

  const makeBundle = (over: Partial<device.EvidenceBundle> = {}): device.EvidenceBundle => ({
    clientId: crypto.randomUUID(),
    deviceId: 'e2e-device-0001',
    parcelId: parcel.id,
    kind: 'POINT',
    geometry: { type: 'Point', coordinates: parcel.centre },
    accuracyM: 3.2,
    samples: 10,
    capturedAt: new Date(Date.now() - 60_000).toISOString(),
    baseSyncedAt: new Date().toISOString(),
    note: 'e2e point',
    photoHashes: [],
    positionSource: 'DEVICE_GNSS',
    ...over,
  });
  const upload = async (k: string, bundle: device.EvidenceBundle & { bundleHash?: string }, photos: Buffer[] = []) => {
    const req = request(app.getHttpServer()).post('/api/field/evidence').set(as(k)).field('bundle', JSON.stringify({ bundleHash: await device.sealBundle(bundle), ...bundle }));
    for (const [i, p] of photos.entries()) req.attach('photos', p, { filename: `p${i}.png`, contentType: 'image/png' });
    // Wrapped so awaiting the seal does not also send the request.
    return { expect: (status: number) => req.expect(status) };
  };

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDemo(app);
    prisma = app.get(PrismaService);
    await login('field', 'surveyor.wardha@demo.rnlam.in');
    await login('field2', 'surveyor2.wardha@demo.rnlam.in');
    await login('wardha', 'collector.wardha@demo.rnlam.in');
    const p = await prisma.parcel.findFirstOrThrow({ where: { parcelNumber: 'WRD-BRG-006' }, select: { id: true, geometry: true } });
    const ring = (p.geometry as { coordinates: number[][][] }).coordinates[0].slice(0, -1);
    parcel = { id: p.id, centre: [Math.round((ring.reduce((s, q) => s + q[0], 0) / ring.length) * 1e7) / 1e7, Math.round((ring.reduce((s, q) => s + q[1], 0) / ring.length) * 1e7) / 1e7] };
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a sealed point with a photo: seal re-verified, photo stored with its hash, position checked against the boundary', async () => {
    const photoHash = crypto.createHash('sha256').update(PNG).digest('hex');
    const b = makeBundle({ photoHashes: [photoHash] });
    const res = await (await upload('field', b, [PNG])).expect(200);
    expect(res.body.duplicate).toBe(false);
    expect(res.body.evidence).toMatchObject({ status: 'ACCEPTED', hashVerified: true, distanceM: 0, bundleHash: await device.sealBundle(b) });
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: res.body.evidence.photoDocumentIds[0] } });
    expect(doc).toMatchObject({ kind: 'FIELD_PHOTO', sha256: photoHash });
    expect(await prisma.auditEvent.count({ where: { action: 'FIELD_EVIDENCE_RECEIVED', entityId: res.body.evidence.id } })).toBe(1);

    // The same bundle again (a retry after a dropped connection) is not stored twice.
    const again = await (await upload('field', b, [PNG])).expect(200);
    expect(again.body).toMatchObject({ duplicate: true, evidence: { id: res.body.evidence.id } });
    // A different bundle reusing the clientId is refused.
    await (await upload('field', { ...b, note: 'changed' }, [PNG])).expect(409);
  });

  it('refuses and audits a bundle altered after sealing, and a swapped photo', async () => {
    const b = makeBundle();
    const seal = await device.sealBundle(b);
    const tampered = await request(app.getHttpServer())
      .post('/api/field/evidence')
      .set(as('field'))
      .field('bundle', JSON.stringify({ ...b, accuracyM: 1.0, bundleHash: seal }))
      .expect(422);
    expect(tampered.body.message).toMatch(/does not match its device seal/);
    const refused = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'FIELD_EVIDENCE_REFUSED' }, orderBy: { seq: 'desc' } });
    expect(refused.newState).toMatchObject({ clientId: b.clientId, deviceSeal: seal });

    const swapped = makeBundle({ photoHashes: ['0'.repeat(64)] });
    const res = await (await upload('field', swapped, [PNG])).expect(422);
    expect(res.body.message).toMatch(/Photo 1 does not match/);
    expect(await prisma.fieldEvidence.count({ where: { clientId: { in: [b.clientId, swapped.clientId] } } })).toBe(0);
  });

  it('measures how far a point is from the recorded boundary (about 1 km north here)', async () => {
    const res = await (await upload('field', makeBundle({ geometry: { type: 'Point', coordinates: [parcel.centre[0], parcel.centre[1] + 0.01] } }))).expect(200);
    expect(res.body.evidence.distanceM).toBeGreaterThan(900);
    expect(res.body.evidence.distanceM).toBeLessThan(1150);
  });

  it('keeps a survey that crossed another officer’s while offline as a CONFLICT; the Collector resolves it', async () => {
    const offlineSince = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const first = await (await upload('field', makeBundle({ note: 'shed present' }))).expect(200);
    const second = await (await upload('field2', makeBundle({ baseSyncedAt: offlineSince, note: 'plot vacant', deviceId: 'e2e-device-0002' }))).expect(200);
    expect(second.body.evidence).toMatchObject({ status: 'CONFLICT', conflictWithId: first.body.evidence.id });
    expect(second.body.evidence.conflictReason).toMatch(/after this device last synced/);

    await request(app.getHttpServer()).post(`/api/field/evidence/${second.body.evidence.id}/resolve`).set(as('field')).send({ decision: 'ACCEPT', note: 'Newer visit' }).expect(403);
    await request(app.getHttpServer()).post(`/api/field/evidence/${second.body.evidence.id}/resolve`).set(as('wardha')).send({ decision: 'ACCEPT', note: 'Re-visited on 23 Aug: the plot is vacant now' }).expect(201);
    const [a, b] = await Promise.all([first, second].map((r) => prisma.fieldEvidence.findUniqueOrThrow({ where: { id: r.body.evidence.id } })));
    expect(a.status).toBe('SUPERSEDED');
    expect(b.status).toBe('ACCEPTED');
  });

  it('refuses a parcel outside the officer’s jurisdiction, and lists evidence with the server time', async () => {
    const ytl = await prisma.parcel.findFirstOrThrow({ where: { districtCode: 'MH-YTL' }, select: { id: true } });
    await (await upload('field', makeBundle({ parcelId: ytl.id }))).expect(404);
    const list = await request(app.getHttpServer()).get(`/api/field/evidence?parcelId=${parcel.id}`).set(as('field')).expect(200);
    expect(new Date(list.body.serverTime).getTime()).toBeGreaterThan(0);
    expect(list.body.items.length).toBeGreaterThanOrEqual(4);
  });
});
