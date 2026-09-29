'use client';

import { AlertOctagon, Bot, CheckCircle2, ChevronDown, ChevronUp, FileWarning, Gavel, HeartHandshake, IndianRupee, Languages, Lock, MessageSquareWarning, Scale, ThumbsDown, ThumbsUp, Timer, Users } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import { Badge, Card, DataState, Dialog, EmptyState, PageHeader, Select, Spinner } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { api, ApiError, qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import { dateIST, dateTimeIST, humanize, inr, inrShort, num } from '@/lib/format';
import { cn } from '@/lib/utils';

type P = number | string;
interface Component {
  value: number;
  why: string;
}
export interface Bottleneck {
  key: string;
  type: string;
  projectId: string;
  projectCode: string;
  title: string;
  parcels: Array<{ id: string; parcelNumber: string; villageName: string }>;
  families: number;
  exposurePaise: P;
  exposureLabel: string;
  perDayPaise: P;
  daysToDeadline: number | null;
  evidence: Array<{ label: string; detail: string; citation?: string; unverified?: boolean }>;
  brief: { headline: string; blocked: string; why: string[]; impact: string; action: string; owner: { role: string; label: string; names: string[] }; deadline: string | null; deadlineWhy: string };
  score: { risk: Component; money: Component; families: Component; raw: number; adjustment: { factor: number; why: string } | null; priority: number };
  decision: { decision: 'ACCEPTED' | 'DISPUTED'; comment: string; by: string; role: string; at: string } | null;
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  GIS_BLOCK: { label: 'GIS consent gate', icon: <Lock className="h-4 w-4" /> },
  DECLARATION_AT_RISK: { label: 's.19 lapse risk', icon: <Timer className="h-4 w-4" /> },
  OBJECTIONS_PENDING: { label: 'Objections', icon: <MessageSquareWarning className="h-4 w-4" /> },
  AWARD_AT_RISK: { label: 'Awards pending', icon: <Gavel className="h-4 w-4" /> },
  PAYMENT_OVERDUE: { label: 'Payment overdue', icon: <IndianRupee className="h-4 w-4" /> },
  INTEREST_RUNNING: { label: 's.80 interest', icon: <AlertOctagon className="h-4 w-4" /> },
  RR_BLOCKING_POSSESSION: { label: 'R&R blocks possession', icon: <HeartHandshake className="h-4 w-4" /> },
  PAYMENT_HELD: { label: 'Payment on hold', icon: <FileWarning className="h-4 w-4" /> },
  PAYMENT_FAILED: { label: 'Payment failed', icon: <FileWarning className="h-4 w-4" /> },
  LITIGATION: { label: 'Litigation', icon: <Scale className="h-4 w-4" /> },
};

function priorityTone(p: number) {
  return p >= 50 ? 'bg-danger text-white' : p >= 25 ? 'bg-saffron text-white' : p >= 10 ? 'bg-warning-soft text-warning' : 'bg-surface text-ink-muted';
}

function ComponentBar({ label, c }: { label: string; c: Component }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-semibold text-ink-muted">
        <span>{label}</span>
        <span className="tabular">{c.value.toFixed(2)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" role="meter" aria-valuenow={c.value} aria-valuemin={0} aria-valuemax={1} aria-label={label}>
        <div className="h-full rounded-full bg-navy" style={{ width: `${c.value * 100}%` }} />
      </div>
      <p className="mt-0.5 text-[11px] text-ink-muted">{c.why}</p>
    </div>
  );
}

function DecisionButtons({ b, onDone }: { b: Bottleneck; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState<'ACCEPTED' | 'DISPUTED' | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/stuck/bottlenecks/${encodeURIComponent(b.key)}/decision`, { decision: open, comment });
      toast('success', open === 'ACCEPTED' ? 'Brief accepted' : 'Brief disputed', 'Recorded in the audit trail.');
      setOpen(null);
      setComment('');
      onDone();
    } catch (e) {
      toast('error', 'Not recorded', (e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setOpen('ACCEPTED')}>
        <ThumbsUp className="h-3.5 w-3.5" /> Accept
      </button>
      <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setOpen('DISPUTED')}>
        <ThumbsDown className="h-3.5 w-3.5" /> Dispute
      </button>
      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        title={open === 'ACCEPTED' ? 'Accept this brief' : 'Dispute this brief'}
        footer={
          <button className="btn-primary" disabled={busy || comment.trim().length < 5} onClick={submit}>
            {busy && <Spinner />} {open === 'ACCEPTED' ? 'Accept' : 'Dispute'}
          </button>
        }
      >
        <p className="text-sm text-ink-muted">
          {open === 'DISPUTED' ? 'A disputed brief is ranked at half its score until someone re-examines it. Say what the brief gets wrong.' : 'Accepting records that you own the next step. The score is unchanged.'}
        </p>
        <label className="mt-3 block">
          <span className="label">Comment (recorded in the audit trail)</span>
          <textarea className="input min-h-[90px]" value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
      </Dialog>
    </>
  );
}

function RephraseButton({ b }: { b: Bottleneck }) {
  const [lang, setLang] = useState<'en' | 'hi' | 'mr'>('en');
  const [result, setResult] = useState<{ text: string; provider: string; model: string | null; aiGenerated: boolean; note?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select label="Language" value={lang} onChange={(v) => setLang(v as 'en' | 'hi' | 'mr')} options={[{ value: 'en', label: 'Plain English' }, { value: 'hi', label: 'हिंदी' }, { value: 'mr', label: 'मराठी' }]} />
      <button
        className="btn-ghost px-2.5 py-1 text-xs"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setResult(await api.post(`/stuck/bottlenecks/${encodeURIComponent(b.key)}/rephrase`, { language: lang }));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Spinner /> : <Languages className="h-3.5 w-3.5" />} Rephrase
      </button>
      {result && (
        <div className="w-full rounded-lg border border-line bg-surface p-3 text-sm">
          <p className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            {result.aiGenerated ? (
              <Badge tone="accent"><Bot className="h-3 w-3" /> AI-generated ({result.model}): facts checked, not a decision</Badge>
            ) : (
              <Badge tone="muted">Template (no AI)</Badge>
            )}
            {result.note && <span className="text-warning">{result.note}</span>}
          </p>
          <p className="whitespace-pre-line">{result.text}</p>
        </div>
      )}
    </div>
  );
}

export function BottleneckCard({ b, rank, onChanged, defaultOpen }: { b: Bottleneck; rank: number; onChanged: () => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const meta = TYPE_META[b.type] ?? { label: humanize(b.type), icon: null };
  return (
    <article className={cn('panel overflow-hidden', b.decision?.decision === 'DISPUTED' && 'opacity-80')} data-tour={rank === 1 ? 'top-brief' : undefined}>
      <button className="flex w-full items-start gap-3 p-4 text-left hover:bg-surface/60" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <div className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-extrabold tabular', priorityTone(b.score.priority))} title="Priority 0–100">
          {Math.round(b.score.priority)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-ink-muted">
            <span>#{rank}</span>
            <Badge tone="info">{meta.icon} {meta.label}</Badge>
            <span>{b.projectCode}</span>
            {b.decision && <Badge tone={b.decision.decision === 'ACCEPTED' ? 'good' : 'warn'}>{b.decision.decision === 'ACCEPTED' ? 'Accepted' : 'Disputed'} by {b.decision.by}</Badge>}
          </div>
          <h3 className="mt-0.5 font-bold text-ink">{b.brief.headline}</h3>
          <p className="text-sm text-ink-muted">{b.title}</p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5 text-danger" /> {inrShort(b.exposurePaise)} exposure</span>
            {Number(b.perDayPaise) > 0 && <span className="text-danger">{inr(b.perDayPaise)}/day</span>}
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {num(b.families)} families</span>
            {b.brief.deadline && <span>Act by {dateIST(b.brief.deadline)}</span>}
          </p>
        </div>
        {open ? <ChevronUp className="h-5 w-5 text-ink-muted" /> : <ChevronDown className="h-5 w-5 text-ink-muted" />}
      </button>
      {open && (
        <div className="grid gap-5 border-t border-line p-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">What is blocked</p>
              <p>{b.brief.blocked}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Why</p>
              <ul className="list-disc space-y-0.5 pl-5">{b.brief.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Impact</p>
              <p>{b.brief.impact}</p>
              <p className="text-xs text-ink-muted">{b.exposureLabel}</p>
            </div>
            <div className="rounded-lg border border-bharat/30 bg-bharat-soft/40 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-bharat">Recommended next step</p>
              <p className="font-semibold">{b.brief.action}</p>
              <p className="mt-1 text-xs text-ink-muted">
                Owner: <strong>{b.brief.owner.label}</strong>
                {b.brief.owner.names.length ? ` (${b.brief.owner.names.join('; ')})` : ''}
                {b.brief.deadline ? ` · by ${dateIST(b.brief.deadline)} (${b.brief.deadlineWhy})` : ''}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Evidence</p>
              <ul className="space-y-1.5">
                {b.evidence.map((e, i) => (
                  <li key={i} className="rounded border border-line p-2 text-xs">
                    <p className="font-semibold">{e.label}</p>
                    <p className="text-ink-muted">{e.detail}</p>
                    {e.citation && <p className="font-semibold text-info">{e.citation}{e.unverified && <span className="text-warning"> · citation unverified</span>}</p>}
                  </li>
                ))}
              </ul>
            </div>
            <p className="flex flex-wrap gap-1 text-xs">
              {b.parcels.slice(0, 20).map((p) => (
                <Link key={p.id} href={`/parcel/${p.id}`} className="rounded border border-line px-1.5 py-0.5 hover:border-saffron">
                  {p.parcelNumber}
                </Link>
              ))}
              {b.parcels.length > 20 && <span className="text-ink-muted">+{b.parcels.length - 20} more</span>}
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-line p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">How the priority is computed</p>
              <div className="space-y-2">
                <ComponentBar label="Statutory risk" c={b.score.risk} />
                <ComponentBar label="₹ exposure" c={b.score.money} />
                <ComponentBar label="Families affected" c={b.score.families} />
              </div>
              <p className="mt-2 text-xs">
                {b.score.risk.value.toFixed(2)} × {b.score.money.value.toFixed(2)} × {b.score.families.value.toFixed(2)} = <strong>{b.score.raw.toFixed(3)}</strong>
                {b.score.adjustment && <span className="text-warning"> × {b.score.adjustment.factor} ({b.score.adjustment.why})</span>} → <strong>{b.score.priority}</strong>/100
              </p>
            </div>
            {b.decision && (
              <div className="rounded-lg border border-line p-3 text-xs">
                <p className="font-semibold">
                  {b.decision.decision === 'ACCEPTED' ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-bharat" /> : <ThumbsDown className="mr-1 inline h-3.5 w-3.5 text-warning" />}
                  {humanize(b.decision.decision)} by {b.decision.by} ({humanize(b.decision.role)}), {dateTimeIST(b.decision.at)}
                </p>
                <p className="text-ink-muted">“{b.decision.comment}”</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <DecisionButtons b={b} onDone={onChanged} />
            </div>
            <RephraseButton b={b} />
          </div>
        </div>
      )}
    </article>
  );
}

export function BottleneckList({ projectId, limit }: { projectId?: string; limit?: number }) {
  const [type, setType] = useState('');
  const state = useApi<Bottleneck[]>(`/stuck/bottlenecks${qs({ projectId })}`);
  return (
    <DataState state={state} empty={<EmptyState title="Nothing is stuck" detail="No bottlenecks found in your jurisdiction." />}>
      {(all) => {
        const rows = (type ? all.filter((b) => b.type === type) : all).slice(0, limit ?? 1000);
        const types = [...new Set(all.map((b) => b.type))];
        return (
          <div className="space-y-3">
            {!limit && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Select label="Type" value={type} onChange={setType} options={[{ value: '', label: `All (${all.length})` }, ...types.map((t) => ({ value: t, label: `${TYPE_META[t]?.label ?? humanize(t)} (${all.filter((b) => b.type === t).length})` }))]} />
                <span className="text-ink-muted">Priority = statutory risk × ₹ exposure × families, each scaled 0–1. Open a brief to see why.</span>
              </div>
            )}
            {rows.map((b, i) => (
              <BottleneckCard key={b.key} b={b} rank={all.indexOf(b) + 1} onChanged={state.reload} defaultOpen={i === 0 && !limit} />
            ))}
          </div>
        );
      }}
    </DataState>
  );
}

export function WhyStuckView({ eyebrow }: { eyebrow?: string }) {
  const projects = useApi<Array<{ id: string; code: string; name: string; bottlenecks: number; topPriority: number; exposurePaise: P; perDayPaise: P; families: number; top: { title: string } | null }>>('/stuck/projects');
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={eyebrow}
        title="Why is this stuck?"
        subtitle="Every bottleneck across statutory deadlines, GIS consent gates, objections, payments, R&R and litigation, ranked by statutory risk × ₹ exposure × families, each with an action brief and its evidence."
      />
      <Card title="Projects by how stuck they are">
        <DataState state={projects} rows={3}>
          {(ps) => (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {ps.map((p) => (
                <Link key={p.id} href={`/project/${p.id}?tab=stuck`} className="rounded-lg border border-line p-3 hover:border-saffron">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{p.code}</p>
                    <span className={cn('rounded-md px-2 py-0.5 text-sm font-bold tabular', priorityTone(p.topPriority))}>{Math.round(p.topPriority)}</span>
                  </div>
                  <p className="truncate text-xs text-ink-muted">{p.name}</p>
                  <p className="mt-1 text-xs">
                    {p.bottlenecks} {p.bottlenecks === 1 ? 'bottleneck' : 'bottlenecks'} · {inrShort(p.exposurePaise)} · {num(p.families)} families
                  </p>
                  {p.top && <p className="mt-1 line-clamp-2 text-xs text-ink-muted">Top: {p.top.title}</p>}
                </Link>
              ))}
            </div>
          )}
        </DataState>
      </Card>
      <BottleneckList />
    </div>
  );
}
