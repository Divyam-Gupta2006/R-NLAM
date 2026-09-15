'use client';

import React from 'react';
import { MOCK_COMPENSATION, CompensationRecord } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionButtons } from '@/components/ActionButtons';
import { formatCurrency } from '@/lib/utils';

export default function CentralCompensationPage() {
  const columns: Column<CompensationRecord>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', sortable: true, cell: (c) => <span className="font-bold">{c.khasraNo}</span> },
    { header: 'Project Name', accessorKey: 'projectName' },
    { header: 'Landowner', accessorKey: 'landownerName' },
    { header: 'Base Valuation', cell: (c) => <span>{formatCurrency(c.calculatedAmount)}</span> },
    { header: '100% Solatium', cell: (c) => <span>{formatCurrency(c.solatiumAmount)}</span> },
    { header: 'Total Award', cell: (c) => <span className="font-bold text-slate-900">{formatCurrency(c.totalCompensation)}</span> },
    { header: 'Status', accessorKey: 'status', cell: (c) => <StatusBadge status={c.status} size="sm" /> },
    { header: 'PFMS UTR', cell: (c) => <span className="font-mono text-[11px] text-slate-600">{c.utrNumber || 'Pending'}</span> },
    { header: 'Actions', cell: (c) => <ActionButtons entityId={c.id} entityType="COMPENSATION" allowedActions={['INITIATE_PAYMENT', 'APPROVE']} compact /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">National Compensation & PFMS Treasury (3D Dimension)</h1>
        <p className="text-xs text-slate-500">Valuation assessment, 100% solatium multipliers & direct bank transfer audit</p>
      </div>

      <DataTable
        title="Compensation Disbursements Register"
        data={MOCK_COMPENSATION}
        columns={columns}
        searchPlaceholder="Search khasra #, landowner, UTR..."
      />
    </div>
  );
}
