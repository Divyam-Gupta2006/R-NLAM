'use client';

import React from 'react';
import { GitBranch, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

export default function CentralWorkflowsPage() {
  const stages = [
    { name: 'Section 4 Notification', limit: '30 Days SLA', desc: 'Preliminary notification of land requirement & survey intent.' },
    { name: 'Section 11 Hearing & SIA', limit: '60 Days SLA', desc: 'Social Impact Assessment & public objection hearings by CALA.' },
    { name: 'Section 19 Gazette Declaration', limit: '12 Months SLA', desc: 'Final declaration of land acquisition requirement by State Gov.' },
    { name: 'Section 23 Compensation Award', limit: '6 Months SLA', desc: 'Award determination, solatium calculation & PFMS deposit.' },
    { name: 'Section 38 Possession Handover', limit: '60 Days SLA', desc: 'Physical eviction, encumbrance release & transfer to PIA.' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">RFCTLARR Statutory SLA Workflows</h1>
        <p className="text-xs text-slate-500">Legal stage progression rules, escalation triggers & statutory time bounds</p>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6">
        <h2 className="text-sm font-bold text-slate-900">5-Stage Statutory Workflow Lifecycle</h2>

        <div className="space-y-4">
          {stages.map((stage, idx) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">{stage.name}</h3>
                  <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                    {stage.limit}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{stage.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
