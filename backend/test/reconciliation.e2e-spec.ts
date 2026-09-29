import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { createApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDemo } from './reset';

interface Match {
  id: string;
  confidence: number;
  requiresHuman: boolean;
  status: string;
  reasons: Array<{ signal: string; detail: string }>;
  a: { id: string; name: string };
  b: { id: string; name: string };
}

/**
 * 6.5: the Devanagari 7/12 record and the Latin award-register record of the
 * same land holder are matched with reasons, queued for a human (money is
 * involved), and only a confirmation lets the held payment go out.
 */
describe('Owner reconciliation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const as = (k: string) => ({ Authorization: `Bearer ${tokens[k]}` });
  const login = async (k: string, email: string) => {
    tokens[k] = (await request(app.getHttpServer()).post('/api/auth/dev-login').send({ email }).expect(200)).body.token;
  };
  const queue = async (k: string, q = ''): Promise<Match[]> => (await request(app.getHttpServer()).get(`/api/reconciliation/queue${q}`).set(as(k)).expect(200)).body;
  const wankhede = (ms: Match[]) => ms.find((m) => [m.a.name, m.b.name].some((n) => n.includes('Wankhede')) && [m.a.name, m.b.name].some((n) => n.includes('वानखेडे')));

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDemo(app);
    prisma = app.get(PrismaService);
    await login('wardha', 'collector.wardha@demo.rnlam.in');
    await login('yavatmal', 'collector.yavatmal@demo.rnlam.in');
    await login('field', 'surveyor.wardha@demo.rnlam.in');
    await login('finance', 'finance.mh@demo.rnlam.in');
  });

  afterAll(async () => {
    await app.close();
  });

  it('queues the Devanagari/Latin pair for a human, with reasons, in Wardha only', async () => {
    const m = wankhede(await queue('wardha'))!;
    expect(m).toBeDefined();
    expect(m.status).toBe('PENDING');
    expect(m.requiresHuman).toBe(true);
    expect(m.confidence).toBeGreaterThanOrEqual(0.9);
    expect(m.reasons.map((r) => r.signal)).toEqual(expect.arrayContaining(['name', 'phonetic', 'father', 'village', 'parcel']));
    expect(m.reasons[0].detail).toMatch(/transliterated/);
    expect(wankhede(await queue('yavatmal'))).toBeUndefined();
  });

  it('does not queue lookalikes with different surnames', async () => {
    const names = (await queue('wardha')).map((m) => `${m.a.name} | ${m.b.name}`);
    expect(names.join('\n')).not.toMatch(/Thakre \| Sanjay Wamanrao Meshram/);
  });

  it('only acquisition or finance officers decide, with a comment; confirmation links the records and is audited', async () => {
    const m = wankhede(await queue('wardha'))!;
    await request(app.getHttpServer()).post(`/api/reconciliation/matches/${m.id}/decision`).set(as('field')).send({ decision: 'CONFIRM', comment: 'looks the same to me really' }).expect(403);
    await request(app.getHttpServer()).post(`/api/reconciliation/matches/${m.id}/decision`).set(as('wardha')).send({ decision: 'CONFIRM', comment: 'short' }).expect(400);
    await request(app.getHttpServer())
      .post(`/api/reconciliation/matches/${m.id}/decision`)
      .set(as('wardha'))
      .send({ decision: 'CONFIRM', comment: 'Met Shri Wankhede at Selu tehsil; 7/12 extract and bank passbook match' })
      .expect(200);
    const [pa, pb] = await Promise.all([prisma.person.findUniqueOrThrow({ where: { id: m.a.id } }), prisma.person.findUniqueOrThrow({ where: { id: m.b.id } })]);
    expect(pa.identityGroupId).toBeTruthy();
    expect(pa.identityGroupId).toBe(pb.identityGroupId);
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: m.id, action: 'IDENTITY_CONFIRM' } });
    expect(audit.reason).toMatch(/bank passbook/);
  });

  it('after confirmation the held payment can be released and paid', async () => {
    const held = await prisma.compensation.findFirstOrThrow({ where: { status: 'ON_HOLD', beneficiaryName: { contains: 'Wankhede' } } });
    await request(app.getHttpServer()).post(`/api/lifecycle/Compensation/${held.id}/transitions`).set(as('wardha')).send({ event: 'RELEASE', reason: 'Identity reconciled' }).expect(201);
    await prisma.compensation.update({ where: { id: held.id }, data: { bankAccountLast4: '4455' } });
    const paid = await request(app.getHttpServer()).post(`/api/compensation/${held.id}/pay`).set(as('finance')).expect(200);
    expect(paid.body.status).toBe('PAID');
  });

  it('a rerun keeps decided links, and a link can be undone', async () => {
    await request(app.getHttpServer()).post('/api/reconciliation/run').set(as('wardha')).expect(200);
    const confirmed = wankhede(await queue('wardha', '?status=CONFIRMED'))!;
    expect(confirmed.status).toBe('CONFIRMED');
    await request(app.getHttpServer()).post(`/api/reconciliation/matches/${confirmed.id}/decision`).set(as('wardha')).send({ decision: 'UNLINK', comment: 'Linked in error during testing' }).expect(200);
    const pa = await prisma.person.findUniqueOrThrow({ where: { id: confirmed.a.id } });
    expect(pa.identityGroupId).toBeNull();
  });
});
