import { Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { Clock } from '../common/clock';
import { istDateString } from '../common/dates';
import { PrismaService } from '../prisma/prisma.service';
import { chainRoot, inclusionProof, merkleRoot, verifyInclusion } from './merkle';

const GENESIS_CHAIN = '0'.repeat(64);
const SEAL_LOCK_KEY = 7_201_300_003;
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Seal consecutive audit entries into one Merkle root per IST day. Completed
 * days are sealed automatically; `force` also seals the day in progress
 * (period "manual"). Shared by the service and the demo seed.
 */
export async function sealAudit(db: Db, now: Date, force = false) {
  const last = await db.merkleRoot.findFirst({ orderBy: { toSeq: 'desc' } });
  const entries = await db.auditEvent.findMany({
    where: last ? { seq: { gt: last.toSeq } } : undefined,
    orderBy: { seq: 'asc' },
    select: { seq: true, hash: true, timestamp: true },
  });
  const today = istDateString(now);
  const groups: Array<typeof entries> = [];
  for (const e of entries) {
    const day = istDateString(e.timestamp);
    if (!force && day >= today) break; // the current day is still open
    const g = groups[groups.length - 1];
    if (g && istDateString(g[0].timestamp) === day) g.push(e);
    else groups.push([e]);
  }
  let prevChain = last?.chainHash ?? GENESIS_CHAIN;
  const sealed = [];
  for (const g of groups) {
    const root = merkleRoot(g.map((e) => e.hash));
    const chainHash = chainRoot(prevChain, root);
    const times = g.map((e) => +e.timestamp);
    const row = await db.merkleRoot.create({
      data: {
        period: force && istDateString(g[0].timestamp) >= today ? 'manual' : istDateString(g[0].timestamp),
        fromSeq: g[0].seq,
        toSeq: g[g.length - 1].seq,
        leafCount: g.length,
        root,
        prevChain,
        chainHash,
        periodStart: new Date(Math.min(...times)),
        periodEnd: new Date(Math.max(...times)),
      },
    });
    sealed.push(row);
    prevChain = chainHash;
  }
  return { sealed: sealed.length, entries: sealed.reduce((s, r) => s + r.leafCount, 0) };
}

@Injectable()
export class MerkleService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Merkle');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  onApplicationBootstrap() {
    if (process.env.MERKLE_SEALER === 'off') return;
    this.timer = setInterval(() => void this.seal(false).catch((e) => this.logger.warn(`seal failed: ${e}`)), 60 * 60 * 1000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  seal(force: boolean) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEAL_LOCK_KEY}::bigint)`;
        return sealAudit(tx, this.clock.now(), force);
      },
      { timeout: 60_000 },
    );
  }

  roots(limit = 100) {
    return this.prisma.merkleRoot.findMany({ orderBy: { toSeq: 'desc' }, take: limit });
  }

  /** Recompute every root from the current entries, and the chain of roots. */
  async verifyRoots() {
    const roots = await this.prisma.merkleRoot.findMany({ orderBy: { toSeq: 'asc' } });
    const broken: Array<{ period: string; fromSeq: bigint; toSeq: bigint; kind: 'ROOT_MISMATCH' | 'ROOT_CHAIN_BROKEN' | 'ENTRIES_MISSING' }> = [];
    let prev = GENESIS_CHAIN;
    for (const r of roots) {
      const hashes = (await this.prisma.auditEvent.findMany({ where: { seq: { gte: r.fromSeq, lte: r.toSeq } }, orderBy: { seq: 'asc' }, select: { hash: true } })).map((e) => e.hash);
      if (hashes.length !== r.leafCount) broken.push({ period: r.period, fromSeq: r.fromSeq, toSeq: r.toSeq, kind: 'ENTRIES_MISSING' });
      else if (merkleRoot(hashes) !== r.root) broken.push({ period: r.period, fromSeq: r.fromSeq, toSeq: r.toSeq, kind: 'ROOT_MISMATCH' });
      if (r.prevChain !== prev || chainRoot(prev, r.root) !== r.chainHash) broken.push({ period: r.period, fromSeq: r.fromSeq, toSeq: r.toSeq, kind: 'ROOT_CHAIN_BROKEN' });
      prev = r.chainHash;
    }
    const lastSealed = roots[roots.length - 1]?.toSeq ?? 0n;
    const unsealed = await this.prisma.auditEvent.count({ where: { seq: { gt: lastSealed } } });
    return { roots: roots.length, valid: broken.length === 0, broken, unsealedEntries: unsealed, head: roots[roots.length - 1]?.chainHash ?? null };
  }

  /** Inclusion proof for one entry against the root that sealed it. */
  async proof(seq: bigint) {
    const entry = await this.prisma.auditEvent.findUnique({ where: { seq }, select: { seq: true, hash: true, action: true, entityType: true, entityId: true, timestamp: true } });
    if (!entry) throw new NotFoundException(`No audit entry #${seq}`);
    const r = await this.prisma.merkleRoot.findFirst({ where: { fromSeq: { lte: seq }, toSeq: { gte: seq } } });
    if (!r) return { entry, sealed: false, message: 'Not sealed yet: it will be included in the next root.' };
    const hashes = (await this.prisma.auditEvent.findMany({ where: { seq: { gte: r.fromSeq, lte: r.toSeq } }, orderBy: { seq: 'asc' }, select: { hash: true } })).map((e) => e.hash);
    const index = Number(seq - r.fromSeq);
    const path = inclusionProof(hashes, index);
    return {
      entry,
      sealed: true,
      root: { id: r.id, period: r.period, root: r.root, chainHash: r.chainHash, leafCount: r.leafCount, fromSeq: r.fromSeq, toSeq: r.toSeq },
      index,
      treeSize: r.leafCount,
      path,
      algorithm: 'RFC 6962: leaf = SHA-256(0x00 ‖ entryHash bytes), node = SHA-256(0x01 ‖ left ‖ right)',
      verified: verifyInclusion(entry.hash, index, r.leafCount, path, r.root),
    };
  }
}
