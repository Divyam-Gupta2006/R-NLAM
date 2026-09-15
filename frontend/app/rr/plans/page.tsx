'use client';

import React from 'react';
import { Building, MapPin } from 'lucide-react';

export default function RRPlansPage() {
  const colonies = [
    { name: 'Lonikand Sector 5 R&R Colony', district: 'Pune', plots: 180, constructed: 145 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Resettlement Colony Infrastructure Plans</h1>
        <p className="text-xs text-slate-500">Infrastructure planning: roads, electricity, drinking water, schools & primary health centers</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        {colonies.map((c, idx) => (
          <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs text-slate-900">{c.name}</h3>
              <p className="text-xs text-slate-500">District: {c.district} • {c.constructed}/{c.plots} Housing Plots Allocated</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
