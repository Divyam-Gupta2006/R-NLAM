'use client';

import React from 'react';
import { MOCK_PARCELS } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

export default function StateLandPage() {
  const columns: Column<typeof MOCK_PARCELS[0]>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', cell: (p) => <span className="font-bold">{p.khasraNo}</span> },
    { header: 'District', accessorKey: 'district' },
    { header: 'Landowner', accessorKey: 'ownerName' },
    { header: 'Land Type', accessorKey: 'landType' },
    { header: 'Area (Ha)', accessorKey: 'areaHectares', cell: (p) => <span>{p.areaHectares} Ha</span> },
    { header: 'Status', accessorKey: 'possessionStatus', cell: (p) => <StatusBadge status={p.possessionStatus} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">State Cadastral Land Inventory</h1>
        <p className="text-xs text-slate-500">State Bhoomi land records sync and parcel verification status</p>
      </div>

      <DataTable title="State Parcels Master List" data={MOCK_PARCELS} columns={columns} searchPlaceholder="Search parcels..." />
    </div>
  );
}
