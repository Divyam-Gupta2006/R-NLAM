'use client';

import { CalendarClock, CheckCircle2, ClipboardCheck, Radar, ScanSearch } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Badge, Card, PageHeader, Spinner, SyntheticTag } from '@/components/ui';
import { useUser } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { api, ApiError, qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { Paged, Parcel, ParcelDetail } from '@/lib/api/types';
import { dateIST, ha } from '@/lib/format';
import { cn } from '@/lib/utils';

/*
 * Change detection (6.12), visual demonstration. The imagery is SYNTHETIC:
 * drawn procedurally (fields, roads, trees) around each parcel's real
 * boundary, with the "after" scene adding the change. The field-check task it
 * raises is real (audited, 7-day SLA for the field officer).
 */

type Scenario = 'structure' | 'fence' | 'clearing';
interface Detection {
  parcelNumber: string;
  scenario: Scenario;
  title: string;
  finding: string;
  areaSqm: number;
  confidence: number;
  before: string;
  after: string;
  seed: number;
}

const DETECTIONS: Detection[] = [
  { parcelNumber: 'WRD-BRG-001', scenario: 'structure', title: 'New structures', finding: 'Two new structures (about 210 m²) and a cleared yard since the s.11 notification', areaSqm: 210, confidence: 0.93, before: '2025-05-20', after: '2026-09-18', seed: 7 },
  { parcelNumber: 'WRD-ANJ-003', scenario: 'fence', title: 'Boundary moved', finding: 'Neighbouring fence moved about 12 m into the parcel along its north-west edge', areaSqm: 620, confidence: 0.86, before: '2025-05-20', after: '2026-09-18', seed: 19 },
  { parcelNumber: 'WRD-ANJ-005', scenario: 'clearing', title: 'Trees felled', finding: 'Orchard trees felled on about 0.12 ha since the s.11 notification', areaSqm: 1200, confidence: 0.9, before: '2025-05-20', after: '2026-09-18', seed: 31 },
];

type Pt = [number, number];
const W = 640;
const H = 400;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Project a lng/lat ring into the tile so the parcel sits in the middle third. */
function project(ring: Pt[]): Pt[] {
  const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const xy = ring.map(([x, y]) => [x * Math.cos(lat0), -y] as Pt);
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((W * 0.5) / (maxX - minX || 1), (H * 0.6) / (maxY - minY || 1));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return xy.map(([x, y]) => [W / 2 + (x - cx) * scale, H / 2 + (y - cy) * scale] as Pt);
}

const centroid = (pts: Pt[]): Pt => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const path = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ' Z';

/** Where the change is, inside the projected parcel. */
function changeRegion(d: Detection, poly: Pt[]): Pt[] {
  const c = centroid(poly);
  if (d.scenario === 'fence') {
    const [a, b] = [poly[0], poly[1]];
    return [a, b, lerp(b, c, 0.22), lerp(a, c, 0.22)];
  }
  const inner = poly.map((p) => lerp(p, c, d.scenario === 'structure' ? 0.62 : 0.5));
  const shift: Pt = d.scenario === 'structure' ? lerp(c, poly[2], 0.28) : lerp(c, poly[3], 0.25);
  const dx = shift[0] - c[0];
  const dy = shift[1] - c[1];
  return inner.map(([x, y]) => [x + dx, y + dy] as Pt);
}

function SatScene({ d, poly, variant }: { d: Detection; poly: Pt[]; variant: 'before' | 'after' }) {
  const id = `${d.seed}-${variant}`;
  const r = rng(d.seed);
  const palette = ['#7c8b46', '#a2995b', '#8b7b4d', '#617b36', '#b6a66b', '#6f8a3f', '#958a55'];
  const strips = Array.from({ length: 11 }, (_, i) => ({ x: -120 + i * 82 + r() * 20, w: 62 + r() * 40, fill: palette[Math.floor(r() * palette.length)] }));
  const trees = Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * H, rr: 2.5 + r() * 4.5 }));
  const houses = Array.from({ length: 16 }, () => ({ x: 22 + r() * 110, y: 300 + r() * 80, w: 7 + r() * 9, h: 6 + r() * 7 }));
  const region = changeRegion(d, poly);
  const c = centroid(region);
  const orchard: Pt[] = [];
  for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) orchard.push([c[0] + i * 9 + (j % 2) * 4, c[1] + j * 9]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <filter id={`mottle-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="4" seed={d.seed} />
          <feColorMatrix type="matrix" values="0 0 0 0 0.30  0 0 0 0 0.33  0 0 0 0 0.16  0 0 0 0.9 -0.35" />
        </filter>
        <filter id={`grain-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={d.seed + 3} />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.22" />
          </feComponentTransfer>
        </filter>
        <filter id={`shadow-${id}`}>
          <feDropShadow dx="2.5" dy="2.5" stdDeviation="1.2" floodColor="#1f2410" floodOpacity="0.7" />
        </filter>
      </defs>
      <rect width={W} height={H} fill="#6f7c3f" />
      <g transform={`rotate(-14 ${W / 2} ${H / 2})`}>
        {strips.map((s, i) => (
          <rect key={i} x={s.x} y={-80} width={s.w} height={H + 160} fill={s.fill} stroke="#4d5530" strokeWidth="1.2" opacity="0.9" />
        ))}
      </g>
      <rect width={W} height={H} filter={`url(#mottle-${id})`} />
      {/* stream and road */}
      <path d={`M-10 ${H * 0.12} C ${W * 0.3} ${H * 0.02}, ${W * 0.55} ${H * 0.3}, ${W + 10} ${H * 0.18}`} stroke="#4f6f73" strokeWidth="5" fill="none" opacity="0.8" />
      <path d={`M-10 ${H * 0.86} C ${W * 0.35} ${H * 0.76}, ${W * 0.7} ${H * 0.98}, ${W + 10} ${H * 0.82}`} stroke="#cdbd9c" strokeWidth="13" fill="none" />
      <path d={`M-10 ${H * 0.86} C ${W * 0.35} ${H * 0.76}, ${W * 0.7} ${H * 0.98}, ${W + 10} ${H * 0.82}`} stroke="#b3a482" strokeWidth="1.2" strokeDasharray="10 8" fill="none" />
      {houses.map((h, i) => (
        <rect key={i} x={h.x} y={h.y} width={h.w} height={h.h} fill={i % 3 ? '#c9c2b4' : '#a9543e'} filter={`url(#shadow-${id})`} />
      ))}
      {trees.map((t, i) => (
        <circle key={i} cx={t.x} cy={t.y} r={t.rr} fill="#2f4a24" opacity="0.9" />
      ))}
      {/* orchard in the clearing scenario (before only) */}
      {d.scenario === 'clearing' && variant === 'before' && orchard.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4.2" fill="#2c4c20" />)}

      {variant === 'after' && d.scenario === 'structure' && (
        <g>
          <path d={path(region)} fill="#b99d78" opacity="0.95" />
          <rect x={c[0] - 22} y={c[1] - 14} width="26" height="18" fill="#dcd8cf" filter={`url(#shadow-${id})`} />
          <rect x={c[0] + 8} y={c[1] - 4} width="18" height="14" fill="#8fa3b5" filter={`url(#shadow-${id})`} />
          <path d={`M${c[0] - 30} ${c[1] + 22} L ${c[0] + 34} ${c[1] + 12}`} stroke="#cbb892" strokeWidth="3" />
        </g>
      )}
      {variant === 'after' && d.scenario === 'fence' && (
        <g>
          <path d={path(region)} fill="#b5a47c" opacity="0.9" />
          <path d={`M${region[3][0]} ${region[3][1]} L ${region[2][0]} ${region[2][1]}`} stroke="#f2efe6" strokeWidth="2" strokeDasharray="4 3" />
        </g>
      )}
      {variant === 'after' && d.scenario === 'clearing' && (
        <g>
          <path d={path(region)} fill="#a88e67" opacity="0.9" />
          {orchard.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="1.3" fill="#5a4630" />
          ))}
        </g>
      )}

      <rect width={W} height={H} filter={`url(#grain-${id})`} />
      {/* recorded parcel boundary */}
      <path d={path(poly)} fill="none" stroke="#fff" strokeWidth="2.2" strokeDasharray="7 5" />
      {variant === 'after' && (
        <g className="animate-pulse">
          <path d={path(region)} fill="rgba(239,68,68,0.22)" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="6 4" />
        </g>
      )}
    </svg>
  );
}

function CompareSlider({ d, ring }: { d: Detection; ring: Pt[] }) {
  const poly = useMemo(() => project(ring.slice(0, -1)), [ring]);
  const [pos, setPos] = useState(32);
  const region = changeRegion(d, poly);
  const c = centroid(region);
  return (
    <div className="relative aspect-[16/10] w-full select-none overflow-hidden rounded-xl bg-black shadow-inner">
      <div className="absolute inset-0">
        <SatScene d={d} poly={poly} variant="before" />
      </div>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <SatScene d={d} poly={poly} variant="after" />
        <span
          className="absolute -translate-y-1/2 whitespace-nowrap rounded-md bg-danger px-2 py-0.5 text-[11px] font-bold text-white shadow"
          style={{ left: `${(Math.max(...region.map((p) => p[0])) / W) * 100 + 4}%`, top: `${(c[1] / H) * 100 + 2}%` }}
        >
          {d.title} · {d.areaSqm >= 1000 ? `${(d.areaSqm / 10_000).toFixed(2)} ha` : `${d.areaSqm} m²`}
        </span>
      </div>
      <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs font-bold text-white">BEFORE · {dateIST(d.before)}</span>
      <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-1 text-xs font-bold text-white">AFTER · {dateIST(d.after)}</span>
      <span className="absolute bottom-3 left-3 rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90">Synthetic imagery · dashed white line: recorded boundary</span>
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white shadow" />
        <div className="absolute top-1/2 -ml-5 -mt-5 grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-navy text-white shadow-lg">
          <ScanSearch className="h-5 w-5" />
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Drag to compare before and after"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

interface CheckTask {
  id: string;
  taskName: string;
  startDate: string;
  targetDate: string;
  completedDate: string | null;
}

export function ChangeDetectionView({ eyebrow }: { eyebrow?: string }) {
  const user = useUser();
  const toast = useToast();
  const [sel, setSel] = useState(0);
  const d = DETECTIONS[sel];
  const list = useApi<Paged<Parcel>>(`/parcels${qs({ q: d.parcelNumber, pageSize: 1 })}`);
  const parcel = list.data?.items[0];
  const detail = useApi<ParcelDetail>(parcel ? `/parcels/${parcel.id}` : null);
  const checks = useApi<CheckTask[]>('/field/checks');
  const [busy, setBusy] = useState(false);
  const canRaise = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'STATE_OFFICER', 'DISTRICT_OFFICER', 'GIS_OFFICER'].includes(user.role);

  const ring: Pt[] | null = useMemo(() => {
    const g = parcel?.geometry;
    if (!g) return null;
    if (g.type === 'Polygon') return (g.coordinates[0] as number[][]).map((p) => [p[0], p[1]] as Pt);
    if (g.type === 'MultiPolygon') return (g.coordinates[0][0] as number[][]).map((p) => [p[0], p[1]] as Pt);
    return null;
  }, [parcel]);
  const s11 = detail.data?.notices.find((n) => n.kind === 'SEC_11_PRELIMINARY');
  const existing = checks.data?.find((c) => c.taskName.startsWith(`Field check: ${d.parcelNumber}:`));

  const raise = async () => {
    if (!parcel) return;
    setBusy(true);
    try {
      const t = await api.post<CheckTask>('/field/checks', { parcelId: parcel.id, finding: d.finding });
      toast('success', 'Field-check task created', `Assigned to the field survey team, due ${dateIST(t.targetDate)}. Recorded in the audit trail.`);
      checks.reload();
    } catch (e) {
      toast('error', 'Could not create the task', (e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={eyebrow}
        title="Change detection"
        subtitle="Satellite and drone passes compared against notified parcels. A change after the preliminary notification raises a field check before the award is made."
        actions={<SyntheticTag />}
      />
      <div className="grid gap-3 md:grid-cols-3">
        {DETECTIONS.map((x, i) => (
          <button
            key={x.parcelNumber}
            onClick={() => setSel(i)}
            className={cn('rounded-xl border bg-panel p-3 text-left shadow-sm transition', i === sel ? 'border-saffron ring-2 ring-saffron/30' : 'border-line hover:border-saffron/60')}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-bold text-ink">{x.parcelNumber}</span>
              <Badge tone="bad">{x.title}</Badge>
            </span>
            <span className="mt-1 block text-xs text-ink-muted">{x.finding}</span>
            <span className="mt-1 block text-[11px] font-semibold text-info">Confidence {Math.round(x.confidence * 100)}% · pass of {dateIST(x.after)}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card title={`${d.parcelNumber} · drag to compare`} subtitle="Left: before the notification. Right: latest pass. Red: detected change.">
          {ring ? <CompareSlider key={d.parcelNumber} d={d} ring={ring} /> : <div className="grid aspect-[16/10] place-items-center rounded-xl bg-surface"><Spinner /></div>}
        </Card>
        <Card title="What changed" subtitle="Proposed by the detector; a field check confirms it">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Parcel</dt>
              <dd className="font-semibold">
                {d.parcelNumber} · survey {parcel?.surveyNumber ?? '…'}, {parcel?.villageName ?? '…'} ({parcel ? ha(parcel.totalAreaHa, 3) : '…'})
              </dd>
              <dd className="text-xs text-ink-muted">{parcel?.displayOwnerName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Finding</dt>
              <dd>{d.finding}</dd>
              <dd className="text-xs text-ink-muted">
                Changed area {d.areaSqm >= 1000 ? `${(d.areaSqm / 10_000).toFixed(2)} ha` : `${d.areaSqm} m²`}
                {parcel ? ` (${((d.areaSqm / (parcel.totalAreaHa * 10_000)) * 100).toFixed(1)}% of the parcel)` : ''} · confidence {Math.round(d.confidence * 100)}%
              </dd>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-warning-soft/60 p-2.5">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-xs">
                Preliminary notification published <strong>{s11 ? dateIST(s11.publishedOn) : '…'}</strong>; the change appears in the pass of {dateIST(d.after)}. After notification, s.11(4) bars any transaction or new encumbrance on the land, so the Collector needs a field record before the award.
                <span className="mt-1 block font-semibold text-info">RFCTLARR 2013, s.11(4)</span>
              </p>
            </div>
          </dl>
          <div className="mt-4">
            {existing ? (
              <div className="flex items-start gap-2 rounded-lg border border-bharat/30 bg-bharat-soft/60 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-bharat" />
                <p>
                  <strong>Field check raised</strong> on {dateIST(existing.startDate)}, due <strong>{dateIST(existing.targetDate)}</strong>. Assigned to the field survey team; visible in the SLA tracker.
                </p>
              </div>
            ) : (
              canRaise && (
                <button className="btn-primary w-full justify-center py-2.5" onClick={raise} disabled={busy || !parcel} data-tour="field-check">
                  {busy ? <Spinner /> : <ClipboardCheck className="h-4 w-4" />} Create field-check task
                </button>
              )
            )}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-muted">
            <Radar className="h-3.5 w-3.5" /> Imagery and detections on this screen are synthetic; the task it creates is real.
          </p>
        </Card>
      </div>
    </div>
  );
}
