'use client';

import React from 'react';
import { MapViewer } from '@/components/MapViewer';
import { MOCK_PARCELS } from '@/lib/mockData';

export default function GISProjectsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">National GIS Infrastructure Projects Map</h1>
        <p className="text-xs text-slate-500">PostGIS 3.4 spatial layers overlay across national transport corridors</p>
      </div>

      <MapViewer center={[20.5937, 78.9629]} zoom={5} parcels={MOCK_PARCELS} height="520px" />
    </div>
  );
}
