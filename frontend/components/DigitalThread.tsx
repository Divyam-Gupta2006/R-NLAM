'use client';

import { FileCheck2, Gavel, IndianRupee, Landmark, ShieldAlert, Users } from 'lucide-react';
import React, { useState } from 'react';
import { useApi } from '@/lib/api/hooks';
import { dateTimeIST } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DataState, EmptyState } from './ui';

interface ThreadItem {
  seq: number;
  at: string;
  category: 'LEGAL' | 'LAND' | 'MONEY' | 'PEOPLE' | 'EVIDENCE' | 'OVERSIGHT';
  title: string;
  detail: string | null;
  action: string;
  entityType: string;
  actor: string;
  highlighted: boolean;
  hash: string;
  previousHash: string;
}

const CAT: Record<ThreadItem['category'], { label: string; icon: React.ReactNode; dot: string }> = {
  LEGAL: { label: 'Legal', icon: <Gavel className="h-3 w-3" />, dot: 'bg-info text-white' },
  LAND: { label: 'Land', icon: <Landmark className="h-3 w-3" />, dot: 'bg-bharat text-white' },
  MONEY: { label: 'Money', icon: <IndianRupee className="h-3 w-3" />, dot: 'bg-saffron text-white' },
  PEOPLE: { label: 'People', icon: <Users className="h-3 w-3" />, dot: 'bg-navy text-white' },
  EVIDENCE: { label: 'Evidence', icon: <FileCheck2 className="h-3 w-3" />, dot: 'bg-ink-muted text-white' },
  OVERSIGHT: { label: 'Overrides', icon: <ShieldAlert className="h-3 w-3" />, dot: 'bg-danger text-white' },
};

/**
 * The parcel's digital thread, read from the audit chain: every event on the
 * parcel and on everything attached to it, with the hash that seals it.
 */
export function DigitalThread({ parcelId }: { parcelId: string }) {
  const state = useApi<{ items: ThreadItem[]; relatedEntities: number }>(`/thread/parcels/${parcelId}`);
  const [off, setOff] = useState<Set<string>>(new Set());
  return (
    <DataState state={state} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="No events yet" />}>
      {(d) => {
        const counts = d.items.reduce<Record<string, number>>((m, i) => ({ ...m, [i.category]: (m[i.category] ?? 0) + 1 }), {});
        const shown = d.items.filter((i) => !off.has(i.category));
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter the thread">
              {(Object.keys(CAT) as Array<ThreadItem['category']>).filter((c) => counts[c]).map((c) => (
                <button
                  key={c}
                  aria-pressed={!off.has(c)}
                  onClick={() => setOff((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; })}
                  className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', off.has(c) ? 'border-line text-ink-muted line-through' : 'border-navy/30 bg-surface text-ink')}
                >
                  {CAT[c].icon} {CAT[c].label} ({counts[c]})
                </button>
              ))}
              <span className="ml-auto text-[11px] text-ink-muted">{d.items.length} audited events across {d.relatedEntities} linked records</span>
            </div>
            <ol className="relative space-y-3 border-l-2 border-line pl-5">
              {shown.map((t) => (
                <li key={t.seq} className={cn(t.highlighted && 'rounded-lg bg-danger-soft/40 p-2')}>
                  <span className={cn('absolute -left-[11px] mt-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-panel', CAT[t.category].dot)} aria-hidden>
                    {CAT[t.category].icon}
                  </span>
                  <p className="text-sm font-semibold text-ink">
                    {t.title}
                    {t.highlighted && <span className="ml-2 text-[11px] font-bold text-danger">OVERRIDE</span>}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {dateTimeIST(t.at)} · {t.actor}
                    {t.detail ? ` · ${t.detail}` : ''}
                  </p>
                  <p className="font-mono text-[10px] text-ink-muted" title={`hash ${t.hash}\nprevious ${t.previousHash}`}>
                    #{t.seq} · {t.hash.slice(0, 16)}…
                  </p>
                </li>
              ))}
            </ol>
          </div>
        );
      }}
    </DataState>
  );
}
