import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { AuthUser } from '../auth/auth.types';
import { canonicalJson } from '../common/canonical-json';
import { Clock } from '../common/clock';
import { PrismaService } from '../prisma/prisma.service';
import { computeAuditHash, GENESIS_HASH, verifyAuditRows } from './audit-hash';

export type Tx = Prisma.TransactionClient;

export interface AuditInput {
  actor: AuthUser | 'SYSTEM';
  action: string;
  entityType: string;
  entityId: string;
  previousState?: unknown;
  newState?: unknown;
  reason?: string | null;
  highlighted?: boolean;
  requestId?: string | null;
}

/** Arbitrary key for the advisory lock that serialises chain appends. */
const AUDIT_LOCK_KEY = 7_201_300_001;

/** Round-trip through canonical JSON so what we store is exactly what we hashed. */
function toStoredJson(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (v === undefined || v === null) return Prisma.JsonNull;
  return JSON.parse(canonicalJson(v)) as Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  /**
   * Append one entry. Must run inside the caller's transaction so the audit row
   * commits or rolls back together with the change it describes.
   */
  async append(tx: Tx, input: AuditInput) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_LOCK_KEY}::bigint)`;
    const last = await tx.auditEvent.findFirst({ orderBy: { seq: 'desc' }, select: { hash: true } });
    const previousHash = last?.hash ?? GENESIS_HASH;

    const actor = input.actor === 'SYSTEM' ? null : input.actor;
    const previousState = input.previousState === undefined ? null : JSON.parse(canonicalJson(input.previousState));
    const newState = input.newState === undefined ? null : JSON.parse(canonicalJson(input.newState));
    const fields = {
      id: crypto.randomUUID(),
      actorId: actor?.id ?? null,
      actorRole: actor?.role ?? 'SYSTEM',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      previousState,
      newState,
      reason: input.reason ?? null,
      highlighted: input.highlighted ?? false,
      requestId: input.requestId ?? null,
      // Postgres keeps milliseconds; truncate so the stored value hashes identically.
      timestamp: new Date(Math.floor(this.clock.now().getTime())),
    };
    const hash = computeAuditHash(previousHash, fields);

    return tx.auditEvent.create({
      data: {
        ...fields,
        previousState: toStoredJson(previousState),
        newState: toStoredJson(newState),
        previousHash,
        hash,
      },
    });
  }

  /** Convenience for writes that are not already inside a transaction. */
  async log(input: AuditInput) {
    return this.prisma.$transaction((tx) => this.append(tx, input));
  }

  async list(filter: { entityType?: string; entityId?: string; highlightedOnly?: boolean; limit?: number }) {
    return this.prisma.auditEvent.findMany({
      where: {
        entityType: filter.entityType,
        entityId: filter.entityId,
        highlighted: filter.highlightedOnly ? true : undefined,
      },
      include: { user: { select: { name: true, role: true, designation: true } } },
      orderBy: { seq: 'desc' },
      take: Math.min(filter.limit ?? 100, 500),
    });
  }

  /** Recompute every hash from genesis, in batches, and report the first break. */
  async verify() {
    const started = Date.now();
    const batch = 2000;
    let cursor: bigint | undefined;
    let running = GENESIS_HASH;
    let checked = 0;

    for (;;) {
      const rows = await this.prisma.auditEvent.findMany({
        where: cursor === undefined ? undefined : { seq: { gt: cursor } },
        orderBy: { seq: 'asc' },
        take: batch,
      });
      if (rows.length === 0) break;
      const result = verifyAuditRows(
        rows.map((r) => ({ ...r, previousState: r.previousState, newState: r.newState })),
        running,
      );
      if (!result.ok) {
        const brokenIndex = rows.findIndex((r) => r.seq === result.break.seq);
        return {
          valid: false,
          checked: checked + Math.max(brokenIndex, 0),
          break: result.break,
          headHash: null,
          durationMs: Date.now() - started,
          message:
            result.break.kind === 'CONTENT_ALTERED'
              ? `Entry #${result.break.seq} was modified after it was written.`
              : `The chain is broken before entry #${result.break.seq} (an entry was removed or reordered).`,
        };
      }
      running = result.lastHash;
      checked += rows.length;
      cursor = rows[rows.length - 1].seq;
    }

    return {
      valid: true,
      checked,
      break: null,
      headHash: running,
      durationMs: Date.now() - started,
      message: `All ${checked} audit entries verified; chain head ${running.slice(0, 12)}…`,
    };
  }
}
