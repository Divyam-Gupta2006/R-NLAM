'use client';

import React, { useEffect, useState } from 'react';
import { compensationApi } from '@/lib/api/client';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionButtons } from '@/components/ActionButtons';
import { formatCurrency } from '@/lib/utils';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function FinanceCompensationPage() {
  const [compensationCases, setCompensationCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await compensationApi.getCases();
      if (res.error) {
        setError(`Compensation API Error: ${res.error}`);
        setLoading(false);
        return;
      }
      setCompensationCases(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch compensation cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleInitiatePayment = async (caseId: string) => {
    const res = await compensationApi.initiatePayment({
      caseId,
      bankAccount: 'XXXX-XXXX-4021',
      ifscCode: 'SBIN0001234',
      amount: 1.42,
    });
    if (!res.error) {
      fetchCases();
    }
  };

  const columns: Column<any>[] = [
    { header: 'Case ID', accessorKey: 'id', cell: (c) => <span className="font-bold text-xs font-mono">{c.id.slice(0, 8)}...</span> },
    { header: 'Beneficiary Landowner', accessorKey: 'beneficiaryName', cell: (c) => <span className="font-bold text-slate-900">{c.beneficiaryName}</span> },
    { header: 'Bank Account / IFSC', accessorKey: 'bankAccount', cell: (c) => <span className="font-mono text-[11px]">{c.bankAccount} ({c.ifscCode})</span> },
    { header: 'Award Amount (Cr)', accessorKey: 'amount', cell: (c) => <span className="font-bold text-slate-900">{formatCurrency(c.amount)} Cr</span> },
    { header: 'Payment Status', accessorKey: 'status', cell: (c) => <StatusBadge status={c.status} size="sm" /> },
    {
      header: 'Actions',
      cell: (c) => (
        <ActionButtons
          entityId={c.id}
          entityType="COMPENSATION"
          allowedActions={['INITIATE_PAYMENT', 'APPROVE']}
          onActionComplete={() => handleInitiatePayment(c.id)}
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
          <span className="font-medium text-sm">Loading Compensation Ledger from NestJS Backend...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-2">
        <div className="flex items-center space-x-2 font-bold text-base">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>Compensation API Connection Error</span>
        </div>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Compensation Treasury Ledger</h1>
        <p className="text-xs text-slate-500">PFMS direct bank transfers & direct-to-bank electronic credit reference tracking</p>
      </div>

      <DataTable title="Compensation Disbursements (PostgreSQL Synced)" data={compensationCases} columns={columns} searchPlaceholder="Search beneficiary landowner..." />
    </div>
  );
}
