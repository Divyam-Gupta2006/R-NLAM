'use client';

import React from 'react';
import { MOCK_PARCELS } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionButtons } from '@/components/ActionButtons';

export default function DistrictParcelsPage() {
  const columns: Column<typeof MOCK_PARCELS[0]>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', cell: (p) => <span className="font-bold">{p.khasraNo}</span> },
    { header: 'Village', accessorKey: 'village' },
    { header: 'Owner Name', accessorKey: 'ownerName' },
    { header: 'Land Type', accessorKey: 'landType' },
    { header: 'Area (Ha)', accessorKey: 'areaHectares' },
    { header: 'Survey Status', accessorKey: 'fieldSurveyStatus', cell: (p) => <StatusBadge status={p.fieldSurveyStatus} size="sm" /> },
    { header: 'Actions', cell: (p) => <ActionButtons entityId={p.id} entityType="PARCEL" allowedActions={['VERIFY_PARCEL', 'APPROVE']} compact /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">District Khasra Parcels Directory</h1>
        <p className="text-xs text-slate-500">Khasra cadastral survey records & valuation status</p>
      </div>

      <DataTable title="District Parcels" data={MOCK_PARCELS} columns={columns} searchPlaceholder="Search khasra #..." />
    </div>
  );
}
