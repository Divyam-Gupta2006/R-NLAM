'use client';

import React, { useEffect, useState } from 'react';
import { auditApi } from '@/lib/api/client';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { DataTable, Column } from '@/components/DataTable';

export default function CentralAuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAuditData() {
      setLoading(true);
      setError(null);
      try {
        const [eventsRes, verifyRes] = await Promise.all([
          auditApi.getEvents(),
          auditApi.verifyChain(),
        ]);

        if (eventsRes.error) {
          setError(`Audit Log Error: ${eventsRes.error}`);
          setLoading(false);
          return;
        }

        setLogs(eventsRes.data || []);
        if (verifyRes.data) {
          setVerifyResult(verifyRes.data);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch audit log chain');
      } finally {
        setLoading(false);
      }
    }

    loadAuditData();
  }, []);

  const columns: Column<any>[] = [
    { header: 'Audit Event ID', accessorKey: 'id', sortable: true, cell: (l) => <span className="font-bold text-xs font-mono">{l.id.slice(0, 8)}...</span> },
    { header: 'Timestamp', accessorKey: 'createdAt', cell: (l) => <span className="font-mono text-[11px]">{new Date(l.createdAt).toLocaleString()}</span> },
    { header: 'Actor Role', accessorKey: 'actorRole', cell: (l) => <span className="font-semibold text-slate-900">{l.actorRole}</span> },
    { header: 'Action', accessorKey: 'action', cell: (l) => <span className="font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-xs">{l.action}</span> },
    { header: 'Target Entity', cell: (l) => <span className="font-mono text-xs">{l.entityType} #{l.entityId.slice(0, 8)}</span> },
    {
      header: 'Cryptographic SHA-256 Hash Block',
      cell: (l) => (
        <span className="font-mono text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded truncate max-w-[180px] inline-block" title={l.hash}>
          {l.hash}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
          <span className="font-medium text-sm">Validating SHA-256 Cryptographic Audit Hash Chain...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-2">
        <div className="flex items-center space-x-2 font-bold text-base">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>Audit Chain API Connection Error</span>
        </div>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  const isValid = verifyResult?.chainIntegrityValid === true;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cryptographic Audit Ledger</h1>
          <p className="text-xs text-slate-500">Append-only SHA-256 hash chained governance log for zero-trust compliance</p>
        </div>
        <div className={`flex items-center space-x-2 text-xs font-bold px-3 py-2 rounded-xl border shadow-xs ${
          isValid
            ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
            : 'text-rose-800 bg-rose-50 border-rose-300'
        }`}>
          <ShieldCheck className={`w-4 h-4 ${isValid ? 'text-emerald-600' : 'text-rose-600'}`} />
          <span>
            {isValid
              ? `SHA-256 Chain Integrity Verified (${verifyResult?.totalEventsAudited || 0} Events)`
              : 'Audit Chain Tampering Detected!'}
          </span>
        </div>
      </div>

      <DataTable
        title="Immutable State-Change Audit Trail (PostgreSQL Synced)"
        data={logs}
        columns={columns}
        searchPlaceholder="Search audit action, actor role..."
      />
    </div>
  );
}
