'use client';

import React from 'react';
import { MOCK_RR_FAMILIES } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

export default function StateRRPage() {
  const columns: Column<typeof MOCK_RR_FAMILIES[0]>[] = [
    { header: 'Family Head', accessorKey: 'familyHead', cell: (r) => <span className="font-bold">{r.familyHead}</span> },
    { header: 'Khasra #', accessorKey: 'khasraNo' },
    { header: 'District', accessorKey: 'district' },
    { header: 'Housing Colony', accessorKey: 'housingEntitlement' },
    { header: 'Status', accessorKey: 'status', cell: (r) => <StatusBadge status={r.status} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">State R&R Schemes & Colonies</h1>
        <p className="text-xs text-slate-500">State rehabilitation housing and annuity benefits</p>
      </div>

      <DataTable title="State R&R Beneficiary Families" data={MOCK_RR_FAMILIES} columns={columns} searchPlaceholder="Search R&R families..." />
    </div>
  );
}
