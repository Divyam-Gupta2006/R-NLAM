'use client';

import React from 'react';
import { FileText, Download } from 'lucide-react';
import { useRole } from '@/context/RoleContext';

export default function StateStatutoryPage() {
  const { showToast } = useRole();

  const gazettes = [
    { title: 'Maharashtra State Gazette No. 402/2026 - Section 4 Notification', date: '12 Aug 2026' },
    { title: 'Maharashtra State Gazette No. 518/2026 - Section 19 Declaration', date: '01 Sep 2026' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">State Official Gazette Publications</h1>
        <p className="text-xs text-slate-500">Legal notifications published under RFCTLARR Act in state Extraordinary Gazette</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {gazettes.map((g, idx) => (
          <div key={idx} className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-bold text-xs text-slate-900">{g.title}</h3>
                <span className="text-[11px] text-slate-500">Published on {g.date}</span>
              </div>
            </div>
            <button
              onClick={() => showToast('Downloading Official Gazette PDF...')}
              className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800"
            >
              Download PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
