'use client';

import { CheckCircle2, Gavel, RefreshCw, Scale, XCircle } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import { Badge, Card, DataState, Dialog, EmptyState, PageHeader, Spinner, SyntheticTag, Tabs } from '@/components/ui';
import { useUser } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { api, ApiError, qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import { dateIST, dateTimeIST, humanize } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface CourtCase {
  id: string;
  cnr: string;
  courtName: string;
  caseType: string;
  caseNumber: string;
  category: 'TITLE_SUIT' | 'LAR_REFERENCE' | 'WRIT_PETITION' | 'OTHER';
  status: 'PENDING' | 'DISPOSED';
  stayOrder: boolean;
  filedOn: string;
  nextHearingOn: string | null;
  disposedOn: string | null;
  petitioners: string[];
  respondents: string[];
  subject: string;
  source: string;
  isSynthetic: boolean;
}
export interface CaseLink {
  id: string;
  score: number;
  status: 'CANDIDATE' | 'CONFIRMED' | 'REJECTED';
  reasons: Array<{ signal: string; detail: string; weight: number }>;
  reviewNote: string | null;
  reviewedAt: string | null;
  courtCase: CourtCase;
  parcel: { id: string; parcelNumber: string; surveyNumber: string; villageName: string; districtName: string; stage: string; project: { code: string }; holders: Array<{ nameAsRecorded: string }> };
}

const DECIDERS = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'STATE_OFFICER', 'DISTRICT_OFFICER'];

/** Whether a confirmed case holds up acquisition (mirrors the backend rule). */
export const blocksAcquisition = (c: CourtCase) => c.status === 'PENDING' && (c.category === 'TITLE_SUIT' || c.stayOrder);

export function CaseSummary({ c }: { c: CourtCase }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{c.caseNumber}</span>
        <Badge tone="muted">{humanize(c.category)}</Badge>
        {c.stayOrder && <Badge tone="bad">Stay / status quo</Badge>}
        <Badge tone={c.status === 'PENDING' ? 'warn' : 'good'}>{humanize(c.status)}</Badge>
        {c.isSynthetic && <SyntheticTag />}
      </div>
      <p className="text-ink-muted">{c.courtName}</p>
      <p>{c.subject}</p>
      <p className="text-xs text-ink-muted">
        {c.petitioners.join(', ')} <em>v.</em> {c.respondents.join(', ')}
      </p>
      <p className="text-xs text-ink-muted">
        CNR <code>{c.cnr}</code> · filed {dateIST(c.filedOn)}
        {c.nextHearingOn ? ` · next hearing ${dateIST(c.nextHearingOn)}` : ''}
        {c.disposedOn ? ` · disposed ${dateIST(c.disposedOn)}` : ''}
      </p>
    </div>
  );
}

function ReviewButton({ link, decision, onDone }: { link: CaseLink; decision: 'CONFIRM' | 'REJECT'; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/court-links/${link.id}/review`, { decision, note: note || undefined });
      toast('success', decision === 'CONFIRM' ? 'Case linked to parcel' : 'Link rejected', 'Recorded in the audit trail.');
      setOpen(false);
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };
  const reject = decision === 'REJECT';
  return (
    <>
      <button className={reject ? 'btn-ghost' : 'btn-primary'} onClick={() => setOpen(true)}>
        {reject ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {reject ? 'Not this parcel' : 'Confirm link'}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={reject ? `Reject: ${link.courtCase.caseNumber} → ${link.parcel.parcelNumber}` : `Confirm: ${link.courtCase.caseNumber} → ${link.parcel.parcelNumber}`}
        footer={
          <button className={reject ? 'btn-danger' : 'btn-primary'} disabled={busy || (reject && note.trim().length < 10)} onClick={submit}>
            {busy && <Spinner />} {reject ? 'Reject link' : 'Confirm link'}
          </button>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            {reject
              ? 'Say why this case is not about this parcel (at least 10 characters).'
              : blocksAcquisition(link.courtCase)
                ? 'Once confirmed, this case will appear in “Why is it stuck?” as a litigation bottleneck for the parcel.'
                : 'Once confirmed, the case is shown on the parcel. It does not block acquisition (no stay, and not a title suit).'}
          </p>
          <label className="block">
            <span className="label">Note{reject ? '' : ' (optional)'}</span>
            <textarea className="input min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {err && <p role="alert" className="text-danger">{err}</p>}
        </div>
      </Dialog>
    </>
  );
}

export function CourtLinksView({ eyebrow }: { eyebrow?: string }) {
  const user = useUser();
  const toast = useToast();
  const [status, setStatus] = useState<'CANDIDATE' | 'CONFIRMED' | 'REJECTED'>('CANDIDATE');
  const state = useApi<CaseLink[]>(`/court-links${qs({ status })}`);
  const [syncing, setSyncing] = useState(false);
  const canDecide = DECIDERS.includes(user.role);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={eyebrow}
        title="Court case links"
        subtitle="Cases from eCourts are matched to parcels by survey number, village and party name. Each match is only a candidate until an officer confirms it; confirmed title suits and stay orders show up in “Why is it stuck?”."
        actions={
          canDecide && (
            <button
              className="btn-ghost"
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                try {
                  const r = await api.post<{ cases: number; candidates: number; source: string }>('/court-links/sync');
                  toast('success', 'Court cases refreshed', `${r.cases} cases from ${r.source === 'ECOURTS_SYNTHETIC' ? 'the synthetic eCourts adapter' : r.source}; ${r.candidates} open candidate(s)`);
                  state.reload();
                } catch (e) {
                  toast('error', 'Refresh failed', (e as ApiError).message);
                } finally {
                  setSyncing(false);
                }
              }}
            >
              {syncing ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Fetch from eCourts
            </button>
          )
        }
      />
      <p className="flex items-center gap-2 text-xs text-ink-muted">
        <SyntheticTag /> The eCourts adapter serves a synthetic dataset until access to the eCourts / NJDG services is arranged.
      </p>
      <Tabs
        value={status}
        onChange={setStatus}
        tabs={[
          { key: 'CANDIDATE', label: 'To verify' },
          { key: 'CONFIRMED', label: 'Confirmed' },
          { key: 'REJECTED', label: 'Rejected' },
        ]}
      />
      <DataState state={state} empty={<EmptyState icon={<Scale className="h-7 w-7" />} title={status === 'CANDIDATE' ? 'No candidates to verify' : `No ${status.toLowerCase()} links`} detail="Candidates appear when cases are fetched from eCourts." />}>
        {(links) => (
          <div className="space-y-4">
            {links.map((l) => (
              <Card
                key={l.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <Gavel className="h-4 w-4 text-saffron" />
                    Match <span className={cn('rounded-md px-2 py-0.5 text-sm tabular', l.score >= 0.8 ? 'bg-bharat-soft text-bharat' : 'bg-warning-soft text-warning')}>{Math.round(l.score * 100)}%</span>
                    {l.status === 'CONFIRMED' && blocksAcquisition(l.courtCase) && <Badge tone="bad">Holds up acquisition</Badge>}
                  </span>
                }
              >
                <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
                  <CaseSummary c={l.courtCase} />
                  <div className="text-sm">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Parcel</p>
                    <Link className="font-bold text-navy underline-offset-2 hover:underline" href={`/parcel/${l.parcel.id}`}>
                      {l.parcel.parcelNumber}
                    </Link>
                    <p>
                      Survey {l.parcel.surveyNumber}, {l.parcel.villageName} ({l.parcel.districtName})
                    </p>
                    <p className="text-xs text-ink-muted">Holders: {l.parcel.holders.map((h) => h.nameAsRecorded).join(', ')}</p>
                    <p className="text-xs text-ink-muted">
                      {l.parcel.project.code} · {humanize(l.parcel.stage)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Why it may be this parcel</p>
                    <ul className="space-y-1 text-xs">
                      {l.reasons.map((r) => (
                        <li key={r.signal} className="flex justify-between gap-2">
                          <span>{r.detail}</span>
                          <span className={cn('tabular shrink-0 font-semibold', r.weight < 0 ? 'text-danger' : 'text-bharat')}>
                            {r.weight > 0 ? '+' : ''}
                            {r.weight.toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {l.reviewNote && (
                      <p className="mt-2 text-xs">
                        “{l.reviewNote}” · {dateTimeIST(l.reviewedAt)}
                      </p>
                    )}
                    {canDecide && l.status === 'CANDIDATE' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ReviewButton link={l} decision="CONFIRM" onDone={state.reload} />
                        <ReviewButton link={l} decision="REJECT" onDone={state.reload} />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </DataState>
    </div>
  );
}

/** Court cases linked to one parcel (confirmed, plus candidates awaiting a decision). */
export function ParcelCourtCases({ parcelId }: { parcelId: string }) {
  const state = useApi<CaseLink[]>(`/court-links${qs({ parcelId })}`);
  const shown = state.data?.filter((l) => l.status !== 'REJECTED') ?? [];
  if (!state.data || !shown.length) return null;
  return (
    <Card title="Court cases" subtitle="From eCourts (synthetic). Candidates count only once an officer confirms them.">
      <ul className="space-y-3">
        {shown.map((l) => (
          <li key={l.id} className="rounded-md border border-line p-3">
            <div className="mb-1 flex items-center gap-2">
              <Badge tone={l.status === 'CONFIRMED' ? 'good' : 'warn'}>{l.status === 'CONFIRMED' ? 'Confirmed' : `Candidate · ${Math.round(l.score * 100)}%`}</Badge>
              {l.status === 'CONFIRMED' && blocksAcquisition(l.courtCase) && <Badge tone="bad">Holds up acquisition</Badge>}
            </div>
            <CaseSummary c={l.courtCase} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
