'use client';

import React from 'react';
import { MapViewer } from '@/components/MapViewer';
import { MOCK_PARCELS } from '@/lib/mockData';

export default function FieldMapPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Field Surveyor GPS Map Viewer</h1>
        <p className="text-xs text-slate-500">Real-time mobile positioning & offline tile rendering</p>
      </div>

      <MapViewer center={[18.5204, 73.8567]} zoom={13} parcels={MOCK_PARCELS} height="500px" />
    </div>
  );
}
