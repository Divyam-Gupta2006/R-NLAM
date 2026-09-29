import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { createApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDemo } from './reset';

/** 6.6: the parcel's digital thread comes from the audit chain; the graph layers project → notices → parcels → holders → cases. */
describe('Digital thread and parcel graph (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token = '';
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDemo(app);
    prisma = app.get(PrismaService);
    token = (await request(app.getHttpServer()).post('/api/auth/dev-login').send({ email: 'collector.wardha@demo.rnlam.in' }).expect(200)).body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('tells a handed-over parcel’s story in order, each step carrying its audit hash', async () => {
    const parcel = await prisma.parcel.findFirstOrThrow({ where: { stage: 'HANDED_OVER', districtCode: 'MH-WRD' }, orderBy: { parcelNumber: 'asc' } });
    const res = await request(app.getHttpServer()).get(`/api/thread/parcels/${parcel.id}`).set(auth()).expect(200);
    const titles: string[] = res.body.items.map((i: { title: string }) => i.title);
    const at = (t: string) => titles.findIndex((x) => x.startsWith(t));
    for (const t of ['Preliminary notification (s.11)', 'Declaration (s.19)', 'Award declared (s.23)', 'Payment credited', 'Possession taken (s.38)', 'Handed over']) expect(at(t)).toBeGreaterThanOrEqual(0);
    expect(at('Preliminary notification (s.11)')).toBeLessThan(at('Declaration (s.19)'));
    expect(at('Award declared (s.23)')).toBeLessThan(at('Possession taken (s.38)'));
    expect(at('Possession taken (s.38)')).toBeLessThan(at('Handed over'));
    for (const i of res.body.items) expect(i.hash).toMatch(/^[0-9a-f]{64}$/);
    // The hashes are the chain's own: the same rows the integrity check recomputes.
    const first = res.body.items[0];
    const row = await prisma.auditEvent.findUniqueOrThrow({ where: { hash: first.hash } });
    expect(row.entityId).toBe(first.entityId);
  });

  it('includes the identity dispute on the Wankhede parcel', async () => {
    const parcel = await prisma.parcel.findFirstOrThrow({ where: { parcelNumber: 'WRD-SLK-003' } });
    const res = await request(app.getHttpServer()).get(`/api/thread/parcels/${parcel.id}`).set(auth()).expect(200);
    expect(res.body.items.some((i: { title: string }) => i.title === 'Payment held: identity mismatch')).toBe(true);
  });

  it('lays out project → notices → parcels → holders → cases for a village', async () => {
    const project = await prisma.project.findUniqueOrThrow({ where: { code: 'NH-WY-4L' } });
    const village = await prisma.jurisdiction.findUniqueOrThrow({ where: { code: 'MH-WRD-SWG' } });
    const g = (await request(app.getHttpServer()).get(`/api/thread/projects/${project.id}/graph?villageId=${village.id}`).set(auth()).expect(200)).body;
    const layers = new Set(g.nodes.map((n: { layer: number }) => n.layer));
    expect([...layers].sort()).toEqual([0, 1, 2, 3, 4]); // Sawangi has a resolved objection
    const parcels = g.nodes.filter((n: { kind: string }) => n.kind === 'parcel');
    expect(parcels.length).toBe(8);
    for (const e of g.edges) {
      expect(g.nodes.some((n: { id: string }) => n.id === e.from)).toBe(true);
      expect(g.nodes.some((n: { id: string }) => n.id === e.to)).toBe(true);
    }
  });
});
