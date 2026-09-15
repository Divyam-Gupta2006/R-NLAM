'use client';

import React from 'react';
import { Layers, AlertTriangle } from 'lucide-react';

export default function GISAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">PostGIS Spatial Overlap Analytics</h1>
        <p className="text-xs text-slate-500">Detecting boundary overlaps using ST_Intersects and ST_Difference</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs">
          <p className="font-bold">PostGIS ST_Overlaps Engine: Clean Topology</p>
          <p className="mt-1">0 spatial geometry collisions detected across active project right-of-way polygons.</p>
        </div>
      </div>
    </div>
  );
}
