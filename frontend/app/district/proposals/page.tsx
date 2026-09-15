'use client';

import React, { useEffect, useState } from 'react';
import { proposalsApi } from '@/lib/api/client';
import { ActionButtons } from '@/components/ActionButtons';
import { StatusBadge } from '@/components/StatusBadge';
import { DataTable, Column } from '@/components/DataTable';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function DistrictProposalsPage() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await proposalsApi.getAll();
      if (res.error) {
        setError(`Proposals API Error: ${res.error}`);
        setLoading(false);
        return;
      }
      setProposals(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch proposals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleStatusChange = async (proposalId: string, newStatus: string) => {
    const res = await proposalsApi.updateStatus(proposalId, newStatus);
    if (!res.error) {
      fetchProposals();
    }
  };

  const columns: Column<any>[] = [
    { header: 'Proposal ID', accessorKey: 'id', cell: (p) => <span className="font-bold font-mono text-xs">{p.id.slice(0, 8)}...</span> },
    { header: 'Project Title', accessorKey: 'title', cell: (p) => <span className="font-bold text-slate-900">{p.title}</span> },
    { header: 'Required Area', accessorKey: 'landRequired', cell: (p) => <span>{p.landRequired} Hectares</span> },
    { header: 'Submitted Date', accessorKey: 'submittedAt', cell: (p) => <span>{p.submittedAt ? new Date(p.submittedAt).toLocaleDateString() : 'N/A'}</span> },
    { header: 'Status', accessorKey: 'status', cell: (p) => <StatusBadge status={p.status} size="sm" /> },
    {
      header: 'Actions',
      cell: (p) => (
        <ActionButtons
          entityId={p.id}
          entityType="PROPOSAL"
          allowedActions={['APPROVE', 'RETURN', 'REJECT']}
          onActionComplete={(act) => handleStatusChange(p.id, act === 'APPROVE' ? 'APPROVED' : (act === 'REJECT' ? 'REJECTED' : 'CORRECTION_REQUIRED'))}
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
          <span className="font-medium text-sm">Loading District Proposals from NestJS Backend...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-2">
        <div className="flex items-center space-x-2 font-bold text-base">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>Proposals API Connection Error</span>
        </div>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">PIA Land Acquisition Proposals</h1>
        <p className="text-xs text-slate-500">Initial Section 4 proposals submitted by NHAI, Railways & State Agencies</p>
      </div>

      <DataTable title="Submitted Proposals (PostgreSQL Synced)" data={proposals} columns={columns} searchPlaceholder="Search proposals by title..." />
    </div>
  );
}
