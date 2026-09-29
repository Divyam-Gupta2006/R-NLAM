'use client';

import React, { useState } from 'react';
import { LifecyclePanel } from '@/components/LifecyclePanel';
import { ParcelMap } from '@/components/map/ParcelMap';
import { STAGE_COLORS } from '@/components/map/map-types';
import { Card, DataState, PageHeader, Stat, StatusBadge, SyntheticTag, Tabs } from '@/components/ui';
import { useApi } from '@/lib/api/hooks';
import type { ProjectDetail } from '@/lib/api/types';
import { dateIST, ha, humanize, inr, inrShort, num } from '@/lib/format';
import { ParcelsView } from './ParcelsView';

type Tab = 'overview' | 'parcels' | 'map';

export function ProjectDetailView({ id }: { id: string }) {
  const state = useApi<ProjectDetail>(`/projects/${id}`);
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <DataState state={state} rows={8}>
      {(p) => {
        const parcels = p.stages.reduce((s, x) => s + x.parcels, 0);
        const area = p.stages.reduce((s, x) => s + x.areaHa, 0);
        const done = p.stages.filter((s) => s.stage === 'POSSESSION_TAKEN' || s.stage === 'HANDED_OVER').reduce((s, x) => s + x.parcels, 0);
        const paid = p.compensation.filter((c) => c.status === 'PAID').reduce((s, c) => s + Number(c.amountPaise), 0);
        const assessed = p.compensation.reduce((s, c) => s + Number(c.amountPaise), 0);
        return (
          <div className="space-y-5">
            <PageHeader
              eyebrow={`${p.code} · ${p.sector} · ${p.districtNames.join(', ')}, ${p.stateName}`}
              title={p.name}
              subtitle={
                <span className="flex flex-wrap items-center gap-2">
                  {p.piaName} <StatusBadge status={p.status} /> {p.isSynthetic && <SyntheticTag />}
                </span>
              }
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Parcels" value={num(parcels)} hint={ha(area, 1)} />
              <Stat label="In possession" value={parcels ? `${Math.round((done / parcels) * 100)}%` : '—'} hint={`${num(done)} parcels`} tone="good" />
              <Stat label="Compensation paid" value={inrShort(paid)} hint={`of ${inrShort(assessed)} assessed`} tone="accent" />
              <Stat label="Families affected" value={num(p.familiesAffected)} />
            </div>
            <Tabs<Tab>
              value={tab}
              onChange={setTab}
              tabs={[
                { key: 'overview', label: 'Overview' },
                { key: 'parcels', label: 'Parcels' },
                { key: 'map', label: 'Map' },
              ]}
            />
            {tab === 'overview' && (
              <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
                <div className="space-y-5">
                  <Card title="Where every parcel stands">
                    <div className="flex h-5 overflow-hidden rounded-full bg-line" role="img" aria-label={p.stages.map((s) => `${humanize(s.stage)} ${s.parcels}`).join(', ')}>
                      {p.stages
                        .filter((s) => s.parcels > 0)
                        .map((s) => (
                          <div key={s.stage} title={`${humanize(s.stage)}: ${s.parcels}`} style={{ width: `${(s.parcels / Math.max(1, parcels)) * 100}%`, background: STAGE_COLORS[s.stage] }} />
                        ))}
                    </div>
                    <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                      {p.stages.map((s) => (
                        <li key={s.stage} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-sm" style={{ background: STAGE_COLORS[s.stage] }} aria-hidden />
                            {humanize(s.stage)}
                          </span>
                          <span className="tabular text-ink-muted">
                            {s.parcels} · {ha(s.areaHa, 1)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card title="Compensation by status">
                    <ul className="divide-y divide-line text-sm">
                      {p.compensation.map((c) => (
                        <li key={c.status} className="flex items-center justify-between py-2">
                          <StatusBadge status={c.status} />
                          <span className="tabular">
                            {num(c.count)} lines · <strong>{inr(c.amountPaise, { paise: false })}</strong>
                          </span>
                        </li>
                      ))}
                      {p.compensation.length === 0 && <li className="py-2 text-xs text-ink-muted">No awards yet</li>}
                    </ul>
                  </Card>
                  <Card title="Statutory notices">
                    <ul className="divide-y divide-line text-sm">
                      {p.notices.map((n) => (
                        <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <span>
                            <span className="font-semibold">{humanize(n.kind)}</span>
                            <span className="block text-xs text-ink-muted">
                              {n.referenceNo} · {n._count?.parcels ?? 0} parcels
                            </span>
                          </span>
                          <span className="text-xs text-ink-muted">{dateIST(n.publishedOn)}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
                <LifecyclePanel entityType="Project" entityId={p.id} onChanged={state.reload} title="Project approval lifecycle" />
              </div>
            )}
            {tab === 'parcels' && <ParcelsView title="" projectId={p.id} />}
            {tab === 'map' && (
              <Card>
                <ParcelMap projectId={p.id} height={560} />
              </Card>
            )}
          </div>
        );
      }}
    </DataState>
  );
}
