import { PrismaClient, RoleName } from '@prisma/client';
import * as crypto from 'crypto';
import { computeAuditHash, GENESIS_HASH } from '../../src/audit/audit-hash';
import { canonicalJson } from '../../src/common/canonical-json';

export interface SeedActor {
  id: string | null;
  role: RoleName | 'SYSTEM';
}

interface PendingTransition {
  entityType: string;
  entityId: string;
  event: string;
  from: string;
  to: string;
  at: Date;
  actor: SeedActor;
  reason?: string;
  context?: Record<string, unknown>;
}

interface PendingAudit {
  action: string;
  entityType: string;
  entityId: string;
  at: Date;
  actor: SeedActor;
  previousState?: unknown;
  newState?: unknown;
  reason?: string;
  highlighted?: boolean;
}

/**
 * Collects historical transitions and audit entries while the seed builds
 * records, then writes them in time order with a correctly hash-chained audit
 * trail, so verification and the digital thread work on seeded data exactly
 * as on live data.
 */
export class SeedHistory {
  private transitions: PendingTransition[] = [];
  private audits: PendingAudit[] = [];

  transition(t: PendingTransition) {
    this.transitions.push(t);
    this.audits.push({
      action: t.event,
      entityType: t.entityType,
      entityId: t.entityId,
      at: t.at,
      actor: t.actor,
      previousState: { state: t.from },
      newState: { state: t.to, ...(t.context ?? {}) },
      reason: t.reason,
    });
  }

  audit(a: PendingAudit) {
    this.audits.push(a);
  }

  async flush(prisma: PrismaClient) {
    const byTime = <T extends { at: Date }>(xs: T[]) => xs.map((x, i) => ({ x, i })).sort((a, b) => +a.x.at - +b.x.at || a.i - b.i).map((e) => e.x);

    const transitions = byTime(this.transitions);
    for (let i = 0; i < transitions.length; i += 500) {
      await prisma.stateTransition.createMany({
        data: transitions.slice(i, i + 500).map((t) => ({
          entityType: t.entityType,
          entityId: t.entityId,
          event: t.event,
          fromState: t.from,
          toState: t.to,
          actorId: t.actor.id,
          actorRole: t.actor.role === 'SYSTEM' ? null : t.actor.role,
          reason: t.reason ?? null,
          createdAt: t.at,
        })),
      });
    }

    let prev = GENESIS_HASH;
    const rows = byTime(this.audits).map((a) => {
      const fields = {
        id: crypto.randomUUID(),
        actorId: a.actor.id,
        actorRole: a.actor.role,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        previousState: a.previousState === undefined ? null : JSON.parse(canonicalJson(a.previousState)),
        newState: a.newState === undefined ? null : JSON.parse(canonicalJson(a.newState)),
        reason: a.reason ?? null,
        highlighted: a.highlighted ?? false,
        requestId: 'seed',
        timestamp: new Date(Math.floor(a.at.getTime())),
      };
      const hash = computeAuditHash(prev, fields);
      const row = { ...fields, previousHash: prev, hash };
      prev = hash;
      return row;
    });
    for (let i = 0; i < rows.length; i += 500) {
      // createMany preserves array order, so seq follows chain order.
      await prisma.auditEvent.createMany({
        data: rows.slice(i, i + 500).map((r) => ({
          ...r,
          previousState: r.previousState ?? undefined,
          newState: r.newState ?? undefined,
        })),
      });
    }
    return { transitions: transitions.length, audits: rows.length };
  }
}
