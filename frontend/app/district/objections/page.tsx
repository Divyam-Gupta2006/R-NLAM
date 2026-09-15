'use client';

import React from 'react';
import { ActionButtons } from '@/components/ActionButtons';
import { StatusBadge } from '@/components/StatusBadge';
import { DataTable, Column } from '@/components/DataTable';

export default function DistrictObjectionsPage() {
  const objections = [
    { id: 'OBJ-401', khasraNo: '88/4', objector: 'Mahesh Pal Sharma', reason: 'Dispute on land area measurement & valuation rate per sq. meter', filedDate: '2026-08-10', status: 'PENDING' },
    { id: 'OBJ-402', khasraNo: '92/1', objector: 'Vikramsinh Gohil', reason: 'Objection on commercial land classification multiplier', filedDate: '2026-08-25', status: 'SECTION_11' },
  ];

  const columns: Column<typeof objections[0]>[] = [
    { header: 'Objection ID', accessorKey: 'id', cell: (o) => <span className="font-bold font-mono">{o.id}</span> },
    { header: 'Khasra #', accessorKey: 'khasraNo' },
    { header: 'Objector Name', accessorKey: 'objector' },
    { header: 'Grounds for Objection', accessorKey: 'reason' },
    { header: 'Filed Date', accessorKey: 'filedDate' },
    { header: 'Status', accessorKey: 'status', cell: (o) => <StatusBadge status={o.status} size="sm" /> },
    { header: 'Actions', cell: (o) => <ActionButtons entityId={o.id} entityType="OBJECTION" allowedActions={['APPROVE', 'REJECT', 'RAISE_QUERY']} compact /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Section 15 Landowner Objections</h1>
        <p className="text-xs text-slate-500">Statutory objections filed by landowners during 60-day Section 11 notice window</p>
      </div>

      <DataTable title="Section 15 Objections Log" data={objections} columns={columns} searchPlaceholder="Search objections..." />
    </div>
  );
}
