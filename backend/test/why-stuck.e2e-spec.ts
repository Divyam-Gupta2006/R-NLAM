import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { Clock } from '../src/common/clock';
import { LiabilityService } from '../src/liability/liability.service';
import { createApp } from '../src/main';
import { resetDemo } from './reset';
import { PrismaService } from '../src/prisma/prisma.service';
import { StatutoryService } from '../src/statutory/statutory.service';

interface B {
  key: string;
  type: string;
  title: string;
  families: number;
  exposurePaise: number;
  parcels: Array<{ parcelNumber: string }>;
  evidence: Array<{ label: string; citation?: string }>;
  brief: { headline: string; blocked: string; why: string[]; impact: string; action: string; owner: { role: string; names: string[] }; deadline: string | null };
  score: { priority: number; raw: number; risk: { value: number; why: string }; money: { value: number; why: string }; families: { value: number; why: string }; adjustment: { factor: number } | null };
  decision: { decision: string; comment: string } | null;
}

/**
 * 6.4: every bottleneck across rules, GIS, objections, money, R&R and
 * litigation, scored explainably and turned into an action brief that
 * officers can accept or dispute.
 */
describe('Why-Stuck engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const as = (k: string) => ({ Authorization: `Bearer ${tokens[k]}` });
  const login = async (k: string, email: string) => {
    tokens[k] = (await request(app.getHttpServer()).post('/api/auth/dev-login').send({ email }).expect(200)).body.token;
  };
  const list = async (k = 'central', q = ''): Promise<B[]> => (await request(app.getHttpServer()).get(`/api/stuck/bottlenecks${q}`).set(as(k)).expect(200)).body;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDemo(app);
    prisma = app.get(PrismaService);
    app.get(Clock).pin(new Date('2026-09-29T12:00:00+05:30'));
    await app.get(StatutoryService).recomputeAll();
    await app.get(LiabilityService).refresh();
    await login('central', 'js.landreforms@demo.rnlam.in');
    await login('wardha', 'collector.wardha@demo.rnlam.in');
    await login('yavatmal', 'collector.yavatmal@demo.rnlam.in');
  });

  afterAll(async () => {
    app.get(Clock).pin(null);
    await app.close();
  });

  it('finds every kind of bottleneck in the story', async () => {
    const types = new Set((await list()).map((b) => b.type));
    for (const t of ['DECLARATION_AT_RISK', 'GIS_BLOCK', 'INTEREST_RUNNING', 'PAYMENT_OVERDUE', 'PAYMENT_HELD', 'PAYMENT_FAILED', 'RR_BLOCKING_POSSESSION', 'LITIGATION', 'AWARD_AT_RISK']) {
      expect(types).toContain(t);
    }
  });

  it('ranks the Wadgaon/Dhanora s.19 lapse first and explains every component', async () => {
    const [top] = await list();
    expect(top.type).toBe('DECLARATION_AT_RISK');
    expect(top.title).toMatch(/due in 37 days for 14 parcels in Wadgaon, Dhanora/);
    expect(top.score.risk.value).toBe(0.95); // 37 days − 30 days to hear objections = 7 days of slack
    expect(top.score.risk.why).toMatch(/7 days of slack/);
    expect(top.score.priority).toBeCloseTo(top.score.risk.value * top.score.money.value * top.score.families.value * 100, 0);
    expect(top.evidence.map((e) => e.citation)).toEqual(expect.arrayContaining(['RFCTLARR 2013, s.19(7)', 'RFCTLARR 2013, s.15(2)']));
    expect(top.brief.action).toMatch(/hearings/);
    expect(top.brief.owner.names.join()).toMatch(/Sameer Khan/); // Collector, Yavatmal
  });

  it('turns the forest overlap into a brief with GIS evidence, ₹ exposure and families', async () => {
    const gis = (await list()).find((b) => b.type === 'GIS_BLOCK')!;
    expect(gis.parcels[0].parcelNumber).toBe('YTL-KRS-004');
    expect(gis.families).toBe(3);
    expect(gis.exposurePaise).toBeGreaterThan(0);
    expect(gis.evidence[0].label).toMatch(/Kharshi Reserved Forest/);
    expect(gis.score.risk.why).toMatch(/forest clearance/);
    expect(gis.brief.action).toMatch(/forest clearance/);
  });

  it('treats running s.80 interest as money lost daily, not a missed deadline', async () => {
    const s80 = (await list()).filter((b) => b.type === 'INTEREST_RUNNING');
    expect(s80).toHaveLength(4);
    expect(s80[0].score.risk.value).toBe(0.9);
    expect(s80[0].score.risk.why).toMatch(/money is being lost every day/);
  });

  it('scopes to the caller: the Wardha Collector sees no Yavatmal bottlenecks', async () => {
    const mine = await list('wardha');
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.flatMap((b) => b.parcels.map((p) => p.parcelNumber)).every((n) => n.startsWith('WRD-'))).toBe(true);
  });

  it('a dispute is audited and halves the priority; acceptance keeps it', async () => {
    const [top] = await list();
    await request(app.getHttpServer()).post(`/api/stuck/bottlenecks/${encodeURIComponent(top.key)}/decision`).set(as('yavatmal')).send({ decision: 'DISPUTED', comment: 'Hearings already concluded yesterday; declaration draft is ready' }).expect(201);
    const after = (await list()).find((b) => b.key === top.key)!;
    expect(after.decision).toMatchObject({ decision: 'DISPUTED' });
    expect(after.score.adjustment?.factor).toBe(0.5);
    expect(after.score.priority).toBeCloseTo(top.score.priority / 2, 0);
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: top.key, action: 'BRIEF_DISPUTED' } });
    expect(audit.reason).toMatch(/Hearings already concluded/);

    await request(app.getHttpServer()).post(`/api/stuck/bottlenecks/${encodeURIComponent(top.key)}/decision`).set(as('yavatmal')).send({ decision: 'ACCEPTED', comment: 'Re-checked: two hearings pending next week' }).expect(201);
    const accepted = (await list()).find((b) => b.key === top.key)!;
    expect(accepted.decision?.decision).toBe('ACCEPTED');
    expect(accepted.score.priority).toBe(top.score.priority);
  });

  it('rephrasing never claims AI output without a model, and never alters the facts', async () => {
    const [top] = await list();
    const r = await request(app.getHttpServer()).post(`/api/stuck/bottlenecks/${encodeURIComponent(top.key)}/rephrase`).set(as('central')).send({ language: 'hi' }).expect(200);
    expect(r.body).toMatchObject({ provider: 'template', aiGenerated: false, language: 'en' });
    expect(r.body.note).toMatch(/Translation needs/);
    expect(r.body.text).toBe(r.body.source);
  });

  it('summarises by project, most stuck first', async () => {
    const res = await request(app.getHttpServer()).get('/api/stuck/projects').set(as('central')).expect(200);
    expect(res.body[0].code).toBe('NH-WY-4L');
    expect(res.body[0].bottlenecks).toBeGreaterThan(10);
  });
});
