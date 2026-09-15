'use client';

import React from 'react';
import { MOCK_COMPENSATION } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

export default function FinancePaymentsPage() {
  const paid = MOCK_COMPENSATION.filter((c) => c.status === 'PAID');

  const columns: Column<typeof paid[0]>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', cell: (c) => <span className="font-bold">{c.khasraNo}</span> },
    { header: 'Landowner', accessorKey: 'landownerName' },
    { header: 'PFMS UTR #', cell: (c) => <span className="font-mono text-xs font-bold text-emerald-700">{c.utrNumber}</span> },
    { header: 'Payment Date', accessorKey: 'paymentDate' },
    { header: 'Status', accessorKey: 'pfmsStatus', cell: (c) => <StatusBadge status={c.pfmsStatus} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">PFMS Direct Bank Transfer Ledger</h1>
        <p className="text-xs text-slate-500">Verified UTR transaction numbers with bank acknowledgement</p>
      </div>

      <DataTable title="Successful Disbursed Payments" data={paid} columns={columns} searchPlaceholder="Search UTR..." />
    </div>
  );
}
