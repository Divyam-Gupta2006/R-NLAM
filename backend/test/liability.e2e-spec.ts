import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { Clock } from '../src/common/clock';
import { LiabilityService } from '../src/liability/liability.service';
import { createApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';

const big = (v: number | string) => BigInt(v);

/**
 * 6.2: live statutory cost of delay. The clock is pinned so amounts are exact.
 */
describe('Interest liability (e2e)', () => {
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
    prisma = app.get(PrismaService);
    app.get(Clock).pin(new Date('2026-09-29T12:00:00+05:30'));
    await app.get(LiabilityService).refresh();
    await login('central', 'js.landreforms@demo.rnlam.in');
    await login('wardha', 'collector.wardha@demo.rnlam.in');
    await login('finance', 'finance.mh@demo.rnlam.in');
  });

  afterAll(async () => {
    app.get(Clock).pin(null);
    await app.close();
  });

  it('reports s.80 interest on the urgency parcels, at the 15% stage after one year', async () => {
    const res = await request(app.getHttpServer()).get('/api/liability/summary').set(as('central')).expect(200);
    const t = res.body.totals;
    expect(t.s80Lines).toBe(4); // one unpaid co-holder on each of the four Borgaon urgency parcels
    expect(big(t.s80OutstandingPaise)).toBeGreaterThan(0n);
    expect(big(t.additionalAccruedPaise)).toBeGreaterThan(0n);
    expect(big(t.dailyPaise)).toBe(big(t.s80DailyPaise) + big(t.additionalDailyPaise));
    expect(res.body.trend).toHaveLength(13);
    expect(res.body.basis.map((b: { citation: string }) => b.citation).join(' ')).toContain('s.80');

    // 20 Aug 2025 possession → 29 Sep 2026 is past the anniversary, so each line accrues at 15%:
    const lines = await prisma.compensation.findMany({ where: { parcel: { urgencyOrderRef: { not: null } }, status: 'APPROVED' } });
    const expectedDaily = lines.reduce((s, c) => s + (c.amountPaise * 1500n * 2n + 10_000n * 365n) / (2n * 10_000n * 365n), 0n);
    expect(big(t.s80DailyPaise)).toBe(expectedDaily);
  });

  it('rolls up consistently: states sum to the nation, districts to their state', async () => {
    const summary = (await request(app.getHttpServer()).get('/api/liability/summary').set(as('central'))).body.totals;
    const states = (await request(app.getHttpServer()).get('/api/liability/rollup?level=state').set(as('central')).expect(200)).body;
    const sumStates = states.reduce((s: bigint, r: { totalAccruedPaise: number }) => s + big(r.totalAccruedPaise), 0n);
    expect(sumStates).toBe(big(summary.totalAccruedPaise));
    const mh = states.find((r: { code: string }) => r.code === 'MH');
    const districts = (await request(app.getHttpServer()).get('/api/liability/rollup?level=district&parent=MH').set(as('central')).expect(200)).body;
    expect(districts.reduce((s: bigint, r: { dailyPaise: number }) => s + big(r.dailyPaise), 0n)).toBe(big(mh.dailyPaise));
    const villages = (await request(app.getHttpServer()).get('/api/liability/rollup?level=village&parent=MH-WRD').set(as('central')).expect(200)).body;
    expect(villages.some((v: { name: string }) => v.name === 'Borgaon')).toBe(true);
  });

  it('scopes to the caller: the Wardha Collector sees only Wardha', async () => {
    const rows = (await request(app.getHttpServer()).get('/api/liability/rollup?level=district').set(as('wardha')).expect(200)).body;
    expect(rows.map((r: { code: string }) => r.code)).toEqual(['MH-WRD']);
  });

  it('ranks what acting this week saves, and paying one line removes it from the ranking', async () => {
    const top = (await request(app.getHttpServer()).get('/api/liability/top?limit=10').set(as('central')).expect(200)).body;
    expect(top.payCompensation).toHaveLength(4);
    expect(top.declareAward.length).toBeGreaterThan(0);
    const first = top.payCompensation[0];
    // Unpaid for another year at 15%: saving = principal × 15%
    const comp = await prisma.compensation.findUniqueOrThrow({ where: { id: first.compensationId } });
    expect(big(first.savingPaise)).toBe((comp.amountPaise * 1500n * 365n * 2n + 10_000n * 365n) / (2n * 10_000n * 365n));

    const before = big((await request(app.getHttpServer()).get('/api/liability/summary').set(as('central'))).body.totals.s80DailyPaise);
    await prisma.compensation.update({ where: { id: first.compensationId }, data: { bankAccountLast4: '1234' } });
    await request(app.getHttpServer()).post(`/api/compensation/${first.compensationId}/pay`).set(as('finance')).expect(200);
    await app.get(LiabilityService).refresh();
    const after = (await request(app.getHttpServer()).get('/api/liability/top?limit=10').set(as('central'))).body;
    expect(after.payCompensation.map((x: { compensationId: string }) => x.compensationId)).not.toContain(first.compensationId);
    const afterDaily = big((await request(app.getHttpServer()).get('/api/liability/summary').set(as('central'))).body.totals.s80DailyPaise);
    expect(afterDaily).toBeLessThan(before);
  });
});
