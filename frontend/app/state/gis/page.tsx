'use client';

import React from 'react';
import { MapViewer } from '@/components/MapViewer';
import { MOCK_PARCELS } from '@/lib/mockData';

export default function StateGISPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">State PostGIS Spatial Viewer</h1>
        <p className="text-xs text-slate-500">State-wide cadastral map layer overlays and satellite land verification</p>
      </div>

      <MapViewer center={[18.5204, 73.8567]} zoom={9} parcels={MOCK_PARCELS} height="500px" />
    </div>
  );
}
