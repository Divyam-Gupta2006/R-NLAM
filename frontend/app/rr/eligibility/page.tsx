'use client';

import React from 'react';
import { MOCK_RR_FAMILIES } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

export default function RREligibilityPage() {
  const columns: Column<typeof MOCK_RR_FAMILIES[0]>[] = [
    { header: 'Family Head', accessorKey: 'familyHead', cell: (r) => <span className="font-bold">{r.familyHead}</span> },
    { header: 'Category', accessorKey: 'category' },
    { header: 'Doc Verification', cell: (r) => <span className="font-mono text-xs font-semibold text-emerald-700">{r.verificationDoc}</span> },
    { header: 'Status', accessorKey: 'status', cell: (r) => <StatusBadge status={r.status} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">R&R Eligibility Verification Matrix</h1>
        <p className="text-xs text-slate-500">SC/ST certificate validation & landless agricultural laborer eligibility</p>
      </div>

      <DataTable title="Eligibility Matrix" data={MOCK_RR_FAMILIES} columns={columns} searchPlaceholder="Search eligibility..." />
    </div>
  );
}
