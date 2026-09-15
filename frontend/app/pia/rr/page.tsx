'use client';

import React from 'react';
import { MOCK_RR_FAMILIES } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';

export default function PIARRPage() {
  const columns: Column<typeof MOCK_RR_FAMILIES[0]>[] = [
    { header: 'Family Head', accessorKey: 'familyHead', cell: (r) => <span className="font-bold">{r.familyHead}</span> },
    { header: 'Housing Entitlement', accessorKey: 'housingEntitlement' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">PIA R&R Infrastructural Obligations</h1>
        <p className="text-xs text-slate-500">Constructing R&R colony housing, schools & amenity infrastructure</p>
      </div>

      <DataTable title="PIA R&R Colony Projects" data={MOCK_RR_FAMILIES} columns={columns} searchPlaceholder="Search R&R..." />
    </div>
  );
}
