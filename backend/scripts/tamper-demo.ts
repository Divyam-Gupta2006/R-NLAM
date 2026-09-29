/**
 * Demonstrates tamper detection. Plays an insider with database access who
 * quietly changes an award amount in the audit trail, bypassing the API.
 *
 *   npm run demo:tamper    edit one sealed award entry (original saved)
 *   (open Audit trail → Verify now: the break and the broken day's root show)
 *   npm run demo:restore   put the original back byte for byte
 */
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';

const BACKUP = path.join(process.cwd(), 'storage', 'tamper-demo-backup.json');

async function tamper(prisma: PrismaClient) {
  try {
    await fs.access(BACKUP);
    console.log('A tamper is already in place. Run "npm run demo:restore" first.');
    return;
  } catch {
    /* no backup yet: go ahead */
  }
  const victim = await prisma.auditEvent.findFirst({ where: { action: 'DECLARE_AWARD' }, orderBy: { seq: 'asc' } });
  if (!victim) throw new Error('No award entry to tamper with; seed the demo first');
  await fs.mkdir(path.dirname(BACKUP), { recursive: true });
  await fs.writeFile(BACKUP, JSON.stringify({ seq: victim.seq.toString(), newState: victim.newState }, null, 2));
  const state = { ...(victim.newState as Record<string, unknown>) };
  const before = String(state.totalPaise ?? '');
  state.totalPaise = String(BigInt(before || '0') * 3n); // triple the award, quietly
  // Raw SQL: exactly what someone with database access could do, bypassing the API.
  await prisma.$executeRaw`UPDATE "AuditEvent" SET "newState" = ${JSON.stringify(state)}::jsonb WHERE seq = ${victim.seq}`;
  console.log(`Tampered with audit entry #${victim.seq} (${victim.entityType} ${victim.entityId}):`);
  console.log(`  totalPaise ${before} → ${state.totalPaise}`);
  console.log('Now open Audit trail → Verify now, or GET /api/audit/verify.');
}

async function restore(prisma: PrismaClient) {
  let saved: { seq: string; newState: unknown };
  try {
    saved = JSON.parse(await fs.readFile(BACKUP, 'utf8'));
  } catch {
    console.log('Nothing to restore.');
    return;
  }
  await prisma.$executeRaw`UPDATE "AuditEvent" SET "newState" = ${JSON.stringify(saved.newState)}::jsonb WHERE seq = ${BigInt(saved.seq)}`;
  await fs.unlink(BACKUP);
  console.log(`Restored audit entry #${saved.seq}. Verify again: the chain and roots check out.`);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    if (process.argv[2] === 'restore') await restore(prisma);
    else await tamper(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
