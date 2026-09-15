'use client';

import React from 'react';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

export default function StateDistrictsPage() {
  const data = [
    { district: 'Pune', collector: 'Dr. Rajesh Deshmukh', activeParcels: 340, pendingApprovals: 2, status: 'ON_TRACK' },
    { district: 'Thane', collector: 'Shri Ashok Shingare', activeParcels: 210, pendingApprovals: 1, status: 'ON_TRACK' },
  ];

  const columns: Column<typeof data[0]>[] = [
    { header: 'District', accessorKey: 'district', cell: (d) => <span className="font-bold">{d.district}</span> },
    { header: 'Collector (CALA)', accessorKey: 'collector' },
    { header: 'Active Parcels', accessorKey: 'activeParcels' },
    { header: 'Pending State Approvals', accessorKey: 'pendingApprovals' },
    { header: 'SLA Status', accessorKey: 'status', cell: (d) => <StatusBadge status={d.status} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">State Districts & CALA Coordination</h1>
        <p className="text-xs text-slate-500">District Collector office SLAs and inter-district escalation queue</p>
      </div>

      <DataTable title="State Districts Matrix" data={data} columns={columns} searchPlaceholder="Search districts..." />
    </div>
  );
}
