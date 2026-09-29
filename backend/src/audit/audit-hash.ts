import * as crypto from 'crypto';
import { canonicalJson } from '../common/canonical-json';

export const GENESIS_HASH = '0'.repeat(64);

/** Exactly the stored fields that the hash commits to. */
export interface AuditHashFields {
  id: string;
  actorId: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState: unknown;
  newState: unknown;
  reason: string | null;
  highlighted: boolean;
  requestId: string | null;
  timestamp: Date;
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/** hash_n = SHA-256(hash_{n-1} ‖ "\n" ‖ canonicalJSON(fields_n)) */
export function computeAuditHash(previousHash: string, f: AuditHashFields): string {
  return sha256Hex(
    previousHash +
      '\n' +
      canonicalJson({
        id: f.id,
        actorId: f.actorId,
        actorRole: f.actorRole,
        action: f.action,
        entityType: f.entityType,
        entityId: f.entityId,
        previousState: f.previousState ?? null,
        newState: f.newState ?? null,
        reason: f.reason ?? null,
        highlighted: f.highlighted,
        requestId: f.requestId ?? null,
        timestamp: f.timestamp,
      }),
  );
}

export type ChainBreak =
  | { kind: 'LINK_BROKEN'; seq: bigint; id: string; expectedPreviousHash: string; storedPreviousHash: string }
  | { kind: 'CONTENT_ALTERED'; seq: bigint; id: string; expectedHash: string; storedHash: string };

/**
 * Walk rows in seq order and report the first break. `previousHash` is the
 * running hash before the first row given (GENESIS for a full scan).
 */
export function verifyAuditRows(
  rows: Array<AuditHashFields & { seq: bigint; previousHash: string; hash: string }>,
  previousHash: string,
): { ok: true; lastHash: string } | { ok: false; break: ChainBreak } {
  let running = previousHash;
  for (const row of rows) {
    if (row.previousHash !== running) {
      return {
        ok: false,
        break: { kind: 'LINK_BROKEN', seq: row.seq, id: row.id, expectedPreviousHash: running, storedPreviousHash: row.previousHash },
      };
    }
    const expected = computeAuditHash(running, row);
    if (expected !== row.hash) {
      return { ok: false, break: { kind: 'CONTENT_ALTERED', seq: row.seq, id: row.id, expectedHash: expected, storedHash: row.hash } };
    }
    running = row.hash;
  }
  return { ok: true, lastHash: running };
}
