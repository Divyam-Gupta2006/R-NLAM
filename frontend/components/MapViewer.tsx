'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const MapViewerInner = dynamic(() => import('./MapViewerInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] bg-slate-100 rounded-xl animate-pulse flex items-center justify-center border border-slate-300">
      <div className="text-center text-slate-500">
        <div className="w-8 h-8 border-4 border-slate-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-xs font-semibold">Loading PostGIS Interactive Map Viewer...</p>
      </div>
    </div>
  ),
});

interface MapViewerProps {
  projectId?: string;
  center?: [number, number];
  zoom?: number;
  parcels?: any[];
  height?: string;
  showLegend?: boolean;
}

export function MapViewer(props: MapViewerProps) {
  return <MapViewerInner {...props} />;
}
