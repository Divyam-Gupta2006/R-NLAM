'use client';

import React from 'react';
import { FileText, Download } from 'lucide-react';
import { useRole } from '@/context/RoleContext';

export default function CitizenDocumentsPage() {
  const { showToast } = useRole();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Statutory Gazette Notices & Downloads</h1>
        <p className="text-xs text-slate-500">Official Section 4 & 11 Gazette notifications</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 text-xs">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-sky-600" />
            <span className="font-bold">Section 11 Preliminary Notification Gazette (MPE Phase 2)</span>
          </div>
          <button onClick={() => showToast('Downloading Gazette PDF...')} className="px-3 py-1 bg-slate-900 text-white rounded font-bold">Download</button>
        </div>
      </div>
    </div>
  );
}
