'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, LayersControl, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { gisApi } from '@/lib/api/client';

// Fix Leaflet default icon paths in Next.js
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = defaultIcon;

interface MapViewerInnerProps {
  projectId?: string;
  center?: [number, number];
  zoom?: number;
  height?: string;
  showLegend?: boolean;
}

export default function MapViewerInner({
  projectId,
  center = [21.1458, 79.0882],
  zoom = 13,
  height = '450px',
  showLegend = true,
}: MapViewerInnerProps) {
  const [geoJsonFeatures, setGeoJsonFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGeoJson() {
      setLoading(true);
      try {
        const res = await gisApi.getGeoJson(projectId);
        if (res.data && res.data.features) {
          setGeoJsonFeatures(res.data.features);
        }
      } catch (e) {
        console.error('Failed to fetch PostGIS GeoJSON:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchGeoJson();
  }, [projectId]);

  const getPolygonColor = (status?: string) => {
    switch (status) {
      case 'POSSESSION_TAKEN':
      case 'HANDED_TO_PIA':
      case 'VERIFIED':
        return { color: '#059669', fillColor: '#10b981', fillOpacity: 0.4 };
      case 'AWARDED':
      case 'COMPENSATION_PAID':
        return { color: '#0284c7', fillColor: '#38bdf8', fillOpacity: 0.4 };
      case 'DISPUTED':
        return { color: '#e11d48', fillColor: '#f43f5e', fillOpacity: 0.5 };
      default:
        return { color: '#d97706', fillColor: '#fbbf24', fillOpacity: 0.4 };
    }
  };

  // Convert GeoJSON Polygon coordinates [[ [lng, lat], ... ]] to Leaflet positions [[ [lat, lng], ... ]]
  const convertGeoJsonCoords = (coords: any[]) => {
    if (!coords || !Array.isArray(coords) || coords.length === 0) return [];
    const ring = coords[0] || [];
    return ring.map((pt: number[]) => [pt[1], pt[0]] as [number, number]);
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-300 shadow-md">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height, width: '100%' }}
        scrollWheelZoom={true}
        className="z-0"
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap Standard">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Esri Satellite Imagery">
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <ScaleControl position="bottomleft" />

        {/* Real PostGIS Features */}
        {geoJsonFeatures.map((feature: any) => {
          if (!feature.geometry || feature.geometry.type !== 'Polygon') return null;

          const leafletPositions = convertGeoJsonCoords(feature.geometry.coordinates);
          if (leafletPositions.length === 0) return null;

          const props = feature.properties || {};
          const style = getPolygonColor(props.status);
          const firstCoord = leafletPositions[0];

          return (
            <React.Fragment key={feature.id || props.parcelNumber}>
              <Polygon positions={leafletPositions} pathOptions={style}>
                <Popup>
                  <div className="p-1 space-y-1 text-xs">
                    <div className="font-bold text-slate-900 border-b pb-1 flex justify-between">
                      <span>Khasra #{props.khasraNumber}</span>
                      <span className="text-slate-500">{props.villageName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Owner:</span>{' '}
                      <strong className="text-slate-800">{props.landOwnerName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Area:</span> {props.totalArea} Hectares ({props.landClass})
                    </div>
                    <div>
                      <span className="text-slate-500">District:</span> {props.districtName}, {props.stateName}
                    </div>
                    <div className="pt-1 flex items-center justify-between">
                      <span className="font-semibold text-xs px-2 py-0.5 rounded bg-slate-100 border text-slate-700">
                        {props.status || 'PROPOSED'}
                      </span>
                    </div>
                  </div>
                </Popup>
              </Polygon>

              <Marker position={firstCoord}>
                <Popup>
                  <div className="text-xs font-semibold">
                    Khasra #{props.khasraNumber} - {props.landOwnerName} ({props.totalArea} ha)
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* GIS Legend */}
      {showLegend && (
        <div className="absolute bottom-4 right-4 z-10 bg-white/95 backdrop-blur-xs p-3 rounded-lg border border-slate-200 shadow-lg text-xs space-y-1.5">
          <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>PostGIS Parcel Status</span>
            <span className="text-[10px] text-sky-600 font-mono font-normal">({geoJsonFeatures.length} Features)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block border border-emerald-700"></span>
            <span className="text-slate-700">Possession Taken / Handed to PIA</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded bg-sky-500 inline-block border border-sky-700"></span>
            <span className="text-slate-700">Awarded / Compensation Paid</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block border border-amber-700"></span>
            <span className="text-slate-700">Proposed / Verification Pending</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded bg-rose-500 inline-block border border-rose-700"></span>
            <span className="text-slate-700">Disputed Parcel</span>
          </div>
        </div>
      )}
    </div>
  );
}
