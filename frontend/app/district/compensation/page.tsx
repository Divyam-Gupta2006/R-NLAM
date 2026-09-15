'use client';

import React from 'react';
import { MOCK_COMPENSATION } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionButtons } from '@/components/ActionButtons';

export default function DistrictCompensationPage() {
  const columns: Column<typeof MOCK_COMPENSATION[0]>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', cell: (c) => <span className="font-bold">{c.khasraNo}</span> },
    { header: 'Landowner', accessorKey: 'landownerName' },
    { header: 'Status', accessorKey: 'status', cell: (c) => <StatusBadge status={c.status} size="sm" /> },
    { header: 'Actions', cell: (c) => <ActionButtons entityId={c.id} entityType="COMPENSATION" allowedActions={['INITIATE_PAYMENT', 'APPROVE']} compact /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">District CALA Compensation Approvals</h1>
        <p className="text-xs text-slate-500">PFMS direct bank transfers & escrow deposit management</p>
      </div>

      <DataTable title="District Compensation Approvals" data={MOCK_COMPENSATION} columns={columns} searchPlaceholder="Search compensation..." />
    </div>
  );
}
