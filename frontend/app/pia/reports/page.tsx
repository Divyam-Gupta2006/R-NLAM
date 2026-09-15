'use client';

import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

export default function PIAReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">PIA Agency Infrastructure Reports</h1>
        <p className="text-xs text-slate-500">Right-of-way availability reports for Project Directors</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-xs">Right-of-Way Availability Schedule (MPE Phase II)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
