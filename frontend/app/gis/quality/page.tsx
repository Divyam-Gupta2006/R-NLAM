'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function GISQualityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Boundary Data Quality & Precision Audit</h1>
        <p className="text-xs text-slate-500">Coordinate accuracy, polygon closure verification & ground survey geotag validation</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg text-xs">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span className="font-bold">100% Polygon Closure Accuracy (Sub-meter GPS Differential)</span>
        </div>
      </div>
    </div>
  );
}
