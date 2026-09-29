import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { createApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDemo } from './reset';

interface Link {
  id: string;
  score: number;
  status: string;
  reasons: Array<{ signal: string; detail: string; weight: number }>;
  courtCase: { cnr: string; caseNumber: string; isSynthetic: boolean };
  parcel: { id: string; parcelNumber: string };
}
interface B {
  key: string;
  type: string;
  title: string;
  evidence: Array<{ label: string; detail: string; citation?: string }>;
  brief: { headline: string; deadline: string | null };
}

/**
 * 6.9: synthetic eCourts cases are matched to parcels as candidates with
 * reasons; only an officer's confirmation makes a case count, and confirmed
 * blocking cases (title suits, stay orders) feed "Why is it stuck?".
 */
describe('Court case links (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const as = (k: string) => ({ Authorization: `Bearer ${tokens[k]}` });
  const login = async (k: string, email: string) => {
    tokens[k] = (await request(app.getHttpServer()).post('/api/auth/dev-login').send({ email }).expect(200)).body.token;
  };
  const links = async (k: string, q = ''): Promise<Link[]> => (await request(app.getHttpServer()).get(`/api/court-links${q}`).set(as(k)).expect(200)).body;
  const stuck = async (k: string): Promise<B[]> => (await request(app.getHttpServer()).get('/api/stuck/bottlenecks').set(as(k)).expect(200)).body;
  const byCase = (ls: Link[], caseNumber: string) => ls.find((l) => l.courtCase.caseNumber === caseNumber)!;
  const review = (k: string, id: string, body: object) => request(app.getHttpServer()).post(`/api/court-links/${id}/review`).set(as(k)).send(body);

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDemo(app);
    prisma = app.get(PrismaService);
    await login('wardha', 'collector.wardha@demo.rnlam.in');
    await login('yavatmal', 'collector.yavatmal@demo.rnlam.in');
    await login('field', 'surveyor.wardha@demo.rnlam.in');
  });

  afterAll(async () => {
    await app.close();
  });

  it('proposes candidates with reasons, per jurisdiction, and leaves near-misses out', async () => {
    const y = await links('yavatmal');
    expect(y.map((l) => `${l.courtCase.caseNumber}→${l.parcel.parcelNumber}`).sort()).toEqual(['SCS 118/2025→YTL-BBL-005', 'SCS 131/2025→YTL-KRS-004']);
    expect(y.every((l) => l.status === 'CANDIDATE' && l.courtCase.isSynthetic)).toBe(true);
    expect(byCase(y, 'SCS 118/2025').reasons.map((r) => r.signal)).toEqual(['SURVEY_EXACT', 'VILLAGE', 'PARTY_NAME']);
    // RCS 64/2024 cites survey 311/4 but in Kalamb; SCC 845/2025 names a holder but no land.
    expect(y.some((l) => ['RCS 64/2024', 'SCC 845/2025'].includes(l.courtCase.caseNumber))).toBe(false);

    const w = await links('wardha');
    expect(w).toHaveLength(4);
    expect(byCase(w, 'RCS 211/2024')).toMatchObject({ score: 0.55, parcel: { parcelNumber: 'WRD-SLK-003' } });
  });

  it('an unconfirmed case does not count; confirming a title suit adds a litigation bottleneck with the CNR', async () => {
    const forest = byCase(await links('yavatmal'), 'SCS 131/2025');
    expect((await stuck('yavatmal')).find((b) => b.key === `LIT:${forest.parcel.id}`)).toBeUndefined();

    await review('field', forest.id, { decision: 'CONFIRM' }).expect(403);
    const res = await review('yavatmal', forest.id, { decision: 'CONFIRM', note: 'Same survey number and owner; suit disputes forest classification' }).expect(201);
    expect(res.body.status).toBe('CONFIRMED');

    const lit = (await stuck('yavatmal')).find((b) => b.key === `LIT:${forest.parcel.id}`)!;
    expect(lit).toBeDefined();
    expect(lit.evidence.some((e) => e.citation === 'CNR MHYT020051902025' && /synthetic eCourts record/.test(e.detail))).toBe(true);

    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'COURT_CASE_LINK_CONFIRMED', entityId: forest.id } });
    expect(audit.newState).toMatchObject({ cnr: 'MHYT020051902025', parcelNumber: 'YTL-KRS-004' });
    const thread = await request(app.getHttpServer()).get(`/api/thread/parcels/${forest.parcel.id}`).set(as('yavatmal')).expect(200);
    expect(thread.body.items.some((i: { entityType: string }) => i.entityType === 'CaseLink')).toBe(true);
  });

  it('the escalated title objection now names the pending suit once confirmed; unconfirmed links are flagged', async () => {
    const suit = byCase(await links('yavatmal'), 'SCS 118/2025');
    const before = (await stuck('yavatmal')).find((b) => b.key === `LIT:${suit.parcel.id}`)!;
    expect(before.evidence.some((e) => e.label === 'Unconfirmed court links')).toBe(true);
    await review('yavatmal', suit.id, { decision: 'CONFIRM' }).expect(201);
    const after = (await stuck('yavatmal')).find((b) => b.key === `LIT:${suit.parcel.id}`)!;
    expect(after.evidence[0]).toMatchObject({ label: 'SCS 118/2025, Civil Judge (Senior Division), Yavatmal', citation: 'CNR MHYT020045122025' });
    expect(after.evidence.some((e) => e.label === 'Unconfirmed court links')).toBe(false);
  });

  it('a stay order blocks; an s.64 reference without a stay does not; a namesake is rejected with a reason', async () => {
    const w = await links('wardha');
    const writ = byCase(w, 'WP 3345/2026');
    const lar = byCase(w, 'LAR 7/2026');
    const namesake = byCase(w, 'RCS 211/2024');
    await review('wardha', writ.id, { decision: 'CONFIRM' }).expect(201);
    await review('wardha', lar.id, { decision: 'CONFIRM' }).expect(201);
    await review('wardha', namesake.id, { decision: 'REJECT' }).expect(400);
    await review('wardha', namesake.id, { decision: 'REJECT', note: 'Suit is about S. No. 88/1 (right of way), not the acquired plot' }).expect(201);
    await review('wardha', namesake.id, { decision: 'CONFIRM' }).expect(400);

    const bs = await stuck('wardha');
    const held = bs.find((b) => b.key === `LIT:${writ.parcel.id}`)!;
    expect(held.brief.headline).toMatch(/court order holds up WRD-KRG-005: WP 3345\/2026/);
    expect(held.brief.deadline).toBe('2026-10-07');
    expect(bs.find((b) => b.key === `LIT:${lar.parcel.id}`)).toBeUndefined();
    expect(bs.find((b) => b.key === `LIT:${namesake.parcel.id}`)).toBeUndefined();
  });

  it('re-syncing keeps officer decisions and is audited', async () => {
    const before = await links('wardha');
    const r = await request(app.getHttpServer()).post('/api/court-links/sync').set(as('wardha')).expect(201);
    // Five links were decided above; only the Anji partition suit is still a candidate to refresh.
    expect(r.body).toMatchObject({ source: 'ECOURTS_SYNTHETIC', cases: 11, candidates: 1 });
    const after = await links('wardha');
    expect(after.map((l) => `${l.id}:${l.status}`).sort()).toEqual(before.map((l) => `${l.id}:${l.status}`).sort());
    expect(await prisma.auditEvent.count({ where: { action: 'COURT_CASES_SYNCED' } })).toBe(1);
  });
});
