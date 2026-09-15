'use client';

import React from 'react';
import { MOCK_PARCELS } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

export default function PIAPossessionPage() {
  const columns: Column<typeof MOCK_PARCELS[0]>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', cell: (p) => <span className="font-bold">{p.khasraNo}</span> },
    { header: 'Project', accessorKey: 'projectName' },
    { header: 'Possession Status', accessorKey: 'possessionStatus', cell: (p) => <StatusBadge status={p.possessionStatus} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">PIA Physical Land Handover</h1>
        <p className="text-xs text-slate-500">Taking physical possession from CALA Collector for civil construction</p>
      </div>

      <DataTable title="Physical Possession Register" data={MOCK_PARCELS} columns={columns} searchPlaceholder="Search khasra #..." />
    </div>
  );
}
