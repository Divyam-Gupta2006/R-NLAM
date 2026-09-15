'use client';

import React from 'react';
import { Download, FileCode } from 'lucide-react';
import { useRole } from '@/context/RoleContext';

export default function GISExportPage() {
  const { showToast } = useRole();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Spatial Layer Export & Open Data</h1>
        <p className="text-xs text-slate-500">Export PostGIS boundary layers in standard GeoJSON, KML or Shapefile formats</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <FileCode className="w-5 h-5 text-sky-600" />
            <span className="font-bold text-xs">Mumbai-Pune Expressway Right-of-Way Layer (GeoJSON)</span>
          </div>
          <button onClick={() => showToast('Exporting GeoJSON...')} className="px-3 py-1 bg-slate-900 text-white rounded text-xs">Export GeoJSON</button>
        </div>
      </div>
    </div>
  );
}
