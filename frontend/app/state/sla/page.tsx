'use client';

import React from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { Clock, AlertTriangle } from 'lucide-react';

export default function StateSLAPage() {
  const slaItems = [
    { project: 'Mumbai-Pune Expressway', stage: 'Section 19 Gazette', deadline: '2026-10-15', daysLeft: 30, status: 'ON_TRACK' },
    { project: 'Delhi-Varanasi HSR', stage: 'Section 11 Hearing', deadline: '2026-09-10', daysLeft: -5, status: 'BREACHED' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">State SLA & Statutory Timeline Tracker</h1>
        <p className="text-xs text-slate-500">Legal limits under RFCTLARR Act 2013 for gazette declarations</p>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 divide-y divide-slate-100">
        {slaItems.map((item, idx) => (
          <div key={idx} className="p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs text-slate-900">{item.project}</h3>
              <p className="text-xs text-slate-500">{item.stage} • Deadline: {item.deadline}</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`text-xs font-bold ${item.daysLeft < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {item.daysLeft < 0 ? `${Math.abs(item.daysLeft)} days overdue` : `${item.daysLeft} days remaining`}
              </span>
              <StatusBadge status={item.status} size="sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
