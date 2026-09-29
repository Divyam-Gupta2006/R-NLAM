'use client';

import { List, Map as MapIcon, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { ParcelMap } from '@/components/map/ParcelMap';
import { Card, DataState, EmptyState, PageHeader, Select, StatusBadge, SyntheticTag, Tabs } from '@/components/ui';
import { qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { Paged, Parcel, ParcelStage, Project } from '@/lib/api/types';
import { ha, humanize, num } from '@/lib/format';

const STAGES: ParcelStage[] = ['IDENTIFIED', 'PRELIM_NOTIFIED', 'DECLARED', 'AWARDED', 'COMPENSATION_PAID', 'POSSESSION_TAKEN', 'HANDED_OVER', 'LAPSED', 'WITHDRAWN'];
const PAGE = 50;

/** Server-paged parcel register with stage/project filters and a map tab. */
export function ParcelsView({ title = 'Parcels', eyebrow, initialStage = '', projectId: fixedProject }: { title?: string; eyebrow?: string; initialStage?: ParcelStage | ''; projectId?: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<string>(initialStage);
  const [projectId, setProjectId] = useState<string>(fixedProject ?? '');
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'list' | 'map'>('list');
  const projects = useApi<Project[]>(fixedProject ? null : '/projects');
  const state = useApi<Paged<Parcel>>(`/parcels${qs({ stage, projectId, q, page, pageSize: PAGE })}`);

  return (
    <div>
      {title && <PageHeader eyebrow={eyebrow} title={title} subtitle="The parcel register: survey number, holders and lifecycle stage. Select a row for the full digital thread." />}
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <form
            className="relative min-w-[220px] flex-1 sm:max-w-sm"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(draft);
              setPage(1);
            }}
          >
            <label className="sr-only" htmlFor="parcel-search">
              Search parcels
            </label>
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-muted" aria-hidden />
            <input id="parcel-search" className="input pl-8" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Survey no., parcel no., owner, village… (Enter)" />
          </form>
          <Select label="Stage" value={stage} onChange={(v) => { setStage(v); setPage(1); }} options={[{ value: '', label: 'All stages' }, ...STAGES.map((s) => ({ value: s, label: humanize(s) }))]} />
          {!fixedProject && (
            <Select
              label="Project"
              value={projectId}
              onChange={(v) => { setProjectId(v); setPage(1); }}
              options={[{ value: '', label: 'All projects' }, ...(projects.data ?? []).map((p) => ({ value: p.id, label: `${p.code}` }))]}
            />
          )}
          <div className="ml-auto">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { key: 'list', label: <span className="flex items-center gap-1"><List className="h-4 w-4" /> List</span> },
                { key: 'map', label: <span className="flex items-center gap-1"><MapIcon className="h-4 w-4" /> Map</span> },
              ]}
            />
          </div>
        </div>

        {tab === 'map' ? (
          <ParcelMap projectId={projectId || undefined} />
        ) : (
          <DataState state={state} isEmpty={(d) => d.total === 0} empty={<EmptyState title="No parcels match" detail="Try another stage or clear the search." />}>
            {(d) => (
              <>
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full min-w-[760px] text-sm">
                    <caption className="sr-only">Parcels</caption>
                    <thead className="bg-surface text-left text-xs font-semibold text-ink-muted">
                      <tr>
                        <th scope="col" className="px-3 py-2">Parcel</th>
                        <th scope="col" className="px-3 py-2">Village</th>
                        <th scope="col" className="px-3 py-2">Holder(s)</th>
                        <th scope="col" className="px-3 py-2 text-right">Area</th>
                        <th scope="col" className="px-3 py-2 text-right">Families</th>
                        <th scope="col" className="px-3 py-2">Stage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-panel">
                      {d.items.map((p) => (
                        <tr key={p.id} tabIndex={0} className="cursor-pointer hover:bg-saffron-soft/40" onClick={() => router.push(`/parcel/${p.id}`)} onKeyDown={(e) => e.key === 'Enter' && router.push(`/parcel/${p.id}`)}>
                          <td className="px-3 py-2">
                            <p className="font-semibold text-ink">{p.parcelNumber}</p>
                            <p className="text-xs text-ink-muted">Survey {p.surveyNumber} · {p.project?.code}</p>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {p.villageName}, {p.districtName}
                          </td>
                          <td className="max-w-[260px] px-3 py-2 text-xs">
                            <span className="line-clamp-2">{p.displayOwnerName}</span>
                          </td>
                          <td className="tabular px-3 py-2 text-right">{ha(p.totalAreaHa)}</td>
                          <td className="tabular px-3 py-2 text-right">{num(p.familiesAffected)}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-1">
                              <StatusBadge status={p.stage} />
                              {p.isSynthetic && <SyntheticTag />}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
                  <span>
                    {num(d.total)} parcels · page {d.page} of {Math.max(1, Math.ceil(d.total / d.pageSize))}
                  </span>
                  <span className="flex gap-2">
                    <button className="btn-ghost px-2 py-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </button>
                    <button className="btn-ghost px-2 py-1" disabled={page * PAGE >= d.total} onClick={() => setPage((p) => p + 1)}>
                      Next
                    </button>
                  </span>
                </div>
              </>
            )}
          </DataState>
        )}
      </Card>
    </div>
  );
}
