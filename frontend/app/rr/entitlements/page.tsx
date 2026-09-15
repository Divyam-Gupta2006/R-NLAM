'use client';

import React from 'react';
import { MOCK_RR_FAMILIES } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { formatCurrency } from '@/lib/utils';

export default function RREntitlementsPage() {
  const columns: Column<typeof MOCK_RR_FAMILIES[0]>[] = [
    { header: 'Family Head', accessorKey: 'familyHead', cell: (r) => <span className="font-bold">{r.familyHead}</span> },
    { header: 'Cash Grant', cell: (r) => <span>{formatCurrency(r.cashGrant)}</span> },
    { header: 'Annuity / Employment Benefit', accessorKey: 'employmentBenefit' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">R&R Statutory Entitlement Matrix</h1>
        <p className="text-xs text-slate-500">Calculated under Second Schedule: Subsistence allowance, cattle shed & transportation grant</p>
      </div>

      <DataTable title="Entitlements Schedule" data={MOCK_RR_FAMILIES} columns={columns} searchPlaceholder="Search entitlements..." />
    </div>
  );
}
