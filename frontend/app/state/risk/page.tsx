'use client';

import React from 'react';
import { MOCK_PROJECTS } from '@/lib/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionButtons } from '@/components/ActionButtons';

export default function StateRiskPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">State Risk Heatmap & Delays</h1>
        <p className="text-xs text-slate-500">AI delay risk scoring across state acquisition corridors</p>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
        {MOCK_PROJECTS.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-xs text-slate-900">{p.name}</h3>
              <p className="text-xs text-slate-500">{p.district} • Delay Risk: {p.delayRiskScore}/100</p>
            </div>
            <div className="flex items-center space-x-3">
              <StatusBadge status={p.slaStatus} size="sm" />
              <ActionButtons entityId={p.id} entityType="PROJECT" allowedActions={['RAISE_QUERY']} compact />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
