'use client';

import React from 'react';
import { ActionButtons } from '@/components/ActionButtons';
import { StatusBadge } from '@/components/StatusBadge';
import { DataTable, Column } from '@/components/DataTable';
import { formatCurrency } from '@/lib/utils';

export default function DistrictAwardsPage() {
  const awards = [
    { id: 'AWD-2026-12', khasraNo: '142/A', project: 'Mumbai-Pune Expressway', landowner: 'Ramesh Balaji Patil', baseValue: 8500000, solatium: 8500000, totalAward: 17000000, status: 'DISTRICT_APPROVED' },
  ];

  const columns: Column<typeof awards[0]>[] = [
    { header: 'Award #', accessorKey: 'id', cell: (a) => <span className="font-bold font-mono">{a.id}</span> },
    { header: 'Khasra #', accessorKey: 'khasraNo' },
    { header: 'Landowner', accessorKey: 'landowner' },
    { header: 'Market Value', cell: (a) => <span>{formatCurrency(a.baseValue)}</span> },
    { header: '100% Solatium', cell: (a) => <span>{formatCurrency(a.solatium)}</span> },
    { header: 'Total Award', cell: (a) => <span className="font-bold text-slate-900">{formatCurrency(a.totalAward)}</span> },
    { header: 'Status', accessorKey: 'status', cell: (a) => <StatusBadge status={a.status} size="sm" /> },
    { header: 'Actions', cell: (a) => <ActionButtons entityId={a.id} entityType="SECTION_23_AWARD" allowedActions={['APPROVE', 'INITIATE_PAYMENT']} compact /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Section 23 CALA Compensation Awards</h1>
        <p className="text-xs text-slate-500">Statutory awards determined by District Collector under Section 23 & 30 of RFCTLARR Act</p>
      </div>

      <DataTable title="Section 23 Awards Determination" data={awards} columns={columns} searchPlaceholder="Search awards..." />
    </div>
  );
}
