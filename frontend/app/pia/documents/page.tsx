'use client';

import React from 'react';
import { FileText } from 'lucide-react';

export default function PIADocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">PIA Project DPR & Environmental Clearances</h1>
        <p className="text-xs text-slate-500">Social Impact Assessment (SIA), Forest & Coastal clearance docs</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
          <FileText className="w-5 h-5 text-sky-600" />
          <span className="font-bold text-xs">Detailed Project Report (DPR_MPE_Phase2.pdf)</span>
        </div>
      </div>
    </div>
  );
}
