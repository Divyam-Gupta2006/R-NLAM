'use client';

import React from 'react';
import { StatusBadge } from '@/components/StatusBadge';

export default function DistrictSLAPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">District CALA Statutory SLA Monitor</h1>
        <p className="text-xs text-slate-500">60-day objection hearing window & Section 23 award deadlines</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between p-3 bg-rose-50 border border-rose-200 rounded-lg">
          <div>
            <h3 className="font-bold text-xs text-rose-900">Overdue Notice: Khasra 88/4</h3>
            <p className="text-xs text-rose-700">Section 15 hearing overdue by 5 days past statutory SLA</p>
          </div>
          <StatusBadge status="BREACHED" size="sm" />
        </div>
      </div>
    </div>
  );
}
