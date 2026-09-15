'use client';

import React from 'react';
import { MOCK_PROJECTS } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';

export default function DistrictProjectsPage() {
  const columns: Column<typeof MOCK_PROJECTS[0]>[] = [
    { header: 'Project Name', accessorKey: 'name', cell: (p) => <Link href={`/project/${p.id}`} className="font-bold text-slate-900 hover:underline">{p.name}</Link> },
    { header: 'Stage', accessorKey: 'stage', cell: (p) => <StatusBadge status={p.stage} size="sm" /> },
    { header: 'Parcels', cell: (p) => <span>{p.acquiredParcels}/{p.totalParcels}</span> },
    { header: 'SLA Status', accessorKey: 'slaStatus', cell: (p) => <StatusBadge status={p.slaStatus} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">District Projects Overview</h1>
        <p className="text-xs text-slate-500">Active land acquisition projects under CALA jurisdiction</p>
      </div>

      <DataTable title="District Projects" data={MOCK_PROJECTS} columns={columns} searchPlaceholder="Search projects..." />
    </div>
  );
}
