'use client';

import React from 'react';
import { Users, CheckCircle2 } from 'lucide-react';

export default function RRProgressPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">National R&R Rehabilitation Progress</h1>
        <p className="text-xs text-slate-500">Overall rehabilitation completion metrics</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="text-2xl font-extrabold text-emerald-600">530 / 1,004 Families Fully Rehabilitated</div>
        <p className="text-xs text-slate-500">52.7% completion across national project colonies</p>
      </div>
    </div>
  );
}
