import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { createApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDemo } from './reset';

/**
 * 6.13: the national command screen's numbers agree with the underlying
 * records, and the same screen is scoped for a state officer.
 */
describe('National command summary (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const as = (k: string) => ({ Authorization: `Bearer ${tokens[k]}` });
  const login = async (k: string, email: string) => {
    tokens[k] = (await request(app.getHttpServer()).post('/api/auth/dev-login').send({ email }).expect(200)).body.token;
  };

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDemo(app);
    prisma = app.get(PrismaService);
    await login('central', 'js.landreforms@demo.rnlam.in');
    await login('state', 'dy.secretary.mh@demo.rnlam.in');
  });

  afterAll(async () => {
    await app.close();
  });

  it('counts every parcel by project and stage, exactly as the table holds them', async () => {
    const s = (await request(app.getHttpServer()).get('/api/command/summary').set(as('central')).expect(200)).body;
    expect(s.projectsByStage).toHaveLength(await prisma.project.count());
    const total = s.projectsByStage.reduce((n: number, p: { total: number }) => n + p.total, 0);
    expect(total).toBe(await prisma.parcel.count());
    const wy = s.projectsByStage.find((p: { code: string }) => p.code === 'NH-WY-4L');
    expect(wy.stages.DECLARED).toBe(await prisma.parcel.count({ where: { project: { code: 'NH-WY-4L' }, stage: 'DECLARED' } }));
  });

  it('lists at most ten stuck projects, highest priority first, each with its top brief', async () => {
    const s = (await request(app.getHttpServer()).get('/api/command/summary').set(as('central')).expect(200)).body;
    expect(s.stuck.length).toBeGreaterThan(0);
    expect(s.stuck.length).toBeLessThanOrEqual(10);
    const priorities = s.stuck.map((p: { topPriority: number }) => p.topPriority);
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities);
    for (const p of s.stuck) expect(p.top.headline.length).toBeGreaterThan(10);
    expect(s.stuck[0].code).toBe('NH-WY-4L');
  });

  it('reports GIS-blocked parcels (the forest parcel among them), open SLA breaches and families awaiting R&R', async () => {
    const s = (await request(app.getHttpServer()).get('/api/command/summary').set(as('central')).expect(200)).body;
    expect(s.gis.blockedParcels).toBeGreaterThan(0);
    expect(s.gis.examples.map((e: { parcelNumber: string }) => e.parcelNumber)).toContain('YTL-KRS-004');

    const now = new Date(s.asOf);
    const breached = await prisma.sLATask.count({ where: { completedDate: null, targetDate: { lt: now } } });
    expect(s.sla.breached).toBe(breached);

    const waiting = await prisma.rRCase.count({ where: { grants: { some: { status: 'ASSIGNED' } } } });
    expect(s.rr.familiesAwaiting).toBe(waiting);
    expect(s.rr.byState.find((r: { stateName: string }) => r.stateName === 'Maharashtra').families).toBeGreaterThan(0);
  });

  it('is scoped: a Maharashtra officer sees only Maharashtra', async () => {
    const s = (await request(app.getHttpServer()).get('/api/command/summary').set(as('state')).expect(200)).body;
    expect(new Set(s.projectsByStage.map((p: { stateName: string }) => p.stateName))).toEqual(new Set(['Maharashtra']));
    expect(s.rr.byState.every((r: { stateName: string }) => r.stateName === 'Maharashtra')).toBe(true);
  });
});
