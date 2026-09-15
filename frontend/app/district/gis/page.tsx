'use client';

import React from 'react';
import { MapViewer } from '@/components/MapViewer';
import { MOCK_PARCELS } from '@/lib/mockData';

export default function DistrictGISPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">District Cadastral Spatial Map</h1>
        <p className="text-xs text-slate-500">PostGIS polygon map layer for district khasras</p>
      </div>

      <MapViewer center={[18.5204, 73.8567]} zoom={12} parcels={MOCK_PARCELS} height="480px" />
    </div>
  );
}
