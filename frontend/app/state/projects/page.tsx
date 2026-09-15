'use client';

import React from 'react';
import { MOCK_PROJECTS, Project } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionButtons } from '@/components/ActionButtons';
import Link from 'next/link';

export default function StateProjectsPage() {
  const columns: Column<Project>[] = [
    {
      header: 'Project Name',
      accessorKey: 'name',
      cell: (p) => (
        <div>
          <Link href={`/project/${p.id}`} className="font-bold text-slate-900 hover:text-sky-600 block">
            {p.name}
          </Link>
          <span className="font-mono text-[11px] text-slate-500">{p.id}</span>
        </div>
      ),
    },
    { header: 'District', accessorKey: 'district' },
    { header: 'Stage', accessorKey: 'stage', cell: (p) => <StatusBadge status={p.stage} size="sm" /> },
    { header: 'SLA Status', accessorKey: 'slaStatus', cell: (p) => <StatusBadge status={p.slaStatus} size="sm" /> },
    { header: 'Actions', cell: (p) => <ActionButtons entityId={p.id} entityType="PROJECT" allowedActions={['APPROVE', 'RAISE_QUERY']} compact /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">State Infrastructure Projects</h1>
        <p className="text-xs text-slate-500">State Nodal Authority gazette pipeline</p>
      </div>

      <DataTable title="State Projects" data={MOCK_PROJECTS} columns={columns} searchPlaceholder="Search state projects..." />
    </div>
  );
}
