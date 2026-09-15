'use client';

import React from 'react';
import { StatusBadge } from '@/components/StatusBadge';

export default function PIAProposalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">DPR Proposal Submissions</h1>
        <p className="text-xs text-slate-500">Detailed Project Reports submitted to State & CALA Collector</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div>
            <h3 className="font-bold text-xs text-slate-900">Proposal #PROP-2026-04 (NH-44 Corridor)</h3>
            <p className="text-xs text-slate-500">45.2 Hectares • Status: Under CALA Collector Review</p>
          </div>
          <StatusBadge status="SECTION_4" size="sm" />
        </div>
      </div>
    </div>
  );
}
