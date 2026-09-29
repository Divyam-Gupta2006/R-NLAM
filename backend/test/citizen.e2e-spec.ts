import { INestApplication } from '@nestjs/common';
import * as crypto from 'crypto';
import request = require('supertest');
import { s80Interest } from '../src/liability/liability';
import { LiabilityService } from '../src/liability/liability.service';
import { createApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDemo } from './reset';

/**
 * 6.11: a land holder signs in with an OTP and sees only their own land, the
 * interest the law says is owed to them, their documents (with a DigiLocker
 * issue), and a grievance trail that officers answer.
 */
describe('Citizen services (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const as = (k: string) => ({ Authorization: `Bearer ${tokens[k]}` });
  const citizen = async (k: string, phone: string) => {
    const otp = (await request(app.getHttpServer()).post('/api/auth/citizen/otp').send({ phone }).expect(200)).body;
    tokens[k] = (await request(app.getHttpServer()).post('/api/auth/citizen/verify').send({ requestId: otp.requestId, code: otp.devOtp }).expect(200)).body.token;
  };
  const officer = async (k: string, email: string) => {
    tokens[k] = (await request(app.getHttpServer()).post('/api/auth/dev-login').send({ email }).expect(200)).body.token;
  };

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDemo(app);
    prisma = app.get(PrismaService);
    await citizen('sunita', '9800000001');
    await citizen('namdeo', '9800000002');
    await officer('wardha', 'collector.wardha@demo.rnlam.in');
    await officer('yavatmal', 'collector.yavatmal@demo.rnlam.in');
  });

  afterAll(async () => {
    await app.close();
  });

  it('shows a holder only their own parcels, with any s.80 interest computed per compensation line', async () => {
    const me = (await request(app.getHttpServer()).get('/api/citizen/me').set(as('sunita')).expect(200)).body;
    expect(me.holdings.map((h: { parcel: { parcelNumber: string } }) => h.parcel.parcelNumber)).toEqual(['WRD-ANJ-002']);
    const lines = me.holdings[0].parcel.compensations;
    expect(lines.length).toBeGreaterThan(0);
    // Every line carries an interest field: null when paid before possession, else the accrued amount.
    for (const c of lines) {
      expect(c).toHaveProperty('interest');
      if (c.interest) expect(Number(c.interest.accruedPaise)).toBeGreaterThanOrEqual(0);
    }
    await request(app.getHttpServer()).get('/api/citizen/me').set(as('wardha')).expect(403);
  });

  it('when her compensation is unpaid after possession, she sees the s.80 interest owed (9% for the first year, then 15%)', async () => {
    const comp = await prisma.compensation.findFirstOrThrow({ where: { parcel: { parcelNumber: 'WRD-ANJ-002' }, person: { phone: '9800000001' } } });
    // Possession 400 days ago, so both rates apply (a year at 9%, then 15%).
    const takenOn = new Date(Date.now() - 400 * 86_400_000);
    const pos = await prisma.possession.findFirstOrThrow({ where: { parcelId: comp.parcelId } });
    await prisma.possession.update({ where: { id: pos.id }, data: { takenOn } });
    await prisma.compensation.update({ where: { id: comp.id }, data: { paidOn: null, status: 'APPROVED' } });
    await app.get(LiabilityService).refresh();

    const me = (await request(app.getHttpServer()).get('/api/citizen/me').set(as('sunita')).expect(200)).body;
    const line = me.holdings[0].parcel.compensations.find((c: { id: string }) => c.id === comp.id);
    const expected = s80Interest(comp.amountPaise, takenOn, new Date(me.asOf), { firstYearBp: 900, afterYearBp: 1500, basis: 365 });
    expect(BigInt(line.interest.accruedPaise)).toBe(expected);
    expect(BigInt(line.interest.dailyPaise)).toBeGreaterThan(0n);
    expect(line.interest.ratesBp).toEqual([900, 1500]);
  });

  it('lodges a grievance with a CPGRAMS-style number, in the citizen’s language; officers answer; the citizen sees the reply', async () => {
    const parcel = await prisma.parcel.findFirstOrThrow({ where: { parcelNumber: 'YTL-KRS-004' } });
    const other = await prisma.parcel.findFirstOrThrow({ where: { parcelNumber: 'WRD-ANJ-002' } });
    await request(app.getHttpServer()).post('/api/citizen/grievances').set(as('namdeo')).send({ parcelId: other.id, category: 'OTHER', description: 'Not my land but let me try' }).expect(404);
    const g = (
      await request(app.getHttpServer())
        .post('/api/citizen/grievances')
        .set(as('namdeo'))
        .send({ parcelId: parcel.id, category: 'HEARING', description: 'सुनावणीची तारीख मला कळवली गेली नाही.', language: 'mr' })
        .expect(201)
    ).body;
    expect(g.registrationNo).toMatch(/^DOLR\/SYN\/\d{4}\/\d{7}$/);
    expect(g).toMatchObject({ channel: 'CPGRAMS_SYNTHETIC', status: 'RECEIVED', language: 'mr' });

    // Yavatmal sees it; Wardha does not.
    const ytl = (await request(app.getHttpServer()).get('/api/grievances').set(as('yavatmal')).expect(200)).body;
    expect(ytl.find((x: { id: string }) => x.id === g.id)).toMatchObject({ citizenName: 'Namdeo Dadarao Meshram', parcel: { parcelNumber: 'YTL-KRS-004' } });
    const wrd = (await request(app.getHttpServer()).get('/api/grievances').set(as('wardha')).expect(200)).body;
    expect(wrd.find((x: { id: string }) => x.id === g.id)).toBeUndefined();
    await request(app.getHttpServer()).post(`/api/grievances/${g.id}/reply`).set(as('wardha')).send({ status: 'RESOLVED', reply: 'Not in my district at all' }).expect(404);

    await request(app.getHttpServer()).post(`/api/grievances/${g.id}/reply`).set(as('yavatmal')).send({ status: 'RESOLVED', reply: 'Hearing notice re-sent by post and SMS; hearing on 14 October.' }).expect(201);
    const mine = (await request(app.getHttpServer()).get('/api/citizen/grievances').set(as('namdeo')).expect(200)).body;
    expect(mine.find((x: { id: string }) => x.id === g.id)).toMatchObject({ status: 'RESOLVED', reply: expect.stringContaining('re-sent') });
    expect(await prisma.auditEvent.count({ where: { entityId: g.id, action: { in: ['GRIEVANCE_LODGED', 'GRIEVANCE_RESOLVED'] } } })).toBe(2);
  });

  it('lists the holder’s public documents, downloads them hash-checked, and issues them to DigiLocker once', async () => {
    const docs = (await request(app.getHttpServer()).get('/api/citizen/documents').set(as('sunita')).expect(200)).body;
    const award = docs.find((d: { kind: string }) => d.kind === 'AWARD_COPY');
    expect(award).toMatchObject({ parcel: { parcelNumber: 'WRD-ANJ-002' }, digilocker: null });
    const file = await request(app.getHttpServer()).get(`/api/citizen/documents/${award.id}/download`).set(as('sunita')).buffer(true).expect(200);
    expect(crypto.createHash('sha256').update(file.body).digest('hex')).toBe(award.sha256);
    // Another holder cannot fetch it.
    await request(app.getHttpServer()).get(`/api/citizen/documents/${award.id}/download`).set(as('namdeo')).expect(404);

    const issue = (await request(app.getHttpServer()).post(`/api/citizen/documents/${award.id}/digilocker`).set(as('sunita')).expect(201)).body;
    expect(issue).toMatchObject({ channel: 'DIGILOCKER_SYNTHETIC', sha256: award.sha256 });
    expect(issue.uri).toMatch(/^digilocker-synthetic:\/\//);
    const again = (await request(app.getHttpServer()).post(`/api/citizen/documents/${award.id}/digilocker`).set(as('sunita')).expect(201)).body;
    expect(again.id).toBe(issue.id);
  });

  it('translation falls back to the originals, marked, when no provider is configured', async () => {
    const r = (await request(app.getHttpServer()).post('/api/i18n/translate').set(as('sunita')).send({ texts: ['Hearing adjourned.'], source: 'en', target: 'hi' }).expect(201)).body;
    expect(r).toEqual({ texts: ['Hearing adjourned.'], translated: false, provider: 'none', machine: false });
  });
});
