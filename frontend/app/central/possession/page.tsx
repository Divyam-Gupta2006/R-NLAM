'use client';

import React from 'react';
import { MOCK_PARCELS, Parcel } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionButtons } from '@/components/ActionButtons';

export default function CentralPossessionPage() {
  const columns: Column<Parcel>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', sortable: true, cell: (p) => <span className="font-bold">{p.khasraNo}</span> },
    { header: 'Project', accessorKey: 'projectName' },
    { header: 'District', accessorKey: 'district' },
    { header: 'Landowner', accessorKey: 'ownerName' },
    { header: 'Possession Status', accessorKey: 'possessionStatus', cell: (p) => <StatusBadge status={p.possessionStatus} size="sm" /> },
    { header: 'Field Survey', accessorKey: 'fieldSurveyStatus', cell: (p) => <StatusBadge status={p.fieldSurveyStatus} size="sm" /> },
    { header: 'Actions', cell: (p) => <ActionButtons entityId={p.id} entityType="PARCEL" allowedActions={['HANDOVER_POSSESSION', 'VERIFY_PARCEL']} compact /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Land Possession & Handover Dashboard</h1>
        <p className="text-xs text-slate-500">Monitoring Section 23 awards, physical boundary encumbrance checks & PIA possession handover</p>
      </div>

      <DataTable
        title="Physical Possession Handover Directory"
        data={MOCK_PARCELS}
        columns={columns}
        searchPlaceholder="Search khasra #, district..."
      />
    </div>
  );
}
