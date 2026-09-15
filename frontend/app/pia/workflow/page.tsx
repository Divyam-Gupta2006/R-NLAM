'use client';

import React from 'react';
import { StatusBadge } from '@/components/StatusBadge';

export default function PIAWorkflowPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">PIA Statutory Milestone Workflow</h1>
        <p className="text-xs text-slate-500">Milestone monitoring for gazette notices and award declarations</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div>
            <h3 className="font-bold text-xs text-slate-900">MPE-PH2 Corridor Acquisition Stage</h3>
            <p className="text-xs text-slate-500 font-mono">Current Stage: Section 19 Gazette Declaration</p>
          </div>
          <StatusBadge status="SECTION_19" size="sm" />
        </div>
      </div>
    </div>
  );
}
