'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useMemo } from 'react';
import { GeoJSON, LayersControl, MapContainer, ScaleControl, TileLayer, useMap } from 'react-leaflet';
import type { ParcelStage } from '@/lib/api/types';

export interface ParcelFeature {
  type: 'Feature';
  id: string;
  geometry: GeoJSON.Geometry;
  properties: {
    id: string;
    parcelNumber: string;
    surveyNumber: string;
    villageName: string;
    districtName: string;
    totalAreaHa: number;
    stage: ParcelStage;
    displayOwnerName: string;
    [k: string]: unknown;
  };
}

export interface OverlayLayer {
  name: string;
  color: string;
  data: GeoJSON.FeatureCollection;
  dashed?: boolean;
  /** Popup HTML for a feature of this layer. */
  describe?: (props: Record<string, unknown>) => string;
}

export const STAGE_COLORS: Record<string, string> = {
  IDENTIFIED: '#94a3b8',
  PRELIM_NOTIFIED: '#0ea5e9',
  DECLARED: '#6366f1',
  AWARDED: '#e87722',
  COMPENSATION_PAID: '#16a34a',
  POSSESSION_TAKEN: '#15803d',
  HANDED_OVER: '#0f5132',
  LAPSED: '#be123c',
  WITHDRAWN: '#64748b',
};

function FitBounds({ data }: { data: GeoJSON.FeatureCollection }) {
  const map = useMap();
  useEffect(() => {
    if (!data.features.length) return;
    const b = L.geoJSON(data).getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [24, 24], maxZoom: 16 });
  }, [data, map]);
  return null;
}

const escapeHtml = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export default function ParcelMapInner({
  features,
  overlays = [],
  height = 460,
  highlightIds = [],
  onSelect,
}: {
  features: ParcelFeature[];
  overlays?: OverlayLayer[];
  height?: number | string;
  highlightIds?: string[];
  onSelect?: (id: string) => void;
}) {
  const fc = useMemo<GeoJSON.FeatureCollection>(() => ({ type: 'FeatureCollection', features: features as unknown as GeoJSON.Feature[] }), [features]);
  const highlight = useMemo(() => new Set(highlightIds), [highlightIds]);
  const key = useMemo(() => features.map((f) => f.id + f.properties.stage).join('|') + highlightIds.join(','), [features, highlightIds]);

  return (
    <div style={{ height }} className="overflow-hidden rounded-[var(--radius)] border border-line">
      <MapContainer center={[20.6, 78.4]} zoom={9} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Streets">
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite (Esri)">
            <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          </LayersControl.BaseLayer>
          {overlays.map((o) => (
            <LayersControl.Overlay checked key={o.name} name={o.name}>
              <GeoJSON
                data={o.data}
                style={{ color: o.color, weight: 1.5, fillOpacity: 0.18, dashArray: o.dashed ? '6 4' : undefined }}
                onEachFeature={(f, layer) => o.describe && layer.bindPopup(o.describe((f.properties ?? {}) as Record<string, unknown>))}
              />
            </LayersControl.Overlay>
          ))}
        </LayersControl>
        <GeoJSON
          key={key}
          data={fc}
          style={(f) => {
            const p = (f?.properties ?? {}) as ParcelFeature['properties'];
            const hot = highlight.has(p.id);
            return { color: hot ? '#be123c' : STAGE_COLORS[p.stage] ?? '#475569', weight: hot ? 3 : 1.2, fillColor: hot ? '#f43f5e' : STAGE_COLORS[p.stage] ?? '#475569', fillOpacity: hot ? 0.55 : 0.45 };
          }}
          onEachFeature={(f, layer) => {
            const p = f.properties as ParcelFeature['properties'];
            layer.bindPopup(
              `<strong>${escapeHtml(p.parcelNumber)}</strong><br/>Survey ${escapeHtml(p.surveyNumber)} · ${escapeHtml(p.villageName)}<br/>${escapeHtml(p.totalAreaHa)} ha · ${escapeHtml(String(p.stage).replace(/_/g, ' '))}<br/>${escapeHtml(p.displayOwnerName)}<br/><a href="/parcel/${encodeURIComponent(p.id)}">Open parcel →</a>`,
            );
            if (onSelect) layer.on('click', () => onSelect(p.id));
          }}
        />
        <FitBounds data={fc} />
        <ScaleControl position="bottomleft" />
      </MapContainer>
    </div>
  );
}
