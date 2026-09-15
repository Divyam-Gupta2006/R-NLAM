'use client';

import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

export default function RRReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">R&R Compliance Audit Reports</h1>
        <p className="text-xs text-slate-500">Statutory R&R compliance reports submitted to Ministry of Social Justice</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
          <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
          <span className="font-bold text-xs">National R&R Entitlement Audit Statement (2026)</span>
        </div>
      </div>
    </div>
  );
}
