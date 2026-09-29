'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useMemo } from 'react';
import { GeoJSON, LayersControl, MapContainer, ScaleControl, TileLayer, useMap } from 'react-leaflet';
import { STAGE_COLORS, type OverlayLayer, type ParcelFeature } from './map-types';

/**
 * Fit the view to the data once the container has a real size (a map mounted
 * while its page is still loading measures 0×0 and would zoom out to a continent).
 * With highlighted parcels, those are the focus (e.g. the blocked forest parcel).
 */
function FitBounds({ data, focus }: { data: GeoJSON.FeatureCollection; focus: Set<string> }) {
  const map = useMap();
  useEffect(() => {
    const target = focus.size ? { ...data, features: data.features.filter((f) => focus.has(String((f.properties as { id?: string })?.id))) } : data;
    if (!target.features.length) return;
    const b = L.geoJSON(target).getBounds();
    if (!b.isValid()) return;
    let fitted = false;
    const fit = () => {
      const el = map.getContainer();
      if (el.clientWidth < 50 || el.clientHeight < 50) return;
      map.invalidateSize();
      // One or two parcels (a citizen's land): come in close; many: keep context.
      map.fitBounds(b, { padding: [32, 32], maxZoom: target.features.length <= 2 ? 17 : focus.size ? 15 : 14 });
      fitted = true;
    };
    fit();
    const ro = new ResizeObserver(() => {
      if (!fitted) fit();
      else map.invalidateSize();
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [data, focus, map]);
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
        <FitBounds data={fc} focus={highlight} />
        <ScaleControl position="bottomleft" />
      </MapContainer>
    </div>
  );
}
