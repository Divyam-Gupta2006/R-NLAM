'use client';

import { Download, Upload } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { ParcelMap } from '@/components/map/ParcelMap';
import type { ParcelFeature } from '@/components/map/ParcelMapInner';
import { Badge, Card, DataState, EmptyState, PageHeader, Spinner, Stat, StatusBadge, Table } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { api, ApiError, qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { Jurisdiction, Project } from '@/lib/api/types';
import { ha, humanize, num } from '@/lib/format';

type Features = { features: Array<ParcelFeature & { properties: ParcelFeature['properties'] & { areaSqm: number | null } }> };

export function GisMapView({ eyebrow }: { eyebrow?: string }) {
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title="Parcel map" subtitle="Boundaries from PostGIS, coloured by lifecycle stage. Click a parcel for details." />
      <Card>
        <ParcelMap height={620} />
      </Card>
    </div>
  );
}

/** Checks the recorded area against the PostGIS-computed area of the boundary. */
export function GisQualityView() {
  const state = useApi<Features>('/gis/parcels');
  const stats = useApi<{ parcels: number; parcelsWithGeometry: number; surveyedAreaHa: number }>('/gis/stats');
  const rows = useMemo(
    () =>
      (state.data?.features ?? []).map((f) => {
        const gisHa = (f.properties.areaSqm ?? 0) / 10_000;
        const diff = f.properties.totalAreaHa ? ((gisHa - f.properties.totalAreaHa) / f.properties.totalAreaHa) * 100 : 0;
        return { ...f.properties, gisHa, diff };
      }),
    [state.data],
  );
  const flagged = rows.filter((r) => Math.abs(r.diff) > 5);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="GIS cell" title="Spatial data quality" subtitle="Recorded area (land records) versus boundary area computed by PostGIS on the ellipsoid. Differences over 5% are flagged for re-survey." />
      <DataState state={stats}>
        {(s) => (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Parcels" value={num(s.parcels)} />
            <Stat label="With boundary geometry" value={num(s.parcelsWithGeometry)} tone={s.parcelsWithGeometry === s.parcels ? 'good' : 'warn'} />
            <Stat label="Surveyed area (PostGIS)" value={ha(s.surveyedAreaHa, 1)} />
            <Stat label="Area mismatch > 5%" value={num(flagged.length)} tone={flagged.length ? 'warn' : 'good'} />
          </div>
        )}
      </DataState>
      <Card title="Area reconciliation">
        <DataState state={state}>
          {() => (
            <Table
              rows={rows}
              rowKey={(r) => r.id}
              searchText={(r) => `${r.parcelNumber} ${r.villageName}`}
              columns={[
                { key: 'p', header: 'Parcel', sortValue: (r) => r.parcelNumber, cell: (r) => <span className="font-semibold">{r.parcelNumber}</span> },
                { key: 'v', header: 'Village', sortValue: (r) => r.villageName, cell: (r) => r.villageName },
                { key: 'rec', header: 'Recorded', align: 'right', sortValue: (r) => r.totalAreaHa, cell: (r) => ha(r.totalAreaHa, 3) },
                { key: 'gis', header: 'PostGIS', align: 'right', sortValue: (r) => r.gisHa, cell: (r) => ha(r.gisHa, 3) },
                { key: 'd', header: 'Difference', align: 'right', sortValue: (r) => Math.abs(r.diff), cell: (r) => <Badge tone={Math.abs(r.diff) > 5 ? 'warn' : 'good'}>{r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)}%</Badge> },
                { key: 's', header: 'Stage', cell: (r) => <StatusBadge status={r.stage} /> },
              ]}
            />
          )}
        </DataState>
      </Card>
    </div>
  );
}

export function GisExportView() {
  const projects = useApi<Project[]>('/projects');
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const exportGeoJson = async (projectId?: string, code = 'all') => {
    setBusy(code);
    try {
      const fc = await api.get<object>(`/gis/parcels${qs({ projectId })}`);
      const blob = new Blob([JSON.stringify(fc)], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rnlam-parcels-${code}.geojson`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast('error', 'Export failed', (e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div>
      <PageHeader eyebrow="GIS cell" title="Export" subtitle="GeoJSON (EPSG:4326) straight from PostGIS, with stage and area attributes. Opens in QGIS." />
      <Card>
        <ul className="divide-y divide-line">
          <li className="flex items-center justify-between py-3">
            <span className="font-semibold">All parcels in your jurisdiction</span>
            <button className="btn-primary" disabled={!!busy} onClick={() => exportGeoJson(undefined, 'all')}>{busy === 'all' ? <Spinner /> : <Download className="h-4 w-4" />} GeoJSON</button>
          </li>
          {(projects.data ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between py-3">
              <span>
                <span className="font-semibold">{p.code}</span> <span className="text-sm text-ink-muted">{p.name}</span>
              </span>
              <button className="btn-ghost" disabled={!!busy} onClick={() => exportGeoJson(p.id, p.code)}>{busy === p.code ? <Spinner /> : <Download className="h-4 w-4" />} GeoJSON</button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

interface ImportRow {
  parcelNumber: string;
  surveyNumber: string;
  owner: string;
  areaHa: number;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown[] };
  status?: 'ok' | 'error';
  message?: string;
}

/** Import parcel boundaries from a GeoJSON FeatureCollection into a project and village. */
export function GisImportView() {
  const toast = useToast();
  const projects = useApi<Project[]>('/projects');
  const villages = useApi<Jurisdiction[]>('/jurisdictions?level=VILLAGE');
  const [projectId, setProjectId] = useState('');
  const [villageId, setVillageId] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async (file: File) => {
    try {
      const fc = JSON.parse(await file.text()) as { features?: Array<{ geometry: ImportRow['geometry']; properties?: Record<string, unknown> }> };
      const parsed = (fc.features ?? [])
        .filter((f) => f.geometry && ['Polygon', 'MultiPolygon'].includes(f.geometry.type))
        .map((f, i) => {
          const p = f.properties ?? {};
          return {
            parcelNumber: String(p.parcelNumber ?? p.parcel_no ?? `IMP-${String(i + 1).padStart(3, '0')}`),
            surveyNumber: String(p.surveyNumber ?? p.survey_no ?? p.khasra ?? '?'),
            owner: String(p.owner ?? p.displayOwnerName ?? 'Unrecorded'),
            areaHa: Number(p.areaHa ?? p.area_ha ?? p.totalAreaHa ?? 0) || 0.01,
            geometry: f.geometry,
          };
        });
      setRows(parsed);
      if (!parsed.length) toast('error', 'No polygon features found in that file');
    } catch {
      toast('error', 'Not valid GeoJSON');
    }
  };

  const importAll = async () => {
    setBusy(true);
    const out: ImportRow[] = [];
    for (const r of rows) {
      try {
        await api.post('/parcels', { projectId, villageId, parcelNumber: r.parcelNumber, surveyNumber: r.surveyNumber, totalAreaHa: r.areaHa, landClass: 'Unclassified (imported)', displayOwnerName: r.owner, geometry: r.geometry });
        out.push({ ...r, status: 'ok' });
      } catch (e) {
        out.push({ ...r, status: 'error', message: (e as ApiError).message });
      }
    }
    setRows(out);
    setBusy(false);
    toast('success', `Imported ${out.filter((r) => r.status === 'ok').length} of ${out.length} parcels`);
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="GIS cell" title="Import boundaries" subtitle="Upload a GeoJSON FeatureCollection of Polygons (EPSG:4326). PostGIS validates and repairs each geometry on insert." />
      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="label">Project</span>
            <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Choose…</option>
              {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Village</span>
            <select className="input" value={villageId} onChange={(e) => setVillageId(e.target.value)}>
              <option value="">Choose…</option>
              {(villages.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name} ({v.code})</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">GeoJSON file</span>
            <input type="file" accept=".geojson,.json,application/geo+json,application/json" className="input" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
          </label>
        </div>
        {rows.length > 0 && (
          <div className="mt-4 space-y-3">
            <Table
              rows={rows}
              rowKey={(r) => r.parcelNumber}
              columns={[
                { key: 'p', header: 'Parcel', cell: (r) => r.parcelNumber },
                { key: 's', header: 'Survey', cell: (r) => r.surveyNumber },
                { key: 'o', header: 'Owner', cell: (r) => r.owner },
                { key: 'a', header: 'Area', align: 'right', cell: (r) => ha(r.areaHa) },
                { key: 'g', header: 'Geometry', cell: (r) => humanize(r.geometry.type) },
                { key: 'st', header: 'Result', cell: (r) => (r.status === 'ok' ? <Badge tone="good">Imported</Badge> : r.status === 'error' ? <Badge tone="bad" title={r.message}>{r.message?.slice(0, 40)}</Badge> : '—') },
              ]}
            />
            <button className="btn-primary" disabled={busy || !projectId || !villageId} onClick={importAll}>
              {busy ? <Spinner /> : <Upload className="h-4 w-4" />} Import {rows.length} parcels
            </button>
          </div>
        )}
        {rows.length === 0 && <div className="mt-4"><EmptyState title="Choose a file to preview its parcels" /></div>}
      </Card>
    </div>
  );
}

export function GisAnalyticsView() {
  const state = useApi<Features>('/gis/parcels');
  return (
    <div>
      <PageHeader eyebrow="GIS cell" title="Spatial analytics" subtitle="Area by lifecycle stage and by village, from boundary geometry." />
      <DataState state={state}>
        {(d) => {
          const byStage = new Map<string, number>();
          const byVillage = new Map<string, number>();
          for (const f of d.features) {
            const a = (f.properties.areaSqm ?? 0) / 10_000;
            byStage.set(f.properties.stage, (byStage.get(f.properties.stage) ?? 0) + a);
            byVillage.set(`${f.properties.villageName}, ${f.properties.districtName}`, (byVillage.get(`${f.properties.villageName}, ${f.properties.districtName}`) ?? 0) + a);
          }
          return (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Area by stage">
                <ul className="space-y-1 text-sm">
                  {[...byStage.entries()].map(([s, a]) => (
                    <li key={s} className="flex justify-between"><StatusBadge status={s} /><span className="tabular">{ha(a, 2)}</span></li>
                  ))}
                </ul>
              </Card>
              <Card title="Area by village">
                <ul className="space-y-1 text-sm">
                  {[...byVillage.entries()].sort((a, b) => b[1] - a[1]).map(([v, a]) => (
                    <li key={v} className="flex justify-between"><span>{v}</span><span className="tabular">{ha(a, 2)}</span></li>
                  ))}
                </ul>
              </Card>
            </div>
          );
        }}
      </DataState>
    </div>
  );
}
