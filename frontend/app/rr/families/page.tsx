'use client';

import React, { useEffect, useState } from 'react';
import { rrApi } from '@/lib/api/client';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionButtons } from '@/components/ActionButtons';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function RRFamiliesPage() {
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFamilies() {
      setLoading(true);
      setError(null);
      try {
        const res = await rrApi.getFamilies();
        if (res.error) {
          setError(`R&R API Error: ${res.error}`);
          setLoading(false);
          return;
        }
        setFamilies(res.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch affected families');
      } finally {
        setLoading(false);
      }
    }

    fetchFamilies();
  }, []);

  const columns: Column<any>[] = [
    { header: 'Family Head', accessorKey: 'headName', sortable: true, cell: (r) => <span className="font-bold text-slate-900">{r.headName}</span> },
    { header: 'Family Size', accessorKey: 'familySize', cell: (r) => <span>{r.familySize} Members</span> },
    { header: 'Village', accessorKey: 'villageName' },
    { header: 'Aadhaar Hash', accessorKey: 'idHash', cell: (r) => <span className="font-mono text-[11px] text-slate-500">{r.idHash}</span> },
    { header: 'Vulnerable Status', accessorKey: 'isVulnerable', cell: (r) => <StatusBadge status={r.isVulnerable ? 'HIGH' : 'LOW'} size="sm" /> },
    {
      header: 'Actions',
      cell: (r) => <ActionButtons entityId={r.id} entityType="RR_FAMILY" allowedActions={['APPROVE', 'RAISE_QUERY']} compact />,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
          <span className="font-medium text-sm">Loading R&R Affected Families from NestJS Backend...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-2">
        <div className="flex items-center space-x-2 font-bold text-base">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>R&R Families API Connection Error</span>
        </div>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Affected Families R&R Directory</h1>
        <p className="text-xs text-slate-500">Resettlement entitlement verification under Second Schedule of RFCTLARR Act 2013</p>
      </div>

      <DataTable title="Affected Families Master Register (PostgreSQL Synced)" data={families} columns={columns} searchPlaceholder="Search family head name..." />
    </div>
  );
}
