'use client';

import React from 'react';
import { ActionButtons } from '@/components/ActionButtons';
import { StatusBadge } from '@/components/StatusBadge';
import { DataTable, Column } from '@/components/DataTable';

export default function StateApprovalsPage() {
  const approvals = [
    { id: 'APP-101', type: 'Section 19 Declaration Gazette', project: 'Mumbai-Pune Expressway', district: 'Pune', submittedBy: 'Collector_Pune', status: 'PENDING' },
    { id: 'APP-102', type: 'State Compensation Sanction', project: 'Mahanadi Industrial Corridor', district: 'Cuttack', submittedBy: 'Collector_Cuttack', status: 'PENDING' },
  ];

  const columns: Column<typeof approvals[0]>[] = [
    { header: 'Approval ID', accessorKey: 'id', cell: (a) => <span className="font-bold font-mono">{a.id}</span> },
    { header: 'Type', accessorKey: 'type' },
    { header: 'Project Name', accessorKey: 'project' },
    { header: 'District', accessorKey: 'district' },
    { header: 'Submitted By', accessorKey: 'submittedBy' },
    { header: 'Status', accessorKey: 'status', cell: (a) => <StatusBadge status={a.status} size="sm" /> },
    { header: 'Actions', cell: (a) => <ActionButtons entityId={a.id} entityType="STATE_APPROVAL" allowedActions={['APPROVE', 'RETURN', 'REJECT']} compact /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">State Nodal Approval Queue</h1>
        <p className="text-xs text-slate-500">Official gazette sign-offs, Section 19 declarations & financial releases</p>
      </div>

      <DataTable title="Pending State Approvals" data={approvals} columns={columns} searchPlaceholder="Search approvals..." />
    </div>
  );
}
