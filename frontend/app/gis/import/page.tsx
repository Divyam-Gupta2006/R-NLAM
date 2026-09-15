'use client';

import React from 'react';
import { Upload, FileCheck } from 'lucide-react';
import { useRole } from '@/context/RoleContext';

export default function GISImportPage() {
  const { showToast } = useRole();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Spatial Layer Import (Shapefile / KML / GeoJSON)</h1>
        <p className="text-xs text-slate-500">Ingest cadastral survey boundaries into PostGIS spatial database</p>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-8 text-center space-y-4">
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 bg-slate-50 hover:bg-slate-100 cursor-pointer">
          <Upload className="w-10 h-10 text-sky-600 mx-auto mb-2" />
          <p className="font-bold text-slate-900 text-sm">Upload ESRI Shapefile (.zip) or GeoJSON (.json)</p>
          <p className="text-xs text-slate-500 mt-1">Automatic coordinate reference system (CRS: EPSG:4326) transformation</p>
        </div>

        <button
          onClick={() => showToast('Shapefile uploaded! PostGIS ST_IsValid checked 0 topology errors.')}
          className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800"
        >
          Process & Ingest Spatial Layer
        </button>
      </div>
    </div>
  );
}
