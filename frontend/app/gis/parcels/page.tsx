'use client';

import React from 'react';
import { MapViewer } from '@/components/MapViewer';
import { MOCK_PARCELS } from '@/lib/mockData';

export default function GISParcelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Cadastral Khasra Polygon Geometry</h1>
        <p className="text-xs text-slate-500">PostGIS polygon vectors and boundary coordinate inspections</p>
      </div>

      <MapViewer center={[18.5204, 73.8567]} zoom={12} parcels={MOCK_PARCELS} height="500px" />
    </div>
  );
}
