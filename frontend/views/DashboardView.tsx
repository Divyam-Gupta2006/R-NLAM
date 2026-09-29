'use client';

import { AlertTriangle, FolderKanban, HeartHandshake, IndianRupee, Layers, MessageSquareWarning, Users } from 'lucide-react';
import Link from 'next/link';
import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { STAGE_COLORS } from '@/components/map/map-types';
import { Card, DataState, PageHeader, Progress, Stat, SyntheticTag, Table } from '@/components/ui';
import { useApi } from '@/lib/api/hooks';
import type { Breakdown, Kpis, Project } from '@/lib/api/types';
import { ha, humanize, inrShort, num, pct } from '@/lib/format';
import { LiabilitySummary, LiveCounter } from './LiabilityView';

export function KpiRow({ k }: { k: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Projects" value={num(k.projects)} hint={`${num(k.parcels)} parcels`} icon={<FolderKanban className="h-4 w-4" />} />
      <Stat label="Land in possession" value={pct(k.possessionPct)} hint={`${ha(k.possessedAreaHa, 1)} of ${ha(k.notifiedAreaHa, 1)}`} tone="good" icon={<Layers className="h-4 w-4" />} />
      <Stat label="Compensation paid" value={inrShort(k.compensation.paidPaise)} hint={`${inrShort(k.compensation.pendingPaise)} pending · ${inrShort(k.compensation.disputedOrHeldPaise)} held`} tone="accent" icon={<IndianRupee className="h-4 w-4" />} />
      <Stat label="Families affected" value={num(k.familiesAffected)} hint={`${num(k.rrEntitlementsPending)} R&R entitlements undelivered`} tone={k.rrEntitlementsPending ? 'warn' : 'default'} icon={<Users className="h-4 w-4" />} />
    </div>
  );
}

export function StageFunnel({ k }: { k: Kpis }) {
  const rows = k.stageFunnel.filter((s) => s.parcels > 0 || !['LAPSED', 'WITHDRAWN', 'IDENTIFIED'].includes(s.stage));
  return (
    <div className="h-64" role="img" aria-label={`Parcels by stage: ${rows.map((r) => `${humanize(r.stage)} ${r.parcels}`).join(', ')}`}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="stage" tickFormatter={(s: string) => humanize(s).replace('Compensation', 'Comp.')} tick={{ fontSize: 11 }} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number, _n, p) => [`${v} parcels · ${ha((p.payload as { areaHa: number }).areaHa, 1)}`, humanize((p.payload as { stage: string }).stage)]} labelFormatter={() => ''} />
          <Bar dataKey="parcels" radius={[4, 4, 0, 0]}>
            {rows.map((r) => (
              <Cell key={r.stage} fill={STAGE_COLORS[r.stage] ?? '#64748b'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BreakdownTable({ rows, level }: { rows: Breakdown[]; level: 'State' | 'District' }) {
  return (
    <Table
      rows={rows}
      rowKey={(r) => r.code}
      caption={`Progress by ${level.toLowerCase()}`}
      columns={[
        { key: 'name', header: level, cell: (r) => <span className="font-semibold">{r.name}</span>, sortValue: (r) => r.name },
        { key: 'parcels', header: 'Parcels', align: 'right', cell: (r) => num(r.parcels), sortValue: (r) => r.parcels },
        { key: 'area', header: 'Area', align: 'right', cell: (r) => ha(r.areaHa, 1), sortValue: (r) => r.areaHa },
        { key: 'families', header: 'Families', align: 'right', cell: (r) => num(r.familiesAffected), sortValue: (r) => r.familiesAffected },
        { key: 'paid', header: 'Paid parcels', align: 'right', cell: (r) => num(r.paidParcels), sortValue: (r) => r.paidParcels },
        { key: 'poss', header: 'Possession', cell: (r) => <Progress value={r.possessionPct} label={`${r.name} possession`} />, sortValue: (r) => r.possessionPct },
      ]}
    />
  );
}

export function ProjectProgressList({ projects }: { projects: Project[] }) {
  return (
    <ul className="divide-y divide-line">
      {projects.map((p) => (
        <li key={p.id} className="py-2.5">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/project/${p.id}`} className="min-w-0 truncate text-sm font-semibold text-ink hover:text-saffron">
              {p.name}
            </Link>
            {p.isSynthetic && <SyntheticTag />}
          </div>
          <p className="text-xs text-ink-muted">
            {p.code} · {p.stateName} · {num(p.parcelCount)} parcels · {num(p.familiesAffected)} families
          </p>
          <Progress value={p.possessionPct ?? 0} label={`${p.name} possession`} />
        </li>
      ))}
    </ul>
  );
}

/** Dashboard for any level; the API scopes numbers to the caller’s jurisdiction. */
export function DashboardView({ title, eyebrow, breakdown }: { title: string; eyebrow: string; breakdown: 'state' | 'district' }) {
  const kpis = useApi<Kpis>('/analytics/kpis');
  const rows = useApi<Breakdown[]>(breakdown === 'state' ? '/analytics/states' : '/analytics/districts');
  const projects = useApi<Project[]>('/projects');
  const liability = useApi<LiabilitySummary>('/liability/summary', { refreshMs: 60_000 });

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={eyebrow} title={title} subtitle="Live from the lifecycle database. Every number drills down to parcels." />
      {liability.data && (
        <Link href={`${breakdown === 'state' ? '/central' : '/state'}/liability`} className="block rounded-[var(--radius)] focus-visible:outline">
          <LiveCounter summary={liability.data} />
        </Link>
      )}
      <DataState state={kpis} rows={2}>
        {(k) => (
          <>
            <KpiRow k={k} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Open objections (s.15)" value={num(k.openObjections)} icon={<MessageSquareWarning className="h-4 w-4" />} tone={k.openObjections ? 'warn' : 'default'} />
              <Stat label="R&R entitlements undelivered" value={num(k.rrEntitlementsPending)} icon={<HeartHandshake className="h-4 w-4" />} tone={k.rrEntitlementsPending ? 'warn' : 'good'} hint="Possession is blocked until these are delivered (s.38(1))" />
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <Card title="Parcels by lifecycle stage" subtitle="Preliminary notification → handover">
                <StageFunnel k={k} />
              </Card>
              <Card title="Projects" subtitle="Share of parcels in possession">
                <DataState state={projects} rows={4}>
                  {(p) => <ProjectProgressList projects={p} />}
                </DataState>
              </Card>
            </div>
          </>
        )}
      </DataState>
      <Card title={breakdown === 'state' ? 'States' : 'Districts'} subtitle="Sortable; possession is by area">
        <DataState state={rows} rows={4}>
          {(r) => <BreakdownTable rows={r} level={breakdown === 'state' ? 'State' : 'District'} />}
        </DataState>
      </Card>
    </div>
  );
}

export function NoticeOfLimits() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-ink-muted">
      <AlertTriangle className="h-3.5 w-3.5" /> Figures are computed from synthetic demonstration records.
    </p>
  );
}
