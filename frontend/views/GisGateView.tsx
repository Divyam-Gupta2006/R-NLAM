'use client';

import { CheckCircle2, Layers3, Lock, ShieldAlert, Upload } from 'lucide-react';
import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { MapLegend, ParcelMapCanvas } from '@/components/map/ParcelMap';
import type { OverlayLayer, ParcelFeature } from '@/components/map/map-types';
import { Badge, Card, DataState, Dialog, EmptyState, PageHeader, Spinner, Stat, StatusBadge } from '@/components/ui';
import { useUser } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { api, ApiError } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import { ha, humanize, num } from '@/lib/format';
import { UploadDocumentButton } from './GovernanceViews';

export interface GateItem {
  layerId: string;
  layerCode: string;
  layerName: string;
  kind: string;
  isSynthetic: boolean;
  overlapSqm: number;
  overlapPct: number;
  overlapGeometry: GeoJSON.Geometry;
  requires: string[];
  present: Array<{ kind: string; id: string; referenceNo: string | null; title: string }>;
  missing: string[];
  satisfied: boolean;
  overridable: boolean;
  citation: string;
  unverified: boolean;
}
interface Conflict {
  parcel: { id: string; parcelNumber: string; surveyNumber: string; villageName: string; districtName: string; stage: string; totalAreaHa: number; projectId: string; familiesAffected: number };
  items: GateItem[];
  blocked: boolean;
}
interface Layer {
  id: string;
  code: string;
  kind: string;
  name: string;
  source: string;
  isSynthetic: boolean;
  areaSqm: number;
  overlaps: number;
  geometry: GeoJSON.Geometry;
}

export const LAYER_COLORS: Record<string, string> = {
  FOREST: '#15803d',
  SCHEDULED_AREA: '#7c3aed',
  FRA_CLAIM: '#b45309',
  CRZ: '#0369a1',
  PROTECTED_AREA: '#0f766e',
};
const LAYER_LABEL: Record<string, string> = {
  FOREST: 'Forest land',
  SCHEDULED_AREA: 'Scheduled Area (Fifth Schedule)',
  FRA_CLAIM: 'Forest-rights claim',
  CRZ: 'Coastal Regulation Zone',
  PROTECTED_AREA: 'Protected area / ESZ',
};

export function layerOverlays(layers: Layer[]): OverlayLayer[] {
  return layers.map((l) => ({
    name: `${LAYER_LABEL[l.kind] ?? l.kind}: ${l.name}`,
    color: LAYER_COLORS[l.kind] ?? '#475569',
    dashed: l.kind === 'FRA_CLAIM' || l.kind === 'SCHEDULED_AREA',
    data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: l.geometry, properties: { name: l.name, kind: l.kind, source: l.source } }] },
    describe: (p) => `<strong>${String(p.name)}</strong><br/>${LAYER_LABEL[String(p.kind)] ?? p.kind}<br/><em>${String(p.source)}</em>`,
  }));
}

/** One overlap: what the law requires, what is on file, and the upload that clears it. */
export function GateItemCard({ item, parcelId, projectId, onChanged }: { item: GateItem; parcelId: string; projectId?: string; onChanged: () => void }) {
  return (
    <div className={`rounded-lg border p-3 ${item.satisfied ? 'border-bharat/30 bg-bharat-soft/30' : 'border-danger/30 bg-danger-soft/30'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">
          <span className="mr-1.5 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: LAYER_COLORS[item.kind] }} aria-hidden />
          {item.layerName}
        </p>
        {item.satisfied ? (
          <Badge tone="good"><CheckCircle2 className="h-3 w-3" /> Cleared</Badge>
        ) : (
          <Badge tone="bad"><Lock className="h-3 w-3" /> Blocks award & possession</Badge>
        )}
      </div>
      <p className="mt-1 text-sm">
        {LAYER_LABEL[item.kind]} overlaps <strong>{ha(item.overlapSqm / 10_000, 3)}</strong> ({item.overlapPct}% of the parcel).
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {item.requires.map((r) => {
          const doc = item.present.find((d) => d.kind === r);
          return (
            <li key={r} className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                {doc ? <CheckCircle2 className="h-4 w-4 text-bharat" /> : <ShieldAlert className="h-4 w-4 text-danger" />}
                {humanize(r)} {doc && <span className="text-xs text-ink-muted">({doc.referenceNo ?? doc.title})</span>}
              </span>
              {!doc && <UploadDocumentButton parcelId={parcelId} projectId={projectId} defaultKind={r} onDone={onChanged} />}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] font-semibold text-info">
        {item.citation}
        {item.unverified && ' · citation unverified'}
        {!item.overridable && ' · cannot be overridden'}
        {item.isSynthetic && ' · synthetic layer'}
      </p>
    </div>
  );
}

export function ParcelGateCard({ parcelId, projectId, onChanged }: { parcelId: string; projectId: string; onChanged: () => void }) {
  const state = useApi<GateItem[]>(`/gis/parcels/${parcelId}/gate`);
  if (state.data && state.data.length === 0) return null;
  return (
    <Card title="GIS consent gate" subtitle="Overlaps with regulated land, checked in PostGIS">
      <DataState state={state} rows={2}>
        {(items) => (
          <div className="space-y-2">
            {items.map((i) => (
              <GateItemCard key={i.layerId} item={i} parcelId={parcelId} projectId={projectId} onChanged={() => { state.reload(); onChanged(); }} />
            ))}
          </div>
        )}
      </DataState>
    </Card>
  );
}

function LoadLayerButton({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: '', kind: 'FOREST', name: '', source: '' });
  const [geojson, setGeojson] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Load layer
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Load a constraint layer"
        footer={
          <button
            className="btn-primary"
            disabled={busy || !geojson || !f.code || !f.name || !f.source}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                const r = await api.post<{ overlaps: number }>('/gis/layers', { ...f, code: f.code.toUpperCase(), geojson: geojson! });
                toast('success', 'Layer loaded and every parcel rescreened', `${r.overlaps} overlap(s) found`);
                setOpen(false);
                onDone();
              } catch (e) {
                setErr((e as ApiError).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Load and screen
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Code</span>
            <input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="MH-YTL-RF-214" />
          </label>
          <label className="block">
            <span className="label">Kind</span>
            <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              {Object.keys(LAYER_LABEL).map((k) => <option key={k} value={k}>{LAYER_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Name</span>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Source (map, notification, register)</span>
            <input className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">GeoJSON (Polygon, MultiPolygon or FeatureCollection, EPSG:4326)</span>
            <input
              type="file"
              accept=".geojson,.json,application/geo+json,application/json"
              className="input"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setGeojson(JSON.parse(await file.text()));
                  setErr(null);
                } catch {
                  setErr('Not valid JSON');
                }
              }}
            />
          </label>
          {err && <p className="text-sm text-danger sm:col-span-2">{err}</p>}
        </div>
      </Dialog>
    </>
  );
}

export function GisGateView({ eyebrow }: { eyebrow?: string }) {
  const user = useUser();
  const conflicts = useApi<Conflict[]>('/gis/conflicts');
  const layers = useApi<Layer[]>('/gis/layers');
  const parcels = useApi<{ features: ParcelFeature[] }>('/gis/parcels');
  const canLoad = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'GIS_OFFICER', 'DISTRICT_OFFICER'].includes(user.role);
  const reload = () => {
    conflicts.reload();
    layers.reload();
  };

  const blockedIds = useMemo(() => (conflicts.data ?? []).filter((c) => c.blocked).map((c) => c.parcel.id), [conflicts.data]);
  const overlays = useMemo<OverlayLayer[]>(() => {
    const base = layerOverlays(layers.data ?? []);
    const overlaps = (conflicts.data ?? []).flatMap((c) => c.items.filter((i) => !i.satisfied).map((i) => ({ type: 'Feature' as const, geometry: i.overlapGeometry, properties: { parcel: c.parcel.parcelNumber, layer: i.layerName, pct: i.overlapPct, missing: i.missing.map(humanize).join(', ') } })));
    if (overlaps.length) {
      base.push({
        name: 'Blocking overlap (exact intersection)',
        color: '#be123c',
        data: { type: 'FeatureCollection', features: overlaps },
        describe: (p) => `<strong>${String(p.parcel)}</strong> overlaps ${String(p.layer)} (${String(p.pct)}%)<br/>Missing: ${String(p.missing)}`,
      });
    }
    return base;
  }, [layers.data, conflicts.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={eyebrow}
        title="GIS consent gate"
        subtitle="Every parcel is intersected in PostGIS with forest, Scheduled Area, forest-rights, CRZ and protected-area layers. An overlap blocks the award and possession in the backend until the required consent or clearance is on file."
        actions={canLoad && <LoadLayerButton onDone={reload} />}
      />
      <DataState state={conflicts} isEmpty={() => false} rows={3}>
        {(cs) => (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Parcels blocked" value={num(cs.filter((c) => c.blocked).length)} tone={cs.some((c) => c.blocked) ? 'bad' : 'good'} icon={<Lock className="h-4 w-4" />} />
            <Stat label="Overlaps cleared" value={num(cs.filter((c) => !c.blocked).length)} tone="good" />
            <Stat label="Families on blocked parcels" value={num(cs.filter((c) => c.blocked).reduce((s, c) => s + c.parcel.familiesAffected, 0))} />
            <Stat label="Constraint layers" value={num(layers.data?.length)} icon={<Layers3 className="h-4 w-4" />} />
          </div>
        )}
      </DataState>
      <Card title="Map" subtitle="Layers are toggleable (top right). Red outlines: blocked parcels; red fill: the exact overlap.">
        <DataState state={parcels} rows={6}>
          {(p) => (
            <div className="space-y-2">
              <ParcelMapCanvas features={p.features} overlays={overlays} highlightIds={blockedIds} height={560} />
              <MapLegend extra={[...Object.entries(LAYER_LABEL).map(([k, label]) => ({ label, color: LAYER_COLORS[k], dashed: k === 'FRA_CLAIM' || k === 'SCHEDULED_AREA' })), { label: 'Blocked parcel', color: '#be123c' }]} />
            </div>
          )}
        </DataState>
      </Card>
      <DataState state={conflicts} empty={<EmptyState title="No parcel overlaps a constraint layer" />}>
        {(cs) => (
          <div className="grid gap-4 xl:grid-cols-2">
            {cs.map((c) => (
              <Card
                key={c.parcel.id}
                title={
                  <Link href={`/parcel/${c.parcel.id}`} className="hover:text-saffron">
                    {c.parcel.parcelNumber} · {c.parcel.villageName}
                  </Link>
                }
                subtitle={`Survey ${c.parcel.surveyNumber} · ${ha(c.parcel.totalAreaHa)} · ${c.parcel.familiesAffected} families`}
                actions={<StatusBadge status={c.parcel.stage} />}
              >
                <div className="space-y-2">
                  {c.items.map((i) => (
                    <GateItemCard key={i.layerId} item={i} parcelId={c.parcel.id} projectId={c.parcel.projectId} onChanged={reload} />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </DataState>
      <DataState state={layers} isEmpty={() => false}>
        {(ls) => (
          <Card title="Layers" subtitle="Where each came from">
            <ul className="divide-y divide-line text-sm">
              {ls.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="mr-1.5 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: LAYER_COLORS[l.kind] }} aria-hidden />
                    <strong>{l.name}</strong> <span className="text-xs text-ink-muted">· {LAYER_LABEL[l.kind]} · {l.source}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-ink-muted">
                    {ha(l.areaSqm / 10_000, 1)} · {l.overlaps} parcel overlap(s) {l.isSynthetic && <Badge tone="warn">Synthetic</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </DataState>
    </div>
  );
}
