'use client';

import React, { useEffect, useState } from 'react';
import { possessionApi } from '@/lib/api/client';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionButtons } from '@/components/ActionButtons';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function DistrictPossessionPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await possessionApi.getCases();
      if (res.error) {
        setError(`Possession API Error: ${res.error}`);
        setLoading(false);
        return;
      }
      setCases(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch possession cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleRecordPossession = async (parcelId: string, projectId: string) => {
    const res = await possessionApi.record({
      projectId,
      parcelId,
      authority: 'CALA / District Magistrate Nagpur',
      latitude: 21.1458,
      longitude: 79.0882,
      remarks: 'Physical possession certificate executed',
    });
    if (!res.error) {
      fetchCases();
    }
  };

  const columns: Column<any>[] = [
    { header: 'Possession ID', accessorKey: 'id', cell: (p) => <span className="font-bold text-xs font-mono">{p.id.slice(0, 8)}...</span> },
    { header: 'Authority', accessorKey: 'authority', cell: (p) => <span className="font-semibold text-slate-900">{p.authority}</span> },
    { header: 'Handover Date', accessorKey: 'handoverDate', cell: (p) => <span>{p.handoverDate ? new Date(p.handoverDate).toLocaleDateString() : 'N/A'}</span> },
    { header: 'Remarks', accessorKey: 'remarks', cell: (p) => <span className="text-slate-600">{p.remarks}</span> },
    { header: 'Status', accessorKey: 'status', cell: (p) => <StatusBadge status={p.status} size="sm" /> },
    {
      header: 'Actions',
      cell: (p) => (
        <ActionButtons
          entityId={p.id}
          entityType="POSSESSION"
          allowedActions={['HANDOVER_POSSESSION']}
          onActionComplete={() => handleRecordPossession(p.parcelId, p.projectId)}
          compact
        />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
          <span className="font-medium text-sm">Loading Possession Certificates from NestJS Backend...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-2">
        <div className="flex items-center space-x-2 font-bold text-base">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>Possession API Connection Error</span>
        </div>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">District Possession Handover Certificates</h1>
        <p className="text-xs text-slate-500">Signing official possession certificate under Section 38 of RFCTLARR Act</p>
      </div>

      <DataTable title="Possession Handover (PostgreSQL Synced)" data={cases} columns={columns} searchPlaceholder="Search authority..." />
    </div>
  );
}
