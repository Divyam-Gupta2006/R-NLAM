'use client';

import React from 'react';
import { MOCK_COMPENSATION } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

export default function FinanceDisputesPage() {
  const disputed = MOCK_COMPENSATION.filter((c) => c.status === 'DISPUTED');

  const columns: Column<typeof disputed[0]>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', cell: (c) => <span className="font-bold">{c.khasraNo}</span> },
    { header: 'Landowner', accessorKey: 'landownerName' },
    { header: 'Status', accessorKey: 'status', cell: (c) => <StatusBadge status={c.status} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Disputed Claims Escrow Account</h1>
        <p className="text-xs text-slate-500">Funds deposited into Authority Escrow pending High Court or LARR Authority adjudication</p>
      </div>

      <DataTable title="Escrow Disputed Claims" data={disputed} columns={columns} searchPlaceholder="Search disputed..." />
    </div>
  );
}
