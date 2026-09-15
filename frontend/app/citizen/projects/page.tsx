'use client';

import React from 'react';
import { MOCK_PROJECTS } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

export default function CitizenProjectsPage() {
  const columns: Column<typeof MOCK_PROJECTS[0]>[] = [
    { header: 'Project Title', accessorKey: 'name', cell: (p) => <span className="font-bold text-slate-900">{p.name}</span> },
    { header: 'State / District', cell: (p) => <span>{p.state} ({p.district})</span> },
    { header: 'Statutory Stage', accessorKey: 'stage', cell: (p) => <StatusBadge status={p.stage} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Public National Projects Directory</h1>
        <p className="text-xs text-slate-500">Public notifications for ongoing infrastructure land acquisitions</p>
      </div>

      <DataTable title="Public Infrastructure Projects" data={MOCK_PROJECTS} columns={columns} searchPlaceholder="Search projects..." />
    </div>
  );
}
