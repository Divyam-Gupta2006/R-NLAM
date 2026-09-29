'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { useApi } from '@/lib/api/hooks';
import { qs } from '@/lib/api/client';
import { humanize } from '@/lib/format';
import { DataState, EmptyState, LoadingBlock } from '../ui';
import type { OverlayLayer, ParcelFeature } from './ParcelMapInner';
import { STAGE_COLORS } from './ParcelMapInner';

// Leaflet touches `window`; load it only in the browser.
const Inner = dynamic(() => import('./ParcelMapInner'), { ssr: false, loading: () => <LoadingBlock rows={6} label="Loading map…" /> });

export function ParcelMapCanvas(props: { features: ParcelFeature[]; overlays?: OverlayLayer[]; height?: number | string; highlightIds?: string[]; onSelect?: (id: string) => void }) {
  return <Inner {...props} />;
}

/** Parcels from PostGIS (`GET /gis/parcels`) coloured by lifecycle stage, with a legend. */
export function ParcelMap({ projectId, height = 460, overlays, highlightIds }: { projectId?: string; height?: number | string; overlays?: OverlayLayer[]; highlightIds?: string[] }) {
  const state = useApi<{ features: ParcelFeature[] }>(`/gis/parcels${qs({ projectId })}`);
  return (
    <DataState state={state} isEmpty={(d) => d.features.length === 0} empty={<EmptyState title="No mapped parcels" detail="Parcels appear here once their boundary geometry is recorded." />} rows={6}>
      {(d) => (
        <div className="space-y-2">
          <ParcelMapCanvas features={d.features} height={height} overlays={overlays} highlightIds={highlightIds} />
          <MapLegend />
        </div>
      )}
    </DataState>
  );
}

export function MapLegend({ extra }: { extra?: Array<{ label: string; color: string; dashed?: boolean }> }) {
  const stages = ['PRELIM_NOTIFIED', 'DECLARED', 'AWARDED', 'COMPENSATION_PAID', 'POSSESSION_TAKEN', 'HANDED_OVER'];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted" aria-label="Map legend">
      {stages.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: STAGE_COLORS[s] }} aria-hidden />
          {humanize(s)}
        </li>
      ))}
      {extra?.map((e) => (
        <li key={e.label} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border-2" style={{ borderColor: e.color, borderStyle: e.dashed ? 'dashed' : 'solid' }} aria-hidden />
          {e.label}
        </li>
      ))}
    </ul>
  );
}
