'use client';

import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

export default function FinanceReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Financial Audit & Reconciliation Reports</h1>
        <p className="text-xs text-slate-500">CAG & Treasury financial statements</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <span className="font-bold text-xs">PFMS Annual Disbursement Audit Certificate (2026)</span>
        </div>
      </div>
    </div>
  );
}
