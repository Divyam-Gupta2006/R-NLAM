import { AuditHashFields, computeAuditHash, GENESIS_HASH, verifyAuditRows } from './audit-hash';

function chain(n: number) {
  let prev = GENESIS_HASH;
  const rows: Array<AuditHashFields & { seq: bigint; previousHash: string; hash: string }> = [];
  for (let i = 1; i <= n; i++) {
    const f: AuditHashFields = {
      id: `id-${i}`,
      actorId: 'u1',
      actorRole: 'DISTRICT_OFFICER',
      action: 'DECLARE_AWARD',
      entityType: 'Parcel',
      entityId: `p${i}`,
      previousState: { stage: 'DECLARED' },
      newState: { stage: 'AWARDED', totalPaise: String(1_000_00n * BigInt(i)) },
      reason: null,
      highlighted: false,
      requestId: null,
      timestamp: new Date(Date.UTC(2026, 8, i)),
    };
    const hash = computeAuditHash(prev, f);
    rows.push({ ...f, seq: BigInt(i), previousHash: prev, hash });
    prev = hash;
  }
  return rows;
}

describe('audit hash chain', () => {
  it('verifies an untouched chain of 50 entries', () => {
    const rows = chain(50);
    const r = verifyAuditRows(rows, GENESIS_HASH);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lastHash).toBe(rows[49].hash);
  });

  it('is independent of JSON key order in stored state (jsonb reorders keys)', () => {
    const rows = chain(3);
    rows[1].newState = { totalPaise: (rows[1].newState as { totalPaise: string }).totalPaise, stage: 'AWARDED' };
    expect(verifyAuditRows(rows, GENESIS_HASH).ok).toBe(true);
  });

  it('detects an edited amount as CONTENT_ALTERED at that entry', () => {
    const rows = chain(10);
    rows[6].newState = { stage: 'AWARDED', totalPaise: '1' };
    const r = verifyAuditRows(rows, GENESIS_HASH);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.break.kind).toBe('CONTENT_ALTERED');
      expect(r.break.seq).toBe(7n);
    }
  });

  it('detects a deleted entry as LINK_BROKEN at the next entry', () => {
    const rows = chain(10);
    rows.splice(3, 1);
    const r = verifyAuditRows(rows, GENESIS_HASH);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.break.kind).toBe('LINK_BROKEN');
      expect(r.break.seq).toBe(5n);
    }
  });

  it('detects a re-hashed forgery because the next link no longer matches', () => {
    const rows = chain(5);
    rows[1].action = 'WITHDRAW';
    rows[1].hash = computeAuditHash(rows[1].previousHash, rows[1]); // forger recomputes this row only
    const r = verifyAuditRows(rows, GENESIS_HASH);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.break).toMatchObject({ kind: 'LINK_BROKEN', seq: 3n });
  });
});
