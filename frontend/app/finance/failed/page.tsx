'use client';

import React from 'react';
import { MOCK_COMPENSATION } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionButtons } from '@/components/ActionButtons';

export default function FinanceFailedPage() {
  const failed = MOCK_COMPENSATION.filter((c) => c.status === 'PAYMENT_FAILED' || c.pfmsStatus === 'REJECTED');

  const columns: Column<typeof MOCK_COMPENSATION[0]>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', cell: (c) => <span className="font-bold">{c.khasraNo}</span> },
    { header: 'Landowner', accessorKey: 'landownerName' },
    { header: 'PFMS Status', accessorKey: 'pfmsStatus', cell: (c) => <StatusBadge status={c.pfmsStatus} size="sm" /> },
    { header: 'Actions', cell: (c) => <ActionButtons entityId={c.id} entityType="COMPENSATION" allowedActions={['INITIATE_PAYMENT', 'RAISE_QUERY']} compact /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Failed Disbursements Queue</h1>
        <p className="text-xs text-slate-500">Bank account mismatch or IFSC code rejection error resolution</p>
      </div>

      <DataTable title="Failed Transaction Retry Queue" data={failed} columns={columns} searchPlaceholder="Search failed..." />
    </div>
  );
}
