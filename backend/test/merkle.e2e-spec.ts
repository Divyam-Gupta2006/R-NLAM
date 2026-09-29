import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { verifyInclusion } from '../src/audit/merkle';
import { createApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDemo } from './reset';

/** 6.7: daily Merkle roots over the chain, inclusion proofs, and tamper detection at both levels. */
describe('Audit Merkle roots (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const as = (k: string) => ({ Authorization: `Bearer ${tokens[k]}` });

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDemo(app);
    prisma = app.get(PrismaService);
    for (const [k, email] of [['central', 'js.landreforms@demo.rnlam.in'], ['wardha', 'collector.wardha@demo.rnlam.in']]) {
      tokens[k] = (await request(app.getHttpServer()).post('/api/auth/dev-login').send({ email }).expect(200)).body.token;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('seeded history is sealed day by day and verifies', async () => {
    const v = (await request(app.getHttpServer()).get('/api/audit/verify').set(as('central')).expect(200)).body;
    expect(v.valid).toBe(true);
    expect(v.merkle.roots).toBeGreaterThan(100);
    expect(v.merkle.valid).toBe(true);
  });

  it('gives an inclusion proof that verifies independently of the server', async () => {
    const entry = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'DECLARE_AWARD' }, orderBy: { seq: 'asc' } });
    const p = (await request(app.getHttpServer()).get(`/api/audit/entries/${entry.seq}/proof`).set(as('wardha')).expect(200)).body;
    expect(p.sealed).toBe(true);
    expect(p.verified).toBe(true);
    expect(verifyInclusion(entry.hash, p.index, p.treeSize, p.path, p.root.root)).toBe(true);
  });

  it('detects an insider edit at the chain and at the day’s Merkle root, then clears on restore', async () => {
    const victim = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'DECLARE_AWARD' }, orderBy: { seq: 'asc' } });
    const original = victim.newState;
    await prisma.$executeRaw`UPDATE "AuditEvent" SET "newState" = ${JSON.stringify({ ...(original as object), totalPaise: '1' })}::jsonb WHERE seq = ${victim.seq}`;
    // Content edit: chain recomputation catches it (the stored hash no longer matches)
    const bad = (await request(app.getHttpServer()).get('/api/audit/verify').set(as('central')).expect(200)).body;
    expect(bad.valid).toBe(false);
    expect(bad.break).toMatchObject({ kind: 'CONTENT_ALTERED', seq: Number(victim.seq) });

    // A cleverer insider also rewrites the stored hash; the day's Merkle root no longer matches.
    await prisma.$executeRaw`UPDATE "AuditEvent" SET hash = ${'f'.repeat(64)} WHERE seq = ${victim.seq}`;
    const worse = (await request(app.getHttpServer()).get('/api/audit/verify').set(as('central')).expect(200)).body;
    expect(worse.merkle.valid).toBe(false);
    expect(worse.merkle.broken[0].kind).toBe('ROOT_MISMATCH');

    await prisma.$executeRaw`UPDATE "AuditEvent" SET "newState" = ${JSON.stringify(original)}::jsonb, hash = ${victim.hash} WHERE seq = ${victim.seq}`;
    const ok = (await request(app.getHttpServer()).get('/api/audit/verify').set(as('central')).expect(200)).body;
    expect(ok.valid).toBe(true);
  });

  it('seals today’s new entries on demand (senior officers only)', async () => {
    const before = (await request(app.getHttpServer()).get('/api/audit/verify').set(as('central'))).body.merkle;
    await request(app.getHttpServer()).post('/api/statutory/recompute').set(as('central')).expect(200); // writes an audit entry
    await request(app.getHttpServer()).post('/api/audit/merkle/seal').set(as('wardha')).expect(403);
    const s = (await request(app.getHttpServer()).post('/api/audit/merkle/seal').set(as('central')).expect(200)).body;
    expect(s.sealed).toBeGreaterThanOrEqual(1);
    const after = (await request(app.getHttpServer()).get('/api/audit/verify').set(as('central'))).body.merkle;
    expect(after.roots).toBeGreaterThan(before.roots);
    expect(after.unsealedEntries).toBe(0);
    expect(after.valid).toBe(true);
  });
});
