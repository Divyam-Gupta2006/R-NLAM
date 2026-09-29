'use client';

import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';
import { qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { Jurisdiction } from '@/lib/api/types';
import { humanize } from '@/lib/format';
import { STAGE_COLORS } from './map/map-types';
import { DataState, Select } from './ui';

interface GNode {
  id: string;
  layer: number;
  kind: 'project' | 'notice' | 'parcel' | 'holder' | 'case' | 'constraint';
  label: string;
  sub?: string;
  status?: string;
}
interface Graph {
  project: { id: string; code: string; name: string };
  nodes: GNode[];
  edges: Array<{ from: string; to: string; kind: string }>;
  truncated: boolean;
}

const LAYERS = ['Project', 'Notices', 'Parcels', 'Holders', 'Cases & constraints'];
const COL_W = 210;
const BOX_W = 176;
const BOX_H = 34;
const GAP = 10;

function fill(n: GNode): string {
  if (n.kind === 'parcel') return STAGE_COLORS[n.status ?? ''] ?? '#64748b';
  return { project: '#0b1f3a', notice: '#0369a1', holder: '#334155', case: '#b45309', constraint: '#be123c' }[n.kind as string] ?? '#475569';
}

/**
 * Layered graph (not force-directed, so it reads left to right like the
 * process): project → notices → parcels → holders → cases/constraints.
 */
export function ParcelGraph({ projectId }: { projectId: string }) {
  const router = useRouter();
  const villages = useApi<Jurisdiction[]>('/jurisdictions?level=VILLAGE');
  const [villageId, setVillageId] = useState('');
  const state = useApi<Graph>(`/thread/projects/${projectId}/graph${qs({ villageId })}`);
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Select label="Village" value={villageId} onChange={setVillageId} options={[{ value: '', label: 'All villages (first 60 parcels)' }, ...(villages.data ?? []).map((v) => ({ value: v.id, label: v.name }))]} />
        <span className="text-ink-muted">Hover a node to trace its links; click a parcel to open it.</span>
      </div>
      <DataState state={state} isEmpty={(g) => g.nodes.length <= 1}>
        {(g) => <GraphCanvas g={g} hover={hover} setHover={setHover} onOpen={(id) => router.push(`/parcel/${id}`)} />}
      </DataState>
    </div>
  );
}

function GraphCanvas({ g, hover, setHover, onOpen }: { g: Graph; hover: string | null; setHover: (id: string | null) => void; onOpen: (id: string) => void }) {
  const layout = useMemo(() => {
    const cols: GNode[][] = [[], [], [], [], []];
    for (const n of g.nodes) cols[n.layer]?.push(n);
    const maxRows = Math.max(...cols.map((c) => c.length), 1);
    const height = maxRows * (BOX_H + GAP) + 40;
    const pos = new Map<string, { x: number; y: number }>();
    cols.forEach((col, i) => {
      const offset = (height - 40 - col.length * (BOX_H + GAP)) / 2;
      col.forEach((n, j) => pos.set(n.id, { x: i * COL_W + 10, y: 30 + offset + j * (BOX_H + GAP) }));
    });
    return { cols, pos, height, width: COL_W * 5 };
  }, [g]);

  const linked = useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]);
    for (const e of g.edges) {
      if (e.from === hover) s.add(e.to);
      if (e.to === hover) s.add(e.from);
    }
    return s;
  }, [hover, g.edges]);

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-panel">
      <svg width={layout.width} height={layout.height} role="img" aria-label={`Graph of ${g.project.code}: ${g.nodes.length} nodes, ${g.edges.length} links`}>
        {LAYERS.map((l, i) => (
          <text key={l} x={i * COL_W + 10} y={18} className="fill-ink-muted" fontSize={11} fontWeight={700}>
            {l.toUpperCase()}
          </text>
        ))}
        {g.edges.map((e, i) => {
          const a = layout.pos.get(e.from);
          const b = layout.pos.get(e.to);
          if (!a || !b) return null;
          const on = !linked || (linked.has(e.from) && linked.has(e.to));
          const x1 = a.x + BOX_W;
          const y1 = a.y + BOX_H / 2;
          const x2 = b.x;
          const y2 = b.y + BOX_H / 2;
          return <path key={i} d={`M${x1},${y1} C${x1 + 20},${y1} ${x2 - 20},${y2} ${x2},${y2}`} fill="none" stroke={e.kind === 'overlaps' ? '#be123c' : '#94a3b8'} strokeWidth={on ? 1.4 : 0.6} opacity={on ? 0.9 : 0.15} />;
        })}
        {g.nodes.map((n) => {
          const p = layout.pos.get(n.id)!;
          const dim = linked && !linked.has(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              opacity={dim ? 0.25 : 1}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => n.kind === 'parcel' && onOpen(n.id)}
              style={{ cursor: n.kind === 'parcel' ? 'pointer' : 'default' }}
              tabIndex={n.kind === 'parcel' ? 0 : -1}
              onKeyDown={(ev) => ev.key === 'Enter' && n.kind === 'parcel' && onOpen(n.id)}
            >
              <title>{`${n.label}${n.sub ? ` · ${n.sub}` : ''}${n.status ? ` · ${humanize(n.status)}` : ''}`}</title>
              <rect width={BOX_W} height={BOX_H} rx={7} fill={fill(n)} />
              <text x={8} y={14} fontSize={11} fontWeight={700} fill="#fff">
                {n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label}
              </text>
              <text x={8} y={27} fontSize={9.5} fill="#e2e8f0">
                {(n.status ? humanize(n.status) : n.sub ?? '').slice(0, 32)}
              </text>
            </g>
          );
        })}
      </svg>
      {g.truncated && <p className="p-2 text-xs text-ink-muted">Showing the first 60 parcels; pick a village to see all of it.</p>}
    </div>
  );
}
