'use client';

import React from 'react';
import { FileCheck, Upload } from 'lucide-react';
import { useRole } from '@/context/RoleContext';

export default function DistrictDocumentsPage() {
  const { showToast } = useRole();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Land Title Verification Documents</h1>
        <p className="text-xs text-slate-500">7/12 extract, 8A land revenue receipts, Aadhaar KYC verification docs</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <FileCheck className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-xs">7/12 Extract (Khasra #142/A - Lonikand)</span>
          </div>
          <button onClick={() => showToast('OCR Entity Extraction verified')} className="px-3 py-1 bg-slate-900 text-white rounded text-xs">Run OCR Analysis</button>
        </div>
      </div>
    </div>
  );
}
