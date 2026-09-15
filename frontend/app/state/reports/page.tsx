'use client';

import React from 'react';
import { FileSpreadsheet, Download } from 'lucide-react';
import { useRole } from '@/context/RoleContext';

export default function StateReportsPage() {
  const { showToast } = useRole();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">State Nodal Reports & Compliance</h1>
        <p className="text-xs text-slate-500">Export state progress summaries for Cabinet reviews</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-xs">State Land Acquisition Consolidated Progress</span>
          </div>
          <button onClick={() => showToast('Exporting State Report...')} className="px-3 py-1 bg-slate-900 text-white rounded text-xs">Export</button>
        </div>
      </div>
    </div>
  );
}
