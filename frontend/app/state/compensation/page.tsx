'use client';

import React from 'react';
import { MOCK_COMPENSATION } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency } from '@/lib/utils';

export default function StateCompensationPage() {
  const columns: Column<typeof MOCK_COMPENSATION[0]>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', cell: (c) => <span className="font-bold">{c.khasraNo}</span> },
    { header: 'Project', accessorKey: 'projectName' },
    { header: 'Landowner', accessorKey: 'landownerName' },
    { header: 'Total Award', cell: (c) => <span className="font-bold">{formatCurrency(c.totalCompensation)}</span> },
    { header: 'Status', accessorKey: 'status', cell: (c) => <StatusBadge status={c.status} size="sm" /> },
    { header: 'PFMS Status', accessorKey: 'pfmsStatus', cell: (c) => <StatusBadge status={c.pfmsStatus} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">State Compensation Sanctions</h1>
        <p className="text-xs text-slate-500">State treasury disbursement authorizations</p>
      </div>

      <DataTable title="State Compensation Sanctions" data={MOCK_COMPENSATION} columns={columns} searchPlaceholder="Search compensation..." />
    </div>
  );
}
