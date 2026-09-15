'use client';

import React from 'react';
import { MOCK_RR_FAMILIES, RRFamily } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency } from '@/lib/utils';

export default function CentralRRPage() {
  const columns: Column<RRFamily>[] = [
    { header: 'Family Head', accessorKey: 'familyHead', sortable: true, cell: (r) => <span className="font-bold">{r.familyHead}</span> },
    { header: 'Khasra #', accessorKey: 'khasraNo' },
    { header: 'Project Name', accessorKey: 'projectName' },
    { header: 'Category', accessorKey: 'category' },
    { header: 'Displacement', accessorKey: 'displacementType' },
    { header: 'Housing Entitlement', accessorKey: 'housingEntitlement' },
    { header: 'Cash Grant', cell: (r) => <span>{formatCurrency(r.cashGrant)}</span> },
    { header: 'Status', accessorKey: 'status', cell: (r) => <StatusBadge status={r.status} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">National Resettlement & Rehabilitation (4D Dimension)</h1>
        <p className="text-xs text-slate-500">Tracking affected project families, SC/ST entitlements, housing colony allocations</p>
      </div>

      <DataTable
        title="Affected Families R&R Registry"
        data={MOCK_RR_FAMILIES}
        columns={columns}
        searchPlaceholder="Search family head, khasra #..."
      />
    </div>
  );
}
