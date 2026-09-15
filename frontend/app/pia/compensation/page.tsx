'use client';

import React from 'react';
import { MOCK_COMPENSATION } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { formatCurrency } from '@/lib/utils';

export default function PIACompensationPage() {
  const columns: Column<typeof MOCK_COMPENSATION[0]>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', cell: (c) => <span className="font-bold">{c.khasraNo}</span> },
    { header: 'Project', accessorKey: 'projectName' },
    { header: 'Total Award', cell: (c) => <span className="font-bold">{formatCurrency(c.totalCompensation)}</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">PIA Escrow Funds Deposit</h1>
        <p className="text-xs text-slate-500">Compensation fund deposits transferred to CALA treasury account</p>
      </div>

      <DataTable title="PIA Compensation Deposits" data={MOCK_COMPENSATION} columns={columns} searchPlaceholder="Search deposits..." />
    </div>
  );
}
