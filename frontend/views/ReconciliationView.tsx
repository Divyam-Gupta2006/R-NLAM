'use client';

import { CheckCircle2, Fingerprint, Link2Off, RefreshCw, ShieldQuestion, XCircle } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import { TransitionButton } from '@/components/actions';
import { Badge, Card, DataState, Dialog, EmptyState, PageHeader, Spinner, StatusBadge, Tabs } from '@/components/ui';
import { useUser } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { api, ApiError, qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import { dateTimeIST, humanize, inr } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PersonView {
  id: string;
  name: string;
  nameScript: string;
  fatherName: string | null;
  villageCode: string | null;
  source: string;
  identityGroupId: string | null;
  holdings: Array<{ sharePct: number; parcel: { id: string; parcelNumber: string; villageName: string } }>;
  compensations: Array<{ id: string; amountPaise: number | string; status: string; parcelId: string }>;
}
interface Match {
  id: string;
  confidence: number;
  requiresHuman: boolean;
  status: 'PENDING' | 'AUTO_LINKED' | 'CONFIRMED' | 'REJECTED' | 'UNLINKED';
  reasons: Array<{ signal: string; weight: number; score: number; detail: string }>;
  comment: string | null;
  decidedAt: string | null;
  a: PersonView;
  b: PersonView;
}

const SCRIPT: Record<string, string> = { Deva: 'Devanagari', Gujr: 'Gujarati', Knda: 'Kannada', Latn: 'Latin' };
const DECIDERS = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'STATE_OFFICER', 'DISTRICT_OFFICER', 'FINANCE_OFFICER'];

function PersonCard({ p }: { p: PersonView }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={p.nameScript === 'Latn' ? 'muted' : 'accent'}>{SCRIPT[p.nameScript] ?? p.nameScript}</Badge>
        <Badge tone="info">{humanize(p.source)}</Badge>
        {p.identityGroupId && <Badge tone="good"><Fingerprint className="h-3 w-3" /> Linked</Badge>}
      </div>
      <p className="mt-1 text-lg font-bold text-ink" lang={p.nameScript === 'Deva' ? 'mr' : undefined}>{p.name}</p>
      <p className="text-sm text-ink-muted">
        {p.fatherName ? `Father: ${p.fatherName}` : 'No father’s name recorded'} · {p.villageCode ?? 'village unknown'}
      </p>
      <ul className="mt-2 space-y-0.5 text-xs">
        {p.holdings.map((h) => (
          <li key={h.parcel.id}>
            Holder of <Link className="text-info hover:underline" href={`/parcel/${h.parcel.id}`}>{h.parcel.parcelNumber}</Link> ({h.sharePct}%)
          </li>
        ))}
        {p.compensations.map((c) => (
          <li key={c.id} className="flex items-center gap-1.5">
            Compensation {inr(c.amountPaise, { paise: false })} <StatusBadge status={c.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DecideButton({ m, decision, onDone }: { m: Match; decision: 'CONFIRM' | 'REJECT' | 'UNLINK'; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const label = { CONFIRM: 'Same person', REJECT: 'Different people', UNLINK: 'Undo link' }[decision];
  const icon = { CONFIRM: <CheckCircle2 className="h-4 w-4" />, REJECT: <XCircle className="h-4 w-4" />, UNLINK: <Link2Off className="h-4 w-4" /> }[decision];
  return (
    <>
      <button className={decision === 'CONFIRM' ? 'btn-primary' : 'btn-ghost'} onClick={() => setOpen(true)}>
        {icon} {label}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <button
            className="btn-primary"
            disabled={busy || comment.trim().length < 10}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post(`/reconciliation/matches/${m.id}/decision`, { decision, comment });
                toast('success', 'Decision recorded', 'Written to the audit trail. Records are never merged.');
                setOpen(false);
                onDone();
              } catch (e) {
                toast('error', 'Not recorded', (e as ApiError).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Record
          </button>
        }
      >
        <p className="text-sm text-ink-muted">Say how you verified it (documents seen, person met). At least 10 characters.</p>
        <textarea className="input mt-2 min-h-[90px]" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Dialog>
    </>
  );
}

export function ReconciliationView({ eyebrow }: { eyebrow?: string }) {
  const user = useUser();
  const toast = useToast();
  const [status, setStatus] = useState<'open' | 'CONFIRMED' | 'REJECTED'>('open');
  const state = useApi<Match[]>(`/reconciliation/queue${qs({ status: status === 'open' ? undefined : status })}`);
  const [running, setRunning] = useState(false);
  const canDecide = DECIDERS.includes(user.role);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={eyebrow}
        title="Owner reconciliation"
        subtitle="The same land holder often appears differently across records: “रामकुमार वानखेडे” in the 7/12 extract, “Ramkumar B. Wankhede” in the award register. Candidates are scored with reasons; a person confirms. Records are never merged."
        actions={
          canDecide && (
            <button
              className="btn-ghost"
              disabled={running}
              onClick={async () => {
                setRunning(true);
                try {
                  const r = await api.post<{ candidates: number; autoLinked: number; withdrawn: number }>('/reconciliation/run');
                  toast('success', 'Matching rerun', `${r.candidates} candidates, ${r.autoLinked} auto-linked, ${r.withdrawn} withdrawn`);
                  state.reload();
                } finally {
                  setRunning(false);
                }
              }}
            >
              {running ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Rerun matching
            </button>
          )
        }
      />
      <Tabs
        value={status}
        onChange={setStatus}
        tabs={[
          { key: 'open', label: 'To verify' },
          { key: 'CONFIRMED', label: 'Confirmed' },
          { key: 'REJECTED', label: 'Rejected' },
        ]}
      />
      <DataState state={state} empty={<EmptyState icon={<ShieldQuestion className="h-7 w-7" />} title="Nothing to verify" detail="New candidates appear when records are imported or matching is rerun." />}>
        {(ms) => (
          <div className="space-y-4">
            {ms.map((m) => {
              const held = [...m.a.compensations, ...m.b.compensations].filter((c) => c.status === 'ON_HOLD');
              return (
                <Card
                  key={m.id}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      Confidence <span className={cn('rounded-md px-2 py-0.5 text-sm tabular', m.confidence >= 0.9 ? 'bg-bharat-soft text-bharat' : 'bg-warning-soft text-warning')}>{(m.confidence * 100).toFixed(1)}%</span>
                      {m.requiresHuman && <Badge tone="warn">Money involved: a person must confirm</Badge>}
                      <StatusBadge status={m.status} />
                    </span>
                  }
                >
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.1fr]">
                    <PersonCard p={m.a} />
                    <PersonCard p={m.b} />
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Why they may be the same</p>
                      <ul className="space-y-1.5">
                        {m.reasons.map((r) => (
                          <li key={r.signal} className="text-xs">
                            <div className="flex items-center justify-between font-semibold">
                              <span>{humanize(r.signal)} <span className="font-normal text-ink-muted">(weight {r.weight})</span></span>
                              <span className="tabular">{r.score.toFixed(2)}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-navy" style={{ width: `${r.score * 100}%` }} /></div>
                            <p className="text-ink-muted">{r.detail}</p>
                          </li>
                        ))}
                      </ul>
                      {m.comment && <p className="mt-2 text-xs">“{m.comment}” · {dateTimeIST(m.decidedAt)}</p>}
                      {canDecide && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(m.status === 'PENDING' || m.status === 'AUTO_LINKED') && (
                            <>
                              <DecideButton m={m} decision="CONFIRM" onDone={state.reload} />
                              <DecideButton m={m} decision="REJECT" onDone={state.reload} />
                            </>
                          )}
                          {(m.status === 'CONFIRMED' || m.status === 'AUTO_LINKED') && <DecideButton m={m} decision="UNLINK" onDone={state.reload} />}
                          {m.status === 'CONFIRMED' && held.map((c) => <TransitionButton key={c.id} entityType="Compensation" entityId={c.id} event="RELEASE" label={`Release held ${inr(c.amountPaise, { paise: false })}`} onDone={state.reload} tone="primary" />)}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </DataState>
    </div>
  );
}
