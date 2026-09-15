'use client';

import React from 'react';
import { FileSpreadsheet, Download, Filter, FileText } from 'lucide-react';
import { useRole } from '@/context/RoleContext';

export default function CentralReportsPage() {
  const { showToast } = useRole();

  const reports = [
    { title: 'National Monthly Land Acquisition Status Report', type: 'PDF / Excel', date: 'Sep 2026', size: '4.2 MB' },
    { title: 'SLA Statutory Compliance & Delay Audit', type: 'PDF', date: 'Q2 2026', size: '1.8 MB' },
    { title: 'PFMS Compensation Disbursement Ledger', type: 'CSV / Excel', date: 'Sep 2026', size: '12.4 MB' },
    { title: 'R&R Family Entitlements & Housing Progress', type: 'PDF', date: 'Aug 2026', size: '3.1 MB' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">National Executive Reports Repository</h1>
        <p className="text-xs text-slate-500">Generate, export, and schedule statutory gazette reports & financial statements</p>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 divide-y divide-slate-100">
        {reports.map((r, idx) => (
          <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-semibold text-xs text-slate-900">{r.title}</h3>
                <span className="text-[11px] text-slate-500">{r.type} • {r.date} • {r.size}</span>
              </div>
            </div>

            <button
              onClick={() => showToast(`Downloading ${r.title}...`)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
