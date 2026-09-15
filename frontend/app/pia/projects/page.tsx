'use client';

import React from 'react';
import { MOCK_PROJECTS } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';

export default function PIAProjectsPage() {
  const columns: Column<typeof MOCK_PROJECTS[0]>[] = [
    { header: 'Project Name', accessorKey: 'name', cell: (p) => <Link href={`/project/${p.id}`} className="font-bold text-slate-900 hover:underline">{p.name}</Link> },
    { header: 'State', accessorKey: 'state' },
    { header: 'Stage', accessorKey: 'stage', cell: (p) => <StatusBadge status={p.stage} size="sm" /> },
    { header: 'Possession %', cell: (p) => <span className="font-bold">{p.possessionPercentage}%</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">PIA Agency Projects Pipeline</h1>
          <p className="text-xs text-slate-500">Track land acquisition progress for NHAI / Rail / Industrial corridors</p>
        </div>
        <Link href="/pia/new-project" className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-bold">+ New Project Proposal</Link>
      </div>

      <DataTable title="PIA Projects" data={MOCK_PROJECTS} columns={columns} searchPlaceholder="Search projects..." />
    </div>
  );
}
