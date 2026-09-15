'use client';

import React from 'react';
import { MapViewer } from '@/components/MapViewer';
import { MOCK_PARCELS } from '@/lib/mockData';

export default function PIAGISPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">PIA Corridor Right-of-Way GIS Map</h1>
        <p className="text-xs text-slate-500">Spatial boundary overlay for infrastructure linear alignment</p>
      </div>

      <MapViewer center={[18.5204, 73.8567]} zoom={11} parcels={MOCK_PARCELS} height="460px" />
    </div>
  );
}
