'use client';

import { ShieldAlert, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { api } from '@/lib/api/client';
import type { AuditVerification } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { Spinner } from './ui';

export interface FullVerification extends AuditVerification {
  chainValid: boolean;
  merkle: {
    roots: number;
    valid: boolean;
    unsealedEntries: number;
    head: string | null;
    broken: Array<{ period: string; fromSeq: number; toSeq: number; kind: string }>;
  };
}

/**
 * Re-computes every audit hash and every sealed Merkle root on the server,
 * live, and shows the verdict.
 */
export function IntegrityBadge({ className, onResult }: { className?: string; onResult?: (r: FullVerification) => void }) {
  const [result, setResult] = useState<FullVerification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.get<FullVerification>('/audit/verify');
      setResult(r);
      onResult?.(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const ok = result?.valid;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} data-tour="integrity">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold',
          result === null && 'border-line bg-panel text-ink-muted',
          ok === true && 'border-bharat/30 bg-bharat-soft text-bharat',
          ok === false && 'border-danger/40 bg-danger-soft text-danger',
        )}
        role="status"
      >
        {ok === false ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        {result === null ? 'Integrity: not yet checked' : ok ? 'Integrity: Verified ✓' : 'Integrity: BROKEN'}
      </span>
      <button className="btn-ghost py-1" onClick={run} disabled={busy}>
        {busy && <Spinner />} Verify now
      </button>
      {result && (
        <span className="text-xs text-ink-muted">
          {result.message} · {result.merkle.roots} Merkle roots {result.merkle.valid ? 'match' : <strong className="text-danger">do not match ({result.merkle.broken.map((b) => b.period).join(', ')})</strong>}
          {result.merkle.unsealedEntries ? ` · ${result.merkle.unsealedEntries} entries awaiting the next seal` : ''} ({result.durationMs} ms)
        </span>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
