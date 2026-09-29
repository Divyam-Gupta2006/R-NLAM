'use client';

import { ChevronRight, Gavel, IndianRupee, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, DataState, EmptyState, PageHeader, Stat, Tabs } from '@/components/ui';
import { qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import { dateIST, inr, inrShort, num } from '@/lib/format';

type P = number | string;
export interface LiabilitySummary {
  asOf: string;
  totals: {
    s80OutstandingPaise: P;
    s80DailyPaise: P;
    additionalAccruedPaise: P;
    additionalDailyPaise: P;
    totalAccruedPaise: P;
    dailyPaise: P;
    perSecondPaise: number;
    s80Lines: number;
    pendingAwards: number;
  };
  trend: Array<{ date: string; s80OutstandingPaise: P; additionalAccruedPaise: P; dailyPaise: P }>;
  basis: Array<{ key: string; label: string; citation: string }>;
}
interface RollupRow {
  level: string;
  code: string;
  name: string;
  parent: string;
  s80OutstandingPaise: P;
  s80DailyPaise: P;
  additionalAccruedPaise: P;
  additionalDailyPaise: P;
  totalAccruedPaise: P;
  dailyPaise: P;
}
interface TopResult {
  actOn: string;
  totalSavingPaise: P;
  payCompensation: Array<{ compensationId: string; parcelId: string; parcelNumber: string; village: string; district: string; beneficiary: string; principalPaise: P; possessionOn: string; accruedPaise: P; savingPaise: P; horizon: string }>;
  declareAward: Array<{ parcelId: string; parcelNumber: string; village: string; district: string; marketValuePaise: P; startOn: string; accruedPaise: P; savingPaise: P; horizon: string }>;
}

const toRupees = (p: P) => Number(p) / 100;

/**
 * Ticks the accrued total forward from the server's daily rate, so the number
 * moves in real time between refreshes (the server stays the source of truth).
 */
export function LiveCounter({ summary, compact }: { summary: LiabilitySummary; compact?: boolean }) {
  const base = Number(summary.totals.totalAccruedPaise);
  const perMs = summary.totals.perSecondPaise / 1000;
  const start = useMemo(() => Date.now(), [summary]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const live = base + (now - start) * perMs;
  return (
    <div className={compact ? '' : 'panel overflow-hidden'} data-tour="interest-counter">
      <div className={compact ? '' : 'bg-navy p-5 text-white'}>
        <p className={compact ? 'text-xs font-semibold text-ink-muted' : 'text-xs font-semibold uppercase tracking-wider text-saffron'}>Statutory cost of delay · live</p>
        <p className={compact ? 'tabular text-2xl font-extrabold text-danger' : 'tabular mt-1 text-4xl font-extrabold sm:text-6xl'} aria-live="off">
          {inr(Math.round(live))}
        </p>
        <p className={compact ? 'text-xs text-ink-muted' : 'mt-2 text-sm text-white/80'}>
          accrued so far · growing by <strong className={compact ? '' : 'text-white'}>{inr(Math.round(Number(summary.totals.dailyPaise)))} a day</strong>, about {inr(Math.round(summary.totals.perSecondPaise * 60))} every minute
        </p>
      </div>
    </div>
  );
}

export function LiabilityView({ eyebrow }: { eyebrow?: string }) {
  const summary = useApi<LiabilitySummary>('/liability/summary', { refreshMs: 60_000 });
  const top = useApi<TopResult>('/liability/top?limit=10');
  const [path, setPath] = useState<Array<{ level: 'state' | 'district' | 'village' | 'parcel'; parent?: string; label: string }>>([{ level: 'state', label: 'Nation' }]);
  const cur = path[path.length - 1];
  const rollup = useApi<RollupRow[]>(`/liability/rollup${qs({ level: cur.level, parent: cur.parent })}`);
  const [tab, setTab] = useState<'pay' | 'award'>('pay');
  const next: Record<string, 'district' | 'village' | 'parcel' | undefined> = { state: 'district', district: 'village', village: 'parcel', parcel: undefined };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={eyebrow}
        title="Interest & delay liability"
        subtitle="What delay is costing the exchequer right now, as the Act computes it: interest on compensation unpaid at possession, and the additional amount that grows while awards are pending."
      />
      <DataState state={summary} rows={4}>
        {(s) => (
          <>
            <LiveCounter summary={s} />
            <div className="grid gap-3 md:grid-cols-2">
              <Stat
                label="s.80 interest: unpaid at possession"
                value={inrShort(s.totals.s80OutstandingPaise)}
                hint={`${inr(s.totals.s80DailyPaise)} a day on ${num(s.totals.s80Lines)} unpaid line(s) · 9% p.a., 15% after one year`}
                tone="bad"
                icon={<IndianRupee className="h-4 w-4" />}
              />
              <Stat
                label="s.30(3) additional amount: awards pending"
                value={inrShort(s.totals.additionalAccruedPaise)}
                hint={`${inr(s.totals.additionalDailyPaise)} a day across ${num(s.totals.pendingAwards)} parcels · 12% p.a. on market value`}
                tone="warn"
                icon={<Gavel className="h-4 w-4" />}
              />
            </div>
            <Card title="Trend" subtitle="Liability at the start of each month; each chart has its own scale" actions={<TrendingUp className="h-4 w-4 text-ink-muted" />}>
              <div className="grid gap-4 lg:grid-cols-2">
                {([
                  { key: 's80', title: 's.80 interest owed (unpaid at possession)', stroke: '#be123c', fill: '#fecdd3', pick: (t: LiabilitySummary['trend'][number]) => t.s80OutstandingPaise },
                  { key: 'additional', title: 's.30(3) additional amount (awards pending)', stroke: '#b45309', fill: '#fde68a', pick: (t: LiabilitySummary['trend'][number]) => t.additionalAccruedPaise },
                ] as const).map((c) => {
                  const data = s.trend.map((t) => ({ date: t.date, v: toRupees(c.pick(t)) }));
                  const first = data[0]?.v ?? 0;
                  const last = data[data.length - 1]?.v ?? 0;
                  const change = first ? Math.round(((last - first) / first) * 100) : 0;
                  return (
                    <div key={c.key}>
                      <p className="text-sm font-semibold text-ink">{c.title}</p>
                      <p className="text-xs text-ink-muted">
                        {inrShort(Math.round(first * 100))} → <strong className="text-ink">{inrShort(Math.round(last * 100))}</strong> in 12 months{' '}
                        <span className={change >= 0 ? 'font-semibold text-danger' : 'font-semibold text-bharat'}>({change >= 0 ? '+' : ''}{change}%)</span>
                      </p>
                      <div className="mt-2 h-52" role="img" aria-label={`${c.title} over twelve months`}>
                        <ResponsiveContainer>
                          <AreaChart data={data} margin={{ left: 4, right: 8, top: 6 }}>
                            <defs>
                              <linearGradient id={`g-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={c.stroke} stopOpacity={0.35} />
                                <stop offset="100%" stopColor={c.stroke} stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="date" tickFormatter={(d: string) => new Date(d).toLocaleDateString('en-IN', { month: 'short' })} tick={{ fontSize: 11 }} />
                            <YAxis domain={[(min: number) => Math.floor(min * 0.85), (max: number) => Math.ceil(max * 1.05)]} tickFormatter={(v: number) => inrShort(v * 100)} tick={{ fontSize: 11 }} width={64} />
                            <Tooltip formatter={(v: number) => [inr(Math.round(v * 100)), c.title]} labelFormatter={(d: string) => dateIST(d)} />
                            <Area type="monotone" dataKey="v" stroke={c.stroke} strokeWidth={2.5} fill={`url(#g-${c.key})`} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })}
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-ink-muted">
                {s.basis.map((b) => (
                  <li key={b.key}>
                    {b.label}: <span className="font-semibold text-info">{b.citation}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </DataState>

      <Card
        title="Where it accrues"
        subtitle={
          <nav aria-label="Drill-down" className="flex flex-wrap items-center gap-1">
            {path.map((p, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
                <button className={i === path.length - 1 ? 'font-semibold text-ink' : 'text-info hover:underline'} onClick={() => setPath(path.slice(0, i + 1))}>
                  {p.label}
                </button>
              </React.Fragment>
            ))}
          </nav>
        }
      >
        <DataState state={rollup} empty={<EmptyState title="Nothing accruing here" />}>
          {(rows) => (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">Liability by {cur.level}</caption>
                <thead className="bg-surface text-left text-xs font-semibold text-ink-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2">{cur.level[0].toUpperCase() + cur.level.slice(1)}</th>
                    <th scope="col" className="px-3 py-2 text-right">Per day</th>
                    <th scope="col" className="px-3 py-2 text-right">s.80 interest</th>
                    <th scope="col" className="px-3 py-2 text-right">s.30(3) additional</th>
                    <th scope="col" className="px-3 py-2 text-right">Total accrued</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => {
                    const deeper = next[r.level];
                    return (
                      <tr key={r.code} className="hover:bg-saffron-soft/30">
                        <td className="px-3 py-2">
                          {deeper ? (
                            <button className="font-semibold text-info hover:underline" onClick={() => setPath([...path, { level: deeper, parent: r.code, label: r.name }])}>
                              {r.name} <ChevronRight className="inline h-3 w-3" />
                            </button>
                          ) : (
                            <Link className="font-semibold text-info hover:underline" href={`/parcel/${r.code}`}>
                              {r.name}
                            </Link>
                          )}
                        </td>
                        <td className="tabular px-3 py-2 text-right font-bold text-danger">{inr(r.dailyPaise)}</td>
                        <td className="tabular px-3 py-2 text-right">{inr(r.s80OutstandingPaise, { paise: false })}</td>
                        <td className="tabular px-3 py-2 text-right">{inr(r.additionalAccruedPaise, { paise: false })}</td>
                        <td className="tabular px-3 py-2 text-right font-semibold">{inr(r.totalAccruedPaise, { paise: false })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </Card>

      <Card title="Act this week: what it saves" subtitle="Top 10 actions ranked by money avoided if done within 7 days">
        <DataState state={top} rows={5}>
          {(t) => (
            <div className="space-y-4">
              <p className="text-sm">
                Acting on these {t.payCompensation.length + t.declareAward.length} items by {dateIST(t.actOn)} avoids <strong className="text-bharat">{inr(t.totalSavingPaise, { paise: false })}</strong> of statutory interest and additional amount.
              </p>
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { key: 'pay', label: `Pay compensation (${t.payCompensation.length})` },
                  { key: 'award', label: `Declare awards (${t.declareAward.length})` },
                ]}
              />
              {tab === 'pay' && (t.payCompensation.length === 0 ? <EmptyState title="No compensation unpaid after possession" /> : <SavingsChart rows={t.payCompensation.map((r) => ({ label: `${r.parcelNumber} · ${r.beneficiary.split(' ')[0]}`, saving: toRupees(r.savingPaise), accrued: toRupees(r.accruedPaise), href: `/parcel/${r.parcelId}`, note: `${inr(r.principalPaise, { paise: false })} unpaid since possession ${dateIST(r.possessionOn)} · saving over ${r.horizon}` }))} />)}
              {tab === 'award' && (t.declareAward.length === 0 ? <EmptyState title="No declared parcels awaiting award" /> : <SavingsChart rows={t.declareAward.map((r) => ({ label: `${r.parcelNumber} · ${r.village}`, saving: toRupees(r.savingPaise), accrued: toRupees(r.accruedPaise), href: `/parcel/${r.parcelId}`, note: `market value ${inr(r.marketValuePaise, { paise: false })} · accruing since ${dateIST(r.startOn)} · saving ${r.horizon}` }))} />)}
            </div>
          )}
        </DataState>
      </Card>
    </div>
  );
}

function SavingsChart({ rows }: { rows: Array<{ label: string; saving: number; accrued: number; href: string; note: string }> }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <div className="h-80" role="img" aria-label={rows.map((r) => `${r.label}: saves ${Math.round(r.saving)} rupees`).join('; ')}>
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" tickFormatter={(v: number) => inrShort(v * 100)} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number, n: string) => [inr(Math.round(v * 100), { paise: false }), n === 'saving' ? 'Saved by acting this week' : 'Accrued so far']} />
            <Bar dataKey="saving" fill="#138808" radius={[0, 4, 4, 0]} />
            <Bar dataKey="accrued" fill="#be123c" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ol className="space-y-1.5 text-xs">
        {rows.map((r, i) => (
          <li key={r.href + i} className="rounded border border-line p-2">
            <Link href={r.href} className="font-semibold text-info hover:underline">
              {i + 1}. {r.label}
            </Link>
            <span className="float-right tabular font-bold text-bharat">{inr(Math.round(r.saving * 100), { paise: false })}</span>
            <p className="text-ink-muted">{r.note}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
