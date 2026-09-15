'use client';

import React from 'react';
import { MOCK_RR_FAMILIES } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

export default function RRDeliveryPage() {
  const columns: Column<typeof MOCK_RR_FAMILIES[0]>[] = [
    { header: 'Family Head', accessorKey: 'familyHead', cell: (r) => <span className="font-bold">{r.familyHead}</span> },
    { header: 'Disbursement', accessorKey: 'disbursementStatus', cell: (r) => <StatusBadge status={r.disbursementStatus} size="sm" /> },
    { header: 'Rehabilitation Status', accessorKey: 'status', cell: (r) => <StatusBadge status={r.status} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">R&R Benefit Delivery & PFMS Stipend Audit</h1>
        <p className="text-xs text-slate-500">Tracking monthly annuity stipends and housing possession keys</p>
      </div>

      <DataTable title="Delivery Status" data={MOCK_RR_FAMILIES} columns={columns} searchPlaceholder="Search delivery..." />
    </div>
  );
}
