'use client';

import { Camera, CheckCircle2, Crosshair, Footprints, Lock, MapPin, Satellite, Trash2, Undo2, XCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOnline } from '@/components/field/FieldRuntime';
import { Badge, Card, DataState, Dialog, EmptyState, PageHeader, Spinner, SyntheticTag, Tabs } from '@/components/ui';
import { useUser } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { api, ApiError, qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { Paged, Parcel } from '@/lib/api/types';
import { accuracyBand, averageFixes, closeRing, EvidenceBundle, Fix, LngLat, ringAreaSqm, sealBundle, sha256Hex } from '@/lib/field/bundle';
import { clearSynced, deviceId, isOnline, lastSeen, listBundles, putBundle, QUEUE_EVENT, QueuedBundle, QueuedPhoto, resetDevice, syncNow } from '@/lib/field/queue';
import { dateTimeIST, humanize } from '@/lib/format';
import { cn } from '@/lib/utils';

/* ----------------------------------------------------------- offline parcel list */

interface FieldParcel {
  id: string;
  parcelNumber: string;
  surveyNumber: string;
  villageName: string;
  stage: string;
  ring: LngLat[] | null;
}
const PARCELS_KEY = 'rnlam.field.parcels';

function ringOf(g: Parcel['geometry']): LngLat[] | null {
  if (!g) return null;
  if (g.type === 'Polygon') return (g.coordinates[0] as number[][]).map((p) => [p[0], p[1]] as LngLat);
  if (g.type === 'MultiPolygon') return (g.coordinates[0][0] as number[][]).map((p) => [p[0], p[1]] as LngLat);
  return null;
}

/** Parcels in the officer's jurisdiction, cached on the device for offline use. */
function useFieldParcels() {
  const online = useOnline();
  const [parcels, setParcels] = useState<FieldParcel[]>([]);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PARCELS_KEY);
      if (raw) {
        const c = JSON.parse(raw) as { at: string; items: FieldParcel[] };
        setParcels(c.items);
        setCachedAt(c.at);
      }
    } catch {
      /* no cache yet */
    }
  }, []);
  useEffect(() => {
    if (!online) return;
    api
      .get<Paged<Parcel>>(`/parcels${qs({ pageSize: 500 })}`)
      .then((r) => {
        const items = r.items.map((p) => ({ id: p.id, parcelNumber: p.parcelNumber, surveyNumber: p.surveyNumber, villageName: p.villageName, stage: p.stage, ring: ringOf(p.geometry) }));
        const at = new Date().toISOString();
        setParcels(items);
        setCachedAt(at);
        try {
          localStorage.setItem(PARCELS_KEY, JSON.stringify({ at, items }));
        } catch {
          /* storage full: work from memory */
        }
      })
      .catch(() => undefined);
  }, [online]);
  return { parcels, cachedAt };
}

/* ----------------------------------------------------------- GNSS */

type GnssState = 'idle' | 'listening' | 'denied' | 'unavailable';

/**
 * Live GNSS fixes from the device. `simulate` stands in for a receiver on a
 * laptop at a demo: fixes scatter (±1.5 m) around `target`, the spot the
 * officer is standing at (the next corner, or the parcel centre), and the
 * bundle is sealed as SIMULATED.
 */
function useGnss(target: LngLat | null, simulate: boolean) {
  const [state, setState] = useState<GnssState>('idle');
  const [window_, setWindow] = useState<Fix[]>([]);
  const [error, setError] = useState<string | null>(null);
  const watch = useRef<number | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;

  const stop = useCallback(() => {
    if (watch.current !== null) {
      if (watch.current >= 0) navigator.geolocation.clearWatch(watch.current);
      else clearInterval(-watch.current);
    }
    watch.current = null;
    setState('idle');
  }, []);

  const start = useCallback(() => {
    stop();
    setWindow([]);
    setError(null);
    if (simulate) {
      if (!targetRef.current) {
        setError('This parcel has no recorded boundary to simulate a walk around.');
        return;
      }
      const noise = () => (Math.random() - 0.5) * 2 * (1.5 / 111_195);
      const id = window.setInterval(() => {
        const t = targetRef.current;
        if (!t) return;
        setWindow((w) => [...w.slice(-29), { lng: t[0] + noise(), lat: t[1] + noise(), accuracyM: Math.round((2.5 + Math.random() * 3) * 10) / 10, at: new Date().toISOString() }]);
      }, 500);
      watch.current = -id;
      setState('listening');
      return;
    }
    if (!('geolocation' in navigator)) {
      setState('unavailable');
      setError('This device has no location service.');
      return;
    }
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setState('listening');
        setWindow((w) => [...w.slice(-29), { lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy * 10) / 10, at: new Date(p.timestamp).toISOString() }]);
      },
      (e) => {
        setState(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable');
        setError(e.code === e.PERMISSION_DENIED ? 'Location permission was refused. Allow it in the browser settings.' : `No position: ${e.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
    setState('listening');
  }, [simulate, stop]);

  useEffect(() => stop, [stop]);
  const current = window_.length ? window_[window_.length - 1] : null;
  return { state, error, fixes: window_, current, start, stop, reset: () => setWindow([]) };
}

const BAND_STYLE = { good: 'bg-bharat-soft text-bharat', fair: 'bg-warning-soft text-warning', poor: 'bg-danger-soft text-danger' };

/* ----------------------------------------------------------- sketch (no map tiles needed offline) */

function Sketch({ recorded, walked, point }: { recorded: LngLat[] | null; walked: LngLat[]; point: LngLat | null }) {
  const all = [...(recorded ?? []), ...walked, ...(point ? [point] : [])];
  if (!all.length) return null;
  const lat0 = (all.reduce((s, p) => s + p[1], 0) / all.length) * (Math.PI / 180);
  const xy = (p: LngLat) => [p[0] * Math.cos(lat0), -p[1]];
  const pts = all.map(xy);
  const [minX, maxX] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
  const [minY, maxY] = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const S = 220;
  const pad = 14;
  const map = (p: LngLat) => {
    const [x, y] = xy(p);
    return `${pad + ((x - minX) / span) * (S - 2 * pad)},${pad + ((y - minY) / span) * (S - 2 * pad)}`;
  };
  const metres = span * 111_195;
  return (
    <figure className="rounded-md border border-line bg-surface p-2">
      <svg viewBox={`0 0 ${S} ${S}`} className="h-56 w-full" role="img" aria-label="Sketch of the recorded boundary and what was captured">
        {recorded && <polygon points={recorded.map(map).join(' ')} fill="none" stroke="rgb(var(--navy))" strokeDasharray="4 3" strokeWidth={1.5} />}
        {walked.length > 1 && <polyline points={walked.map(map).join(' ')} fill="rgb(var(--saffron) / 0.15)" stroke="rgb(var(--saffron))" strokeWidth={2} />}
        {walked.map((p, i) => {
          const [x, y] = map(p).split(',').map(Number);
          return <circle key={i} cx={x} cy={y} r={3} fill="rgb(var(--saffron))" />;
        })}
        {point &&
          (() => {
            const [x, y] = map(point).split(',').map(Number);
            return <circle cx={x} cy={y} r={5} fill="rgb(var(--saffron))" stroke="white" strokeWidth={2} />;
          })()}
      </svg>
      <figcaption className="flex justify-between text-[11px] text-ink-muted">
        <span>
          <span className="inline-block w-4 border-t-2 border-dashed border-navy align-middle" /> recorded boundary · <span className="inline-block h-2 w-2 rounded-full bg-saffron align-middle" /> captured
        </span>
        <span>about {metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`} across</span>
      </figcaption>
    </figure>
  );
}

/* ----------------------------------------------------------- capture */

export function FieldCaptureView() {
  const params = useSearchParams();
  const toast = useToast();
  const online = useOnline();
  const { parcels, cachedAt } = useFieldParcels();
  const [parcelId, setParcelId] = useState<string>(params.get('parcel') ?? '');
  const parcel = parcels.find((p) => p.id === parcelId) ?? null;
  const [mode, setMode] = useState<'POINT' | 'POLYGON'>('POINT');
  const [simulate, setSimulate] = useState(false);
  const [point, setPoint] = useState<{ lng: number; lat: number; accuracyM: number; samples: number } | null>(null);
  const [corners, setCorners] = useState<Array<{ p: LngLat; accuracyM: number; samples: number }>>([]);
  // Where a simulated officer stands: the next recorded corner, or the parcel centre for a point.
  const simTarget = useMemo<LngLat | null>(() => {
    const r = parcel?.ring?.slice(0, -1);
    if (!r || r.length < 3) return null;
    if (mode === 'POLYGON') return r[corners.length % r.length];
    return [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];
  }, [parcel, mode, corners.length]);
  const gnss = useGnss(simTarget, simulate);
  const [photos, setPhotos] = useState<QueuedPhoto[]>([]);
  const [note, setNote] = useState('');
  const [sealing, setSealing] = useState(false);
  const [sealed, setSealed] = useState<QueuedBundle | null>(null);

  // Remember when this device last saw the server's evidence for the parcel.
  useEffect(() => {
    if (!online || !parcelId) return;
    api
      .get<{ serverTime: string }>(`/field/evidence${qs({ parcelId })}`)
      .then((r) => lastSeen.set(parcelId, r.serverTime))
      .catch(() => undefined);
  }, [online, parcelId]);

  const resetCapture = () => {
    setPoint(null);
    setCorners([]);
    setPhotos([]);
    setNote('');
    gnss.reset();
  };

  const takeFix = () => {
    if (!gnss.fixes.length) return;
    const recent = gnss.fixes.slice(-10);
    const avg = averageFixes(recent);
    if (mode === 'POINT') setPoint(avg);
    else setCorners((c) => [...c, { p: [avg.lng, avg.lat], accuracyM: avg.accuracyM, samples: avg.samples }]);
    gnss.reset();
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const next: QueuedPhoto[] = [];
    for (const f of Array.from(files).slice(0, 6 - photos.length)) {
      next.push({ name: f.name || 'photo.jpg', type: f.type || 'image/jpeg', blob: f, sha256: await sha256Hex(await f.arrayBuffer()) });
    }
    setPhotos((p) => [...p, ...next]);
  };

  const ring = closeRing(corners.map((c) => c.p));
  const ready = parcel && (mode === 'POINT' ? !!point : corners.length >= 3);

  const seal = async () => {
    if (!parcel || !ready) return;
    setSealing(true);
    try {
      const bundle: EvidenceBundle = {
        clientId: crypto.randomUUID(),
        deviceId: deviceId(),
        parcelId: parcel.id,
        kind: mode,
        geometry: mode === 'POINT' ? { type: 'Point', coordinates: [point!.lng, point!.lat] } : { type: 'Polygon', coordinates: [ring] },
        accuracyM: mode === 'POINT' ? point!.accuracyM : Math.max(...corners.map((c) => c.accuracyM)),
        samples: mode === 'POINT' ? point!.samples : corners.reduce((s, c) => s + c.samples, 0),
        capturedAt: new Date().toISOString(),
        baseSyncedAt: lastSeen.get(parcel.id),
        note: note.trim() || null,
        photoHashes: photos.map((p) => p.sha256),
        positionSource: simulate ? 'SIMULATED' : 'DEVICE_GNSS',
      };
      const q: QueuedBundle = { ...bundle, bundleHash: await sealBundle(bundle), parcelNumber: parcel.parcelNumber, photos, status: 'QUEUED', queuedAt: new Date().toISOString(), attempts: 0, lastAttemptAt: null, error: null, server: null };
      await putBundle(q);
      setSealed(q);
      resetCapture();
      gnss.stop();
      if (isOnline()) void syncNow();
    } catch (e) {
      toast('error', 'Could not save on this device', (e as Error).message);
    } finally {
      setSealing(false);
    }
  };

  const band = gnss.current ? accuracyBand(gnss.current.accuracyM) : null;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader eyebrow="Field app" title="Capture evidence" subtitle="Works without a connection. Each capture is sealed with SHA-256 on this device, then uploaded when you are back online." />

      <Card title="1. Parcel">
        <label className="block">
          <span className="label">Parcel</span>
          <select className="input" value={parcelId} onChange={(e) => { setParcelId(e.target.value); resetCapture(); }}>
            <option value="">Choose a parcel…</option>
            {parcels.map((p) => (
              <option key={p.id} value={p.id}>
                {p.parcelNumber} · survey {p.surveyNumber}, {p.villageName} ({humanize(p.stage)})
              </option>
            ))}
          </select>
        </label>
        <p className="mt-1 text-xs text-ink-muted">
          {parcels.length ? `${parcels.length} parcels on this device${cachedAt ? `, list saved ${dateTimeIST(cachedAt)}` : ''}.` : online ? 'Loading your parcels…' : 'No parcels saved on this device yet. Open this page once while online.'}
        </p>
      </Card>

      {parcel && (
        <Card
          title="2. Position"
          actions={
            <Tabs
              value={mode}
              onChange={(m) => {
                setMode(m);
                resetCapture();
              }}
              tabs={[
                { key: 'POINT', label: 'Point' },
                { key: 'POLYGON', label: 'Walk the boundary' },
              ]}
            />
          }
        >
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={simulate} onChange={(e) => { setSimulate(e.target.checked); gnss.stop(); }} />
              Demo without a GNSS receiver: simulate a walk around the recorded boundary <SyntheticTag />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {gnss.state !== 'listening' ? (
                <button className="btn-primary" onClick={gnss.start}>
                  <Satellite className="h-4 w-4" /> Start GNSS
                </button>
              ) : (
                <button className="btn-ghost" onClick={gnss.stop}>
                  Stop
                </button>
              )}
              <button className="btn-primary" disabled={!gnss.fixes.length} onClick={takeFix}>
                {mode === 'POINT' ? <Crosshair className="h-4 w-4" /> : <Footprints className="h-4 w-4" />} {mode === 'POINT' ? 'Record this point' : 'Add corner here'}
              </button>
              {mode === 'POLYGON' && corners.length > 0 && (
                <button className="btn-ghost" onClick={() => setCorners((c) => c.slice(0, -1))}>
                  <Undo2 className="h-4 w-4" /> Undo corner
                </button>
              )}
            </div>
            {gnss.error && <p role="alert" className="text-sm text-danger">{gnss.error}</p>}
            {gnss.current && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={cn('rounded-md px-2 py-0.5 font-bold', band && BAND_STYLE[band])}>± {gnss.current.accuracyM} m</span>
                <span className="tabular text-ink-muted">
                  {gnss.current.lat.toFixed(6)}, {gnss.current.lng.toFixed(6)} · {gnss.fixes.length} fix(es) averaged when you record
                </span>
                {band === 'poor' && <span className="text-xs text-danger">Weak fix: move into the open and wait.</span>}
              </div>
            )}
            {mode === 'POINT' && point && (
              <p className="text-sm">
                <MapPin className="mr-1 inline h-4 w-4 text-saffron" />
                Point {point.lat.toFixed(6)}, {point.lng.toFixed(6)} · ± {point.accuracyM} m from {point.samples} fixes
              </p>
            )}
            {mode === 'POLYGON' && corners.length > 0 && (
              <p className="text-sm">
                {corners.length} corner(s){corners.length >= 3 ? ` · about ${(ringAreaSqm(ring) / 10_000).toFixed(3)} ha walked` : ' · need at least 3'}
              </p>
            )}
            <Sketch recorded={parcel.ring} walked={corners.map((c) => c.p)} point={point ? [point.lng, point.lat] : null} />
          </div>
        </Card>
      )}

      {parcel && (
        <Card title="3. Photos and note">
          <div className="space-y-3">
            <label className="btn-ghost cursor-pointer">
              <Camera className="h-4 w-4" /> Add photos ({photos.length}/6)
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="sr-only" onChange={(e) => void addPhotos(e.target.files)} disabled={photos.length >= 6} />
            </label>
            {photos.length > 0 && (
              <ul className="space-y-1 text-xs">
                {photos.map((p, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <code>{p.sha256.slice(0, 16)}…</code> {p.name}
                    <button aria-label={`Remove ${p.name}`} className="text-danger" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="block">
              <span className="label">Note</span>
              <textarea className="input min-h-[70px]" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you saw: structures, crops, boundary stones, who was present" />
            </label>
            <button className="btn-primary w-full justify-center" disabled={!ready || sealing} onClick={seal}>
              {sealing ? <Spinner /> : <Lock className="h-4 w-4" />} Seal and queue
            </button>
          </div>
        </Card>
      )}

      <Dialog open={!!sealed} onClose={() => setSealed(null)} title="Sealed on this device">
        {sealed && (
          <div className="space-y-2 text-sm">
            <p>
              <CheckCircle2 className="mr-1 inline h-4 w-4 text-bharat" />
              {sealed.kind === 'POINT' ? 'Point' : 'Boundary'} for {sealed.parcelNumber}, with {sealed.photos.length} photo(s).
            </p>
            <p className="text-xs text-ink-muted">SHA-256 seal</p>
            <code className="block break-all rounded bg-surface p-2 text-xs">{sealed.bundleHash}</code>
            <p className="text-xs text-ink-muted">{online ? 'Uploading now; see Sync for the server’s check.' : 'You are offline. It will upload by itself when the connection returns.'}</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/* ----------------------------------------------------------- sync queue */

const LOCAL_TONE: Record<string, 'good' | 'warn' | 'bad' | 'info' | 'muted'> = { QUEUED: 'muted', SYNCING: 'info', SYNCED: 'good', CONFLICT: 'warn', REFUSED: 'bad', ERROR: 'warn' };
const LOCAL_LABEL: Record<string, string> = { QUEUED: 'Waiting to upload', SYNCING: 'Uploading…', SYNCED: 'Accepted by server', CONFLICT: 'Conflict: supervisor to decide', REFUSED: 'Refused by server', ERROR: 'Will retry' };

export function FieldSyncView() {
  const online = useOnline();
  const toast = useToast();
  const [items, setItems] = useState<QueuedBundle[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setItems(await listBundles());
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => {
    void load();
    window.addEventListener(QUEUE_EVENT, load);
    return () => window.removeEventListener(QUEUE_EVENT, load);
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const b of items ?? []) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [items]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Field app"
        title="Sync"
        subtitle="Everything captured on this device, and what the server said about it. Nothing leaves this list until you clear synced items."
        actions={
          <div className="flex gap-2">
            <button
              className="btn-primary"
              disabled={!online || busy}
              onClick={async () => {
                setBusy(true);
                const r = await syncNow().finally(() => setBusy(false));
                toast(r.refused ? 'error' : 'success', 'Sync finished', `${r.synced} accepted, ${r.conflicts} conflict(s), ${r.refused} refused${r.offline ? '; connection dropped' : ''}`);
              }}
            >
              {busy && <Spinner />} Sync now
            </button>
            <button className="btn-ghost" disabled={!counts.SYNCED} onClick={() => void clearSynced()}>
              Clear synced
            </button>
            <button
              className="btn-ghost text-danger"
              title="Forget everything this device holds (for a clean demo retake)"
              onClick={async () => {
                if (!window.confirm('Forget every capture and cached parcel on this device?')) return;
                await resetDevice();
                window.location.reload();
              }}
            >
              Reset this device
            </button>
          </div>
        }
      />
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(LOCAL_LABEL).map(([k, label]) => (
          <Badge key={k} tone={LOCAL_TONE[k]}>
            {label}: {counts[k] ?? 0}
          </Badge>
        ))}
      </div>
      {items === null ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState icon={<Satellite className="h-7 w-7" />} title="Nothing captured on this device yet" detail="Use Capture evidence; it works without a connection." />
      ) : (
        <div className="space-y-3">
          {items.map((b) => (
            <Card key={b.clientId}>
              <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                <div className="space-y-0.5">
                  <p className="font-bold">
                    {b.parcelNumber} · {b.kind === 'POINT' ? 'Point' : 'Walked boundary'} {b.positionSource === 'SIMULATED' && <SyntheticTag />}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Captured {dateTimeIST(b.capturedAt)} · ± {b.accuracyM} m · {b.samples} fixes · {b.photos.length} photo(s)
                  </p>
                  <p className="text-xs text-ink-muted">
                    Seal <code>{b.bundleHash.slice(0, 20)}…</code>
                  </p>
                </div>
                <Badge tone={LOCAL_TONE[b.status]}>{LOCAL_LABEL[b.status]}</Badge>
              </div>
              {b.server && (
                <p className="mt-2 text-xs">
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-bharat" />
                  Server re-checked the seal ✓
                  {b.server.distanceM !== null && (b.server.distanceM === 0 ? ' · inside the recorded boundary' : ` · ${b.server.distanceM} m outside the recorded boundary`)}
                  {b.server.overlapIoU !== null && ` · matches the recorded boundary ${Math.round(b.server.overlapIoU * 100)}% (IoU)`}
                  {b.server.conflictReason && <span className="block text-warning">{b.server.conflictReason}</span>}
                </p>
              )}
              {b.error && (
                <p className={cn('mt-2 text-xs', b.status === 'REFUSED' ? 'text-danger' : 'text-ink-muted')}>
                  {b.status === 'REFUSED' && <XCircle className="mr-1 inline h-3.5 w-3.5" />}
                  {b.error}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- supervisor view */

interface ServerEvidence {
  id: string;
  clientId: string;
  kind: 'POINT' | 'POLYGON';
  status: 'ACCEPTED' | 'CONFLICT' | 'SUPERSEDED' | 'REJECTED';
  capturedAt: string;
  receivedAt: string;
  accuracyM: number;
  samples: number;
  positionSource: string;
  note: string | null;
  bundleHash: string;
  hashVerified: boolean;
  distanceM: number | null;
  overlapIoU: number | null;
  capturedAreaSqm: number | null;
  conflictReason: string | null;
  conflictWithId: string | null;
  resolutionNote: string | null;
  photoHashes: string[];
  parcel: { parcelNumber: string; villageName: string };
}

function ResolveButton({ ev, decision, onDone }: { ev: ServerEvidence; decision: 'ACCEPT' | 'REJECT'; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button className={decision === 'ACCEPT' ? 'btn-primary' : 'btn-ghost'} onClick={() => setOpen(true)}>
        {decision === 'ACCEPT' ? 'Use this survey' : 'Reject this survey'}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={decision === 'ACCEPT' ? 'Use this survey (the earlier one is superseded)' : 'Reject this survey'}
        footer={
          <button
            className="btn-primary"
            disabled={busy || note.trim().length < 10}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await api.post(`/field/evidence/${ev.id}/resolve`, { decision, note });
                toast('success', 'Conflict resolved', 'Recorded in the audit trail.');
                setOpen(false);
                onDone();
              } catch (e) {
                setErr((e as ApiError).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Confirm
          </button>
        }
      >
        <label className="block text-sm">
          <span className="label">Reason (at least 10 characters)</span>
          <textarea className="input min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      </Dialog>
    </>
  );
}

export function FieldEvidenceReviewView({ eyebrow }: { eyebrow?: string }) {
  const user = useUser();
  const [status, setStatus] = useState<'CONFLICT' | 'ACCEPTED' | 'SUPERSEDED' | 'REJECTED'>('CONFLICT');
  const state = useApi<{ serverTime: string; items: ServerEvidence[] }>(`/field/evidence${qs({ status })}`);
  const all = useApi<{ serverTime: string; items: ServerEvidence[] }>('/field/evidence');
  const byId = new Map((all.data?.items ?? []).map((e) => [e.id, e]));
  const canResolve = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'STATE_OFFICER', 'DISTRICT_OFFICER'].includes(user.role);
  const describe = (e: ServerEvidence) => (
    <div className="space-y-0.5 text-sm">
      <p className="font-semibold">
        {e.kind === 'POINT' ? 'Point' : 'Walked boundary'} · ± {e.accuracyM} m · {e.samples} fixes {e.positionSource === 'SIMULATED' && <SyntheticTag />}
      </p>
      <p className="text-xs text-ink-muted">
        Captured {dateTimeIST(e.capturedAt)}, received {dateTimeIST(e.receivedAt)}
      </p>
      <p className="text-xs">
        {e.distanceM !== null && (e.distanceM === 0 ? 'Inside the recorded boundary' : `${e.distanceM} m outside the recorded boundary`)}
        {e.overlapIoU !== null && `Matches the recorded boundary ${Math.round(e.overlapIoU * 100)}% (IoU), ${((e.capturedAreaSqm ?? 0) / 10_000).toFixed(3)} ha walked`}
      </p>
      {e.note && <p className="text-xs">“{e.note}”</p>}
      <p className="text-[11px] text-ink-muted">
        Seal {e.hashVerified ? 're-verified' : 'NOT verified'} · <code>{e.bundleHash.slice(0, 16)}…</code> · {e.photoHashes.length} photo(s)
      </p>
    </div>
  );
  return (
    <div className="space-y-4">
      <PageHeader eyebrow={eyebrow} title="Field evidence" subtitle="GNSS points and walked boundaries from field devices, each re-verified against its on-device seal. When two surveys cross while a device was offline, you choose; nothing is overwritten." />
      <Tabs
        value={status}
        onChange={setStatus}
        tabs={[
          { key: 'CONFLICT', label: 'Conflicts' },
          { key: 'ACCEPTED', label: 'Accepted' },
          { key: 'SUPERSEDED', label: 'Superseded' },
          { key: 'REJECTED', label: 'Rejected' },
        ]}
      />
      <DataState state={{ ...state, data: state.data?.items }} empty={<EmptyState icon={<Satellite className="h-7 w-7" />} title={status === 'CONFLICT' ? 'No conflicts' : 'Nothing here'} />}>
        {(items) => (
          <div className="space-y-3">
            {items.map((e) => {
              const other = e.conflictWithId ? byId.get(e.conflictWithId) : undefined;
              return (
                <Card key={e.id} title={`${e.parcel.parcelNumber} · ${e.parcel.villageName}`}>
                  {e.status === 'CONFLICT' ? (
                    <div className="space-y-3">
                      <p className="text-sm text-warning">{e.conflictReason}</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-md border border-line p-3">
                          <p className="mb-1 text-[11px] font-bold uppercase text-ink-muted">Already accepted</p>
                          {other ? describe(other) : <p className="text-xs text-ink-muted">Loading…</p>}
                        </div>
                        <div className="rounded-md border border-warning/40 p-3">
                          <p className="mb-1 text-[11px] font-bold uppercase text-warning">Arrived later (captured offline)</p>
                          {describe(e)}
                        </div>
                      </div>
                      {canResolve && (
                        <div className="flex gap-2">
                          <ResolveButton ev={e} decision="ACCEPT" onDone={() => { state.reload(); all.reload(); }} />
                          <ResolveButton ev={e} decision="REJECT" onDone={() => { state.reload(); all.reload(); }} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {describe(e)}
                      {e.resolutionNote && <p className="mt-2 text-xs">Decision: “{e.resolutionNote}”</p>}
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </DataState>
    </div>
  );
}
