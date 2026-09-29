'use client';

import { AlertTriangle, Clock3, HeartHandshake, Maximize2, Minimize2, ShieldAlert, Timer } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { STAGE_COLORS } from '@/components/map/map-types';
import { DataState, Spinner } from '@/components/ui';
import { useApi } from '@/lib/api/hooks';
import { dateIST, humanize, inr, inrShort, num } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LiabilitySummary } from './LiabilityView';

type P = number | string;
interface CommandSummary {
  asOf: string;
  projectsByStage: Array<{ id: string; code: string; name: string; stateName: string; sector: string; isSynthetic: boolean; total: number; stages: Record<string, number> }>;
  stuck: Array<{
    id: string;
    code: string;
    name: string;
    stateName: string;
    bottlenecks: number;
    topPriority: number;
    exposurePaise: P;
    perDayPaise: P;
    families: number;
    byType: Record<string, number>;
    top: { key: string; type: string; title: string; headline: string; action: string; owner: { role: string; names: string[] }; deadline: string | null };
  }>;
  gis: { blockedParcels: number; blockedAreaHa: number; families: number; byDistrict: Array<{ district: string; parcels: number }>; examples: Array<{ parcelNumber: string; villageName: string; districtName: string; overlaps: Array<{ layer: string; kind: string; overlapPct: number; missing: string[] }> }> };
  sla: { open: number; breached: number; byState: Array<{ stateCode: string; stateName: string; open: number; breached: number; worstOverdueDays: number }> };
  rr: { familiesAwaiting: number; entitlementsPending: number; pendingPaise: P; byState: Array<{ stateName: string; families: number; entitlements: number; pendingPaise: P }> };
}

const STAGE_ORDER = ['PRELIM_NOTIFIED', 'DECLARED', 'AWARDED', 'COMPENSATION_PAID', 'POSSESSION_TAKEN', 'HANDED_OVER', 'IDENTIFIED', 'LAPSED', 'WITHDRAWN'];

function Panel({ title, icon, children, className, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-white/10 bg-white/[0.04] p-4', className)}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/70">
          {icon}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function Big({ label, value, sub, tone = 'white' }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'white' | 'saffron' | 'danger' | 'green' }) {
  const color = { white: 'text-white', saffron: 'text-saffron', danger: 'text-[#ff8a8a]', green: 'text-[#6ee7a3]' }[tone];
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">{label}</p>
      <p className={cn('tabular mt-1 text-4xl font-extrabold leading-none xl:text-5xl', color)}>{value}</p>
      {sub && <p className="mt-2 text-sm text-white/70">{sub}</p>}
    </div>
  );
}

/** The cost of delay, ticking every second between refreshes. */
function LiveCost({ s }: { s: LiabilitySummary }) {
  const base = Number(s.totals.totalAccruedPaise);
  const perMs = s.totals.perSecondPaise / 1000;
  const start = useMemo(() => Date.now(), [s]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="rounded-xl border border-saffron/40 bg-gradient-to-br from-saffron/20 to-transparent p-4" data-tour="interest-counter">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-saffron">Statutory cost of delay · live</p>
      <p className="tabular mt-1 text-4xl font-extrabold leading-none xl:text-6xl" aria-live="off">
        {inr(Math.round(base + (now - start) * perMs), { paise: false })}
      </p>
      <p className="mt-2 text-sm text-white/80">
        accrued so far · <strong className="text-white">{inr(Math.round(Number(s.totals.dailyPaise)), { paise: false })} a day</strong> · s.80 interest on {num(s.totals.s80Lines)} unpaid lines, s.30(3) on {num(s.totals.pendingAwards)} pending awards
      </p>
    </div>
  );
}

function IstClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <p className="tabular text-right">
      <span className="block text-2xl font-bold">{now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
      <span className="text-xs text-white/60">{now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} IST</span>
    </p>
  );
}

function ProjectsByStage({ rows }: { rows: CommandSummary['projectsByStage'] }) {
  // Shares of each project's parcels, so small projects read as clearly as the big one.
  const data = rows.map((p) => ({
    label: `${p.code} · ${p.total}`,
    full: `${p.name} (${p.stateName}), ${p.total} parcels`,
    counts: p.stages,
    ...Object.fromEntries(Object.entries(p.stages).map(([k, v]) => [k, p.total ? (v / p.total) * 100 : 0])),
  }));
  const used = STAGE_ORDER.filter((s) => rows.some((p) => p.stages[s] > 0));
  return (
    <div>
      <div className="h-[260px]" role="img" aria-label={`Parcels by stage for ${rows.length} projects`}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
            <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
            <YAxis type="category" dataKey="label" width={150} tick={{ fill: 'white', fontSize: 12, fontWeight: 600 }} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.06)' }}
              contentStyle={{ background: '#0b1f3a', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
              labelFormatter={(_l, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''}
              formatter={(v, k, item) => [`${(item.payload as { counts: Record<string, number> }).counts[String(k)]} parcels (${Math.round(Number(v))}%)`, humanize(String(k))]}
            />
            {used.map((s) => (
              <Bar key={s} dataKey={s} stackId="a" fill={STAGE_COLORS[s] ?? '#64748b'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/70">
        {used.map((s) => (
          <li key={s} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: STAGE_COLORS[s] }} /> {humanize(s)}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Mirrors BottleneckType in backend/src/stuck/scoring.ts.
const TYPE_LABEL: Record<string, string> = {
  GIS_BLOCK: 'Forest / consent',
  DECLARATION_AT_RISK: 'Declaration at risk',
  OBJECTIONS_PENDING: 'Objections',
  AWARD_AT_RISK: 'Award at risk',
  PAYMENT_OVERDUE: 'Payment overdue',
  INTEREST_RUNNING: 'Interest running',
  RR_BLOCKING_POSSESSION: 'R&R blocks possession',
  PAYMENT_HELD: 'Payment held',
  PAYMENT_FAILED: 'Payment failed',
  LITIGATION: 'Litigation',
};

export function CommandView() {
  const summary = useApi<CommandSummary>('/command/summary', { refreshMs: 60_000 });
  const liability = useApi<LiabilitySummary>('/liability/summary', { refreshMs: 60_000 });
  const ref = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen?.();
  };

  return (
    <div ref={ref} className={cn('-m-4 min-h-[calc(100vh-7rem)] bg-[#081527] p-4 text-white sm:-m-6 sm:p-6', full && 'm-0 min-h-screen overflow-auto sm:m-0')} data-tour="command">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-saffron">Department of Land Resources · National Command</p>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Land acquisition, right now</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/60">
            <span className="rounded bg-saffron/20 px-1.5 py-0.5 text-[11px] font-bold uppercase text-saffron">Synthetic demo data</span>
            Refreshes every minute{summary.loading && <Spinner className="h-3 w-3" />}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <IstClock />
          <button onClick={toggleFull} className="rounded-lg border border-white/20 p-2 hover:bg-white/10" aria-label={full ? 'Leave wall screen' : 'Wall screen (full screen)'} title={full ? 'Leave wall screen' : 'Wall screen'}>
            {full ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <DataState state={summary} rows={6}>
        {(s) => (
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
              {liability.data ? <LiveCost s={liability.data} /> : <div className="rounded-xl border border-white/10 p-4 text-white/60">Loading the cost of delay…</div>}
              <Big label="GIS-blocked parcels" value={num(s.gis.blockedParcels)} sub={`${s.gis.blockedAreaHa} ha · ${num(s.gis.families)} families · consent or clearance missing`} tone={s.gis.blockedParcels ? 'danger' : 'green'} />
              <Big label="SLA breaches" value={num(s.sla.breached)} sub={`of ${num(s.sla.open)} open administrative tasks`} tone={s.sla.breached ? 'danger' : 'green'} />
              <Big label="Families awaiting R&R" value={num(s.rr.familiesAwaiting)} sub={`${num(s.rr.entitlementsPending)} entitlements · ${inrShort(s.rr.pendingPaise)} still due`} tone={s.rr.familiesAwaiting ? 'saffron' : 'green'} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1.25fr]">
              <Panel title="Where each project stands (share of parcels by stage)" icon={<Timer className="h-4 w-4" />}>
                <ProjectsByStage rows={s.projectsByStage} />
              </Panel>
              <Panel title="Top 10 stuck projects" icon={<AlertTriangle className="h-4 w-4" />} action={<Link href="/central/stuck" className="text-xs text-saffron underline">All briefs</Link>}>
                <ol className="space-y-2">
                  {s.stuck.map((p, i) => (
                    <li key={p.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                      <div className="flex items-start gap-3">
                        <span className="tabular grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/10 text-sm font-extrabold">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <Link href={`/project/${p.id}`} className="truncate font-bold hover:text-saffron">
                              {p.name}
                            </Link>
                            <span className="tabular shrink-0 text-xs text-white/60">
                              priority <strong className="text-white">{Math.round(p.topPriority)}</strong> · {inrShort(p.exposurePaise)} at risk
                            </span>
                          </div>
                          <p className="text-sm text-white/90">{p.top.headline}</p>
                          <p className="text-xs text-white/60">
                            <span className="text-saffron">Do:</span> {p.top.action}
                            {p.top.deadline ? ` · by ${dateIST(p.top.deadline)}` : ''} · {p.top.owner.names[0] ?? humanize(p.top.owner.role)}
                          </p>
                          <p className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(p.byType).map(([t, n]) => (
                              <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold">
                                {TYPE_LABEL[t] ?? humanize(t)} {n}
                              </span>
                            ))}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="GIS-blocked parcels" icon={<ShieldAlert className="h-4 w-4" />} action={<Link href="/central/consent" className="text-xs text-saffron underline">Consent gate</Link>}>
                {s.gis.examples.length === 0 ? (
                  <p className="text-white/60">No parcel is blocked by a constraint layer.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {s.gis.examples.map((e) => (
                      <li key={e.parcelNumber}>
                        <p className="font-semibold">
                          {e.parcelNumber} <span className="font-normal text-white/60">· {e.villageName}, {e.districtName}</span>
                        </p>
                        {e.overlaps.map((o) => (
                          <p key={o.layer} className="text-xs text-white/70">
                            {o.overlapPct}% in {o.layer}; missing {o.missing.map((m) => humanize(m).replace(/^[A-Z][a-z]/, (c) => c.toLowerCase())).join(', ')}
                          </p>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="SLA breaches by state" icon={<Clock3 className="h-4 w-4" />}>
                <table className="w-full text-sm">
                  <caption className="sr-only">SLA breaches by state</caption>
                  <thead className="text-left text-[11px] uppercase tracking-wider text-white/50">
                    <tr>
                      <th className="pb-1 font-semibold">State</th>
                      <th className="pb-1 text-right font-semibold">Open</th>
                      <th className="pb-1 text-right font-semibold">Breached</th>
                      <th className="pb-1 text-right font-semibold">Worst</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.sla.byState.map((r) => (
                      <tr key={r.stateCode} className="border-t border-white/10">
                        <td className="py-1.5">{r.stateName}</td>
                        <td className="tabular text-right">{r.open}</td>
                        <td className={cn('tabular text-right font-bold', r.breached ? 'text-[#ff8a8a]' : 'text-[#6ee7a3]')}>{r.breached}</td>
                        <td className="tabular text-right text-white/70">{r.worstOverdueDays ? `${r.worstOverdueDays} d late` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
              <Panel title="Families awaiting R&R" icon={<HeartHandshake className="h-4 w-4" />} action={<Link href="/central/rr" className="text-xs text-saffron underline">R&R</Link>}>
                <ul className="space-y-2">
                  {s.rr.byState.map((r) => {
                    const max = Math.max(...s.rr.byState.map((x) => x.families), 1);
                    return (
                      <li key={r.stateName} className="text-sm">
                        <div className="flex justify-between">
                          <span>{r.stateName}</span>
                          <span className="tabular">
                            <strong>{r.families}</strong> {r.families === 1 ? 'family' : 'families'} · {r.entitlements} {r.entitlements === 1 ? 'entitlement' : 'entitlements'}
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full bg-saffron" style={{ width: `${(r.families / max) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                  {s.rr.byState.length === 0 && <li className="text-white/60">No family is waiting.</li>}
                </ul>
                <p className="mt-3 text-xs text-white/50">Possession is lawful only after R&R is delivered (s.38(1)).</p>
              </Panel>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
