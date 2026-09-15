'use client';

import React from 'react';
import { MOCK_PARCELS } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

export default function StatePossessionPage() {
  const columns: Column<typeof MOCK_PARCELS[0]>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', cell: (p) => <span className="font-bold">{p.khasraNo}</span> },
    { header: 'Project', accessorKey: 'projectName' },
    { header: 'District', accessorKey: 'district' },
    { header: 'Possession Status', accessorKey: 'possessionStatus', cell: (p) => <StatusBadge status={p.possessionStatus} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">State Land Possession Handover</h1>
        <p className="text-xs text-slate-500">Physical encumbrance tracking and possession certificates</p>
      </div>

      <DataTable title="State Possession Tracker" data={MOCK_PARCELS} columns={columns} searchPlaceholder="Search possession..." />
    </div>
  );
}
