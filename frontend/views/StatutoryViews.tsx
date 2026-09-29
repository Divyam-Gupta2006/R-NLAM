'use client';

import { AlertOctagon, BookOpenCheck, CalendarClock, CheckCircle2, Hourglass, Quote } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import { Badge, Card, DataState, EmptyState, PageHeader, Select, Stat, Tabs } from '@/components/ui';
import { qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import { dateIST, humanize, num } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface CalendarGroup {
  key: string;
  kind: string;
  label: string;
  dueOn: string;
  startsOn: string;
  status: 'RUNNING' | 'MET' | 'MISSED';
  daysLeft: number;
  citation: string;
  consequence: string;
  packCode: string;
  unverified: boolean;
  project?: { id: string; code: string; name: string };
  districts: string[];
  villages: string[];
  parcelCount: number;
  parcels: Array<{ id: string; parcelNumber: string; villageName: string }>;
}

export interface ClockRow {
  id: string;
  kind: string;
  startsOn: string;
  dueOn: string;
  status: 'RUNNING' | 'MET' | 'MISSED';
  metOn: string | null;
  citation: string;
  consequence: string;
  packCode: string;
  unverified: boolean;
  excludedDays: number;
}

export function Countdown({ days, status }: { days: number; status: string }) {
  if (status === 'MET') return <Badge tone="good"><CheckCircle2 className="h-3 w-3" /> Met</Badge>;
  if (status === 'MISSED') return <Badge tone="bad"><AlertOctagon className="h-3 w-3" /> Missed {Math.abs(days)}d ago</Badge>;
  const tone = days <= 7 ? 'bad' : days <= 30 ? 'warn' : days <= 60 ? 'accent' : 'info';
  const tier = days <= 7 ? 'T-7' : days <= 30 ? 'T-30' : days <= 60 ? 'T-60' : null;
  return (
    <Badge tone={tone}>
      <Hourglass className="h-3 w-3" /> {days === 0 ? 'Due today' : `${days} days left`}
      {tier && <span className="ml-1 rounded bg-white/60 px-1">{tier}</span>}
    </Badge>
  );
}

const KIND_ICON: Record<string, string> = {
  OBJECTION_WINDOW: 's.15',
  DECLARATION_DEADLINE: 's.19',
  AWARD_DEADLINE: 's.25',
  PAYMENT_DEADLINE: 's.38',
  RR_MONETARY_DEADLINE: 's.38',
};

/** Deadlines grouped by notice, soonest first. Missed ones stay on top until acted on. */
export function StatutoryCalendarView({ eyebrow }: { eyebrow?: string }) {
  const [filter, setFilter] = useState<'open' | 'MISSED' | 'all'>('open');
  const state = useApi<CalendarGroup[]>(`/statutory/calendar${qs({ status: filter === 'MISSED' ? 'MISSED' : undefined, includeMet: filter === 'all' ? 'true' : undefined })}`);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={eyebrow}
        title="Statutory calendar"
        subtitle="Deadlines the Act sets, computed per parcel from its notices and awards using the rule pack in force on the start date. Alerts go out at T-60, T-30 and T-7."
        actions={<Link href="/central/rules" className="btn-ghost"><BookOpenCheck className="h-4 w-4" /> Rule packs</Link>}
      />
      <DataState state={state} isEmpty={() => false} rows={6}>
        {(groups) => {
          const missed = groups.filter((g) => g.status === 'MISSED');
          const within30 = groups.filter((g) => g.status === 'RUNNING' && g.daysLeft <= 30);
          const within60 = groups.filter((g) => g.status === 'RUNNING' && g.daysLeft <= 60);
          const byMonth = new Map<string, CalendarGroup[]>();
          for (const g of [...missed, ...groups.filter((x) => x.status !== 'MISSED')]) {
            const m = g.status === 'MISSED' ? 'Missed' : new Date(g.dueOn).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' });
            byMonth.set(m, [...(byMonth.get(m) ?? []), g]);
          }
          return (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Missed deadlines" value={num(missed.length)} tone={missed.length ? 'bad' : 'good'} hint={`${num(missed.reduce((s, g) => s + g.parcelCount, 0))} parcels`} />
                <Stat label="Due within 30 days" value={num(within30.length)} tone={within30.length ? 'warn' : 'default'} />
                <Stat label="Due within 60 days" value={num(within60.length)} tone="accent" />
                <Stat label="Deadlines tracked" value={num(groups.length)} />
              </div>
              <Tabs
                value={filter}
                onChange={setFilter}
                tabs={[
                  { key: 'open', label: 'Running & missed' },
                  { key: 'MISSED', label: 'Missed only' },
                  { key: 'all', label: 'All incl. met' },
                ]}
              />
              {groups.length === 0 && <EmptyState icon={<CalendarClock className="h-7 w-7" />} title="No deadlines in this view" />}
              {[...byMonth.entries()].map(([month, gs]) => (
                <section key={month}>
                  <h2 className={cn('mb-2 text-sm font-bold uppercase tracking-wide', month === 'Missed' ? 'text-danger' : 'text-ink-muted')}>{month}</h2>
                  <ul className="space-y-2">
                    {gs.map((g) => (
                      <li key={g.key} className={cn('panel flex flex-wrap items-start gap-4 p-4', g.status === 'MISSED' && 'border-danger/40')}>
                        <div className="w-16 shrink-0 text-center">
                          <p className="text-2xl font-extrabold text-ink">{new Date(g.dueOn).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit' })}</p>
                          <p className="text-xs font-semibold uppercase text-ink-muted">{new Date(g.dueOn).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short' })}</p>
                          <Badge tone="muted" className="mt-1">{KIND_ICON[g.kind]}</Badge>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-ink">{g.label}</p>
                            <Countdown days={g.daysLeft} status={g.status} />
                            {g.unverified && <Badge tone="warn">Unverified rule</Badge>}
                          </div>
                          <p className="mt-0.5 text-sm text-ink">
                            {g.parcelCount} parcel{g.parcelCount === 1 ? '' : 's'} in {g.villages.join(', ')} ({g.districts.join(', ')}){g.project ? ` · ${g.project.code}` : ''}
                          </p>
                          <p className="mt-1 text-xs text-ink-muted">{g.consequence}</p>
                          <p className="mt-1 text-[11px] font-semibold text-info">
                            {g.citation} · pack {g.packCode} · started {dateIST(g.startsOn)}
                          </p>
                          <details className="mt-1 text-xs">
                            <summary className="cursor-pointer text-ink-muted">Parcels</summary>
                            <p className="mt-1 flex flex-wrap gap-1">
                              {g.parcels.map((p) => (
                                <Link key={p.id} href={`/parcel/${p.id}`} className="rounded border border-line px-1.5 py-0.5 hover:border-saffron">
                                  {p.parcelNumber}
                                </Link>
                              ))}
                            </p>
                          </details>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          );
        }}
      </DataState>
    </div>
  );
}

/** Clocks on one parcel, for the parcel page and the citizen view. */
export function ParcelClocks({ parcelId, plain }: { parcelId: string; plain?: boolean }) {
  const state = useApi<ClockRow[]>(`/statutory/parcels/${parcelId}`);
  const PLAIN: Record<string, string> = {
    OBJECTION_WINDOW: 'Last day to object to the acquisition',
    DECLARATION_DEADLINE: 'Final declaration must be published by',
    AWARD_DEADLINE: 'Award must be declared by',
    PAYMENT_DEADLINE: 'Your compensation must be paid by',
    RR_MONETARY_DEADLINE: 'Resettlement money must be paid by',
  };
  return (
    <DataState state={state} empty={<p className="text-sm text-ink-muted">No statutory clocks yet.</p>} rows={3}>
      {(rows) => (
        <ul className="space-y-2">
          {rows.map((c) => {
            const days = Math.round((new Date(c.dueOn).getTime() - Date.now()) / 86_400_000);
            return (
              <li key={c.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{plain ? PLAIN[c.kind] : humanize(c.kind)}</p>
                  <Countdown days={days} status={c.status} />
                </div>
                <p className="text-sm">
                  {dateIST(c.dueOn)}
                  {c.metOn && <span className="text-ink-muted"> · done {dateIST(c.metOn)}</span>}
                </p>
                <p className="text-xs text-ink-muted">{c.consequence}</p>
                <p className="text-[11px] font-semibold text-info">{c.citation}{c.unverified ? ' · unverified' : ''}</p>
              </li>
            );
          })}
        </ul>
      )}
    </DataState>
  );
}

/* ----------------------------------------------------------- rule packs */

interface Pack {
  id: string;
  code: string;
  actCode: string;
  stateCode: string | null;
  version: number;
  title: string;
  source: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  _count?: { entries: number };
}
interface Entry {
  id?: string;
  key: string;
  category: string;
  label: string;
  value: unknown;
  unit: string | null;
  citation: string;
  quote: string | null;
  unverified: boolean;
  note: string | null;
  packCode?: string;
  stateOverride?: boolean;
}

function formatValue(e: Entry): string {
  const v = e.value;
  if (e.unit === 'basis points' || e.unit?.startsWith('basis points')) return `${(Number(v) / 100).toLocaleString('en-IN')}%${e.unit.includes('per annum') ? ' per annum' : ''}`;
  if (Array.isArray(v)) return v.join(', ');
  if (v && typeof v === 'object' && 'bands' in (v as object)) {
    const b = (v as { bands: Array<{ maxKm: number | null; factor: number }> }).bands;
    return b.map((x) => `${x.maxKm === null ? 'beyond' : `≤ ${x.maxKm} km`}: ×${x.factor.toFixed(2)}`).join(' · ');
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return `${String(v)}${e.unit && !['factor'].includes(e.unit) ? ` ${e.unit}` : e.unit === 'factor' ? '×' : ''}`;
}

function EntryCard({ e }: { e: Entry }) {
  return (
    <li className={cn('rounded-lg border p-3', e.unverified ? 'border-warning/40 bg-warning-soft/30' : 'border-line')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">{e.label}</p>
        <span className="tabular text-sm font-bold text-navy">{formatValue(e)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
        <code className="text-ink-muted">{e.key}</code>
        <span className="font-semibold text-info">{e.citation}</span>
        {e.unverified && <Badge tone="warn">Unverified: do not rely on</Badge>}
        {e.stateOverride && <Badge tone="accent">State override</Badge>}
        {e.packCode && <span className="text-ink-muted">from {e.packCode}</span>}
      </div>
      {e.quote && (
        <blockquote className="mt-2 flex gap-2 border-l-2 border-saffron pl-2 text-xs italic text-ink">
          <Quote className="h-3 w-3 shrink-0 text-saffron" aria-hidden /> {e.quote}
        </blockquote>
      )}
      {e.note && <p className="mt-1 text-xs text-ink-muted">{e.note}</p>}
    </li>
  );
}

export function RulePacksView() {
  const packs = useApi<Pack[]>('/rules/packs');
  const [selected, setSelected] = useState<string>('IN-RFCTLARR-2013-v1');
  const [stateCode, setStateCode] = useState('MH');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const pack = useApi<Pack & { entries: Entry[] }>(selected ? `/rules/packs/${selected}` : null);
  const resolved = useApi<{ centralPack: string | null; statePack: string | null; rules: Record<string, Entry> }>(`/rules/resolve${qs({ stateCode, date })}`);
  const [tab, setTab] = useState<'packs' | 'resolve'>('packs');

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Governance"
        title="Statutory rule packs"
        subtitle="Rules are data: versioned per act, state and effective period, each with its citation and the Act's own words. A case is judged by the pack in force on its event date."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'packs', label: 'Packs' },
          { key: 'resolve', label: 'What applies where and when' },
        ]}
      />
      {tab === 'packs' && (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <Card title="Packs">
            <DataState state={packs}>
              {(ps) => (
                <ul className="space-y-2">
                  {ps.map((p) => (
                    <li key={p.id}>
                      <button className={cn('w-full rounded-lg border p-3 text-left', selected === p.code ? 'border-saffron bg-saffron-soft/40' : 'border-line hover:bg-surface')} onClick={() => setSelected(p.code)}>
                        <p className="text-sm font-semibold">{p.stateCode ? `${p.stateCode} state pack` : 'Central pack'} · v{p.version}</p>
                        <p className="text-xs text-ink-muted">{p.title}</p>
                        <p className="mt-1 text-[11px] text-ink-muted">
                          From {dateIST(p.effectiveFrom)}
                          {p.effectiveTo ? ` to ${dateIST(p.effectiveTo)}` : ''} · {p._count?.entries} rules · {humanize(p.status)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </DataState>
          </Card>
          <Card title={pack.data?.title ?? 'Pack'} subtitle={pack.data ? `${pack.data.code} · source: ${pack.data.source}` : undefined}>
            <DataState state={pack}>
              {(p) => (
                <div className="space-y-4">
                  {['DEADLINE', 'MONEY', 'DOCUMENT', 'PROCEDURE', 'ALERT'].map((cat) => {
                    const es = p.entries.filter((e) => e.category === cat);
                    if (!es.length) return null;
                    return (
                      <div key={cat}>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">{humanize(cat)}</p>
                        <ul className="space-y-2">{es.map((e) => <EntryCard key={e.key} e={e} />)}</ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </DataState>
          </Card>
        </div>
      )}
      {tab === 'resolve' && (
        <Card
          title="Resolved rules"
          subtitle="State pack overlaid on the central pack, for a state on a date"
          actions={
            <div className="flex flex-wrap gap-2">
              <Select label="State" value={stateCode} onChange={setStateCode} options={['MH', 'GJ', 'KA', 'RJ', 'UP', 'MP'].map((s) => ({ value: s, label: s }))} />
              <input aria-label="Date" type="date" className="input py-1.5" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          }
        >
          <DataState state={resolved}>
            {(r) => (
              <>
                <p className="mb-3 text-sm">
                  Central: <strong>{r.centralPack ?? 'none in force'}</strong> · State: <strong>{r.statePack ?? 'none'}</strong>
                </p>
                {Object.keys(r.rules).length === 0 ? (
                  <EmptyState title="No rules in force on that date" detail="RFCTLARR 2013 commenced on 1 January 2014." />
                ) : (
                  <ul className="space-y-2">{Object.values(r.rules).map((e) => <EntryCard key={e.key} e={e} />)}</ul>
                )}
              </>
            )}
          </DataState>
        </Card>
      )}
    </div>
  );
}
