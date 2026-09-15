'use client';

import React from 'react';
import { MOCK_PARCELS } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

export default function FieldCompletedPage() {
  const completed = MOCK_PARCELS.filter((p) => p.fieldSurveyStatus === 'VERIFIED');

  const columns: Column<typeof completed[0]>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', cell: (p) => <span className="font-bold">{p.khasraNo}</span> },
    { header: 'Village', accessorKey: 'village' },
    { header: 'Owner', accessorKey: 'ownerName' },
    { header: 'Survey Status', accessorKey: 'fieldSurveyStatus', cell: (p) => <StatusBadge status={p.fieldSurveyStatus} size="sm" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Completed Cadastral Surveys</h1>
        <p className="text-xs text-slate-500">Verified field surveys with signed PostGIS boundaries</p>
      </div>

      <DataTable title="Verified Field Surveys" data={completed} columns={columns} searchPlaceholder="Search completed..." />
    </div>
  );
}
