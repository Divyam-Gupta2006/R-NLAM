'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
import { Card, DataState, EmptyState, PageHeader, Progress, StatusBadge, SyntheticTag, Table } from '@/components/ui';
import { useApi } from '@/lib/api/hooks';
import type { Project } from '@/lib/api/types';
import { ha, inrShort, num } from '@/lib/format';

export function ProjectsTable({ projects }: { projects: Project[] }) {
  const router = useRouter();
  return (
    <Table
      rows={projects}
      rowKey={(p) => p.id}
      caption="Projects"
      searchText={(p) => `${p.code} ${p.name} ${p.stateName} ${p.districtNames.join(' ')} ${p.piaName} ${p.sector}`}
      searchPlaceholder="Search by name, code, state, district…"
      onRowClick={(p) => router.push(`/project/${p.id}`)}
      columns={[
        {
          key: 'name',
          header: 'Project',
          sortValue: (p) => p.name,
          cell: (p) => (
            <div>
              <p className="font-semibold text-ink">{p.name}</p>
              <p className="text-xs text-ink-muted">
                {p.code} · {p.sector} · {p.piaName}
              </p>
              {p.isSynthetic && <SyntheticTag className="mt-1" />}
            </div>
          ),
        },
        { key: 'where', header: 'Where', sortValue: (p) => p.stateName, cell: (p) => <span className="text-xs">{p.districtNames.join(', ')}, {p.stateName}</span> },
        { key: 'status', header: 'Status', sortValue: (p) => p.status, cell: (p) => <StatusBadge status={p.status} /> },
        { key: 'parcels', header: 'Parcels', align: 'right', sortValue: (p) => p.parcelCount ?? 0, cell: (p) => num(p.parcelCount) },
        { key: 'area', header: 'Area', align: 'right', sortValue: (p) => p.notifiedAreaHa ?? 0, cell: (p) => ha(p.notifiedAreaHa, 1) },
        { key: 'cost', header: 'Est. cost', align: 'right', sortValue: (p) => Number(p.estimatedCostPaise), cell: (p) => inrShort(p.estimatedCostPaise) },
        { key: 'poss', header: 'Possession', sortValue: (p) => p.possessionPct ?? 0, cell: (p) => <div className="w-36"><Progress value={p.possessionPct ?? 0} label={`${p.name} possession`} /></div> },
      ]}
    />
  );
}

export function ProjectsView({ title = 'Projects', eyebrow, actions }: { title?: string; eyebrow?: string; actions?: React.ReactNode }) {
  const state = useApi<Project[]>('/projects');
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} subtitle="Acquisition projects in your jurisdiction. Open one for its parcels, notices, map and money." actions={actions} />
      <Card>
        <DataState state={state} empty={<EmptyState title="No projects in your jurisdiction" />}>
          {(p) => <ProjectsTable projects={p} />}
        </DataState>
      </Card>
    </div>
  );
}
