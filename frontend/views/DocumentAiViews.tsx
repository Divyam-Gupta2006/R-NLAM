'use client';

import { AlertTriangle, BookOpenCheck, CheckCircle2, FileSearch, Sparkles, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Badge, Card, Dialog, EmptyState, PageHeader, Spinner } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { api, ApiError } from '@/lib/api/client';
import type { DocumentRecord } from '@/lib/api/types';
import { dateTimeIST, humanize } from '@/lib/format';
import { cn } from '@/lib/utils';

/* ----------------------------------------------------------- field extraction review */

interface ProposedField {
  value: string | number;
  confidence: number;
  evidence: string;
  needs_review: boolean;
}
interface Extraction {
  id: string;
  documentType: string;
  documentTypeConfidence: number;
  textMethod: string;
  proposed: Record<string, ProposedField[]>;
  needsReview: boolean;
  status: 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED';
  confirmed: Record<string, Array<string | number>> | null;
  corrections: number | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const FIELD_LABELS: Record<string, string> = {
  survey_numbers: 'Survey / khasra no.',
  owner_names: 'Owner(s)',
  area_hectares: 'Area (ha)',
  amounts_inr: 'Amounts (₹)',
  dates: 'Dates',
  sections: 'Sections cited',
  village: 'Village',
  district: 'District',
  award_number: 'Award no.',
  reference_number: 'Reference no.',
};

const joinValues = (vs: Array<string | number>) => vs.map(String).join('; ');
const splitValues = (s: string, numeric: boolean) =>
  s
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => (numeric && /^-?\d+(\.\d+)?$/.test(x.replace(/,/g, '')) ? Number(x.replace(/,/g, '')) : x));

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="inline-flex items-center gap-1.5" title={`Confidence ${pct}%`}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className={cn('block h-full', value >= 0.8 ? 'bg-bharat' : 'bg-warning')} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[11px] tabular-nums text-ink-muted">{pct}%</span>
    </span>
  );
}

/**
 * Proposed fields from the AI service, each with its confidence and the text
 * it was read from. The officer confirms or corrects; flagged fields cannot
 * be skipped. Nothing is used until confirmed.
 */
export function ExtractionReviewDialog({ doc, open, onClose }: { doc: DocumentRecord | null; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState<Extraction[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');

  const load = async () => {
    if (!doc) return;
    setErr(null);
    try {
      const list = await api.get<Extraction[]>(`/documents/${doc.id}/extractions`);
      setItems(list);
      const latest = list[0];
      if (latest) {
        setEdits(Object.fromEntries(Object.entries(latest.proposed).map(([k, fs]) => [k, joinValues(fs.map((f) => f.value))])));
        setTouched({});
      }
    } catch (e) {
      setErr((e as ApiError).message);
    }
  };

  useEffect(() => {
    if (open) {
      setItems(null);
      setNote('');
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc?.id]);

  const propose = async () => {
    if (!doc) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/documents/${doc.id}/extract`);
      await load();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const latest = items?.[0];
  const flagged = latest ? Object.entries(latest.proposed).filter(([, fs]) => fs.some((f) => f.needs_review)).map(([k]) => k) : [];
  const unreviewed = flagged.filter((k) => !touched[k]);

  const review = async (decision: 'CONFIRM' | 'REJECT') => {
    if (!latest) return;
    setBusy(true);
    setErr(null);
    try {
      const fields: Record<string, Array<string | number>> = {};
      for (const [k, fs] of Object.entries(latest.proposed)) {
        const original = joinValues(fs.map((f) => f.value));
        if (touched[k] || edits[k] !== original) fields[k] = splitValues(edits[k] ?? '', fs.some((f) => typeof f.value === 'number'));
      }
      const r = await api.post<Extraction>(`/documents/extractions/${latest.id}/review`, { decision, fields: decision === 'CONFIRM' ? fields : undefined, note: note || undefined });
      toast('success', decision === 'CONFIRM' ? 'Fields confirmed' : 'Proposal rejected', decision === 'CONFIRM' ? `${r.corrections ?? 0} field(s) corrected; recorded in the audit trail.` : 'Recorded in the audit trail.');
      await load();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const pending = latest?.status === 'PENDING_REVIEW';
  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={doc ? `Read fields: ${doc.title}` : 'Read fields'}
      footer={
        pending ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {unreviewed.length > 0 && <span className="mr-auto text-xs text-warning">Tick each flagged field ({unreviewed.map((k) => FIELD_LABELS[k] ?? k).join(', ')}) after checking it.</span>}
            <button className="btn-ghost" disabled={busy || note.trim().length < 10} title="Give a reason of at least 10 characters" onClick={() => review('REJECT')}>
              <XCircle className="h-4 w-4" /> Reject
            </button>
            <button className="btn-primary" disabled={busy || unreviewed.length > 0} onClick={() => review('CONFIRM')}>
              {busy && <Spinner />} <CheckCircle2 className="h-4 w-4" /> Confirm fields
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">
          The AI service <strong>proposes</strong> values with the text it read them from. Fields under 80% confidence are flagged; you must check each one. Nothing is used until you confirm.
        </p>
        {err && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {err}
          </p>
        )}
        {items === null && !err && <Spinner />}
        {items && !latest && (
          <EmptyState
            icon={<FileSearch className="h-6 w-6" />}
            title="No fields read yet"
            detail="Reads the PDF's text layer (scanned images need Tesseract on the AI server)."
            action={
              <button className="btn-primary" onClick={propose} disabled={busy}>
                {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />} Propose fields
              </button>
            }
          />
        )}
        {latest && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={latest.status === 'CONFIRMED' ? 'good' : latest.status === 'REJECTED' ? 'bad' : 'warn'}>{humanize(latest.status)}</Badge>
              <span>
                Looks like: <strong>{humanize(latest.documentType)}</strong>
              </span>
              <ConfidenceBar value={latest.documentTypeConfidence} />
              <span className="text-xs text-ink-muted">
                read via {latest.textMethod} · {dateTimeIST(latest.createdAt)}
              </span>
              {!pending && (
                <button className="btn-ghost ml-auto py-1 text-xs" onClick={propose} disabled={busy}>
                  {busy && <Spinner />} Read again
                </button>
              )}
            </div>
            {latest.status === 'CONFIRMED' && (
              <p className="text-xs text-bharat">
                Confirmed {latest.reviewedAt ? dateTimeIST(latest.reviewedAt) : ''} with {latest.corrections ?? 0} correction(s).
              </p>
            )}
            {latest.status === 'REJECTED' && <p className="text-xs text-danger">Rejected: {latest.reviewNote}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Proposed fields</caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-muted">
                    <th className="py-2 pr-2">Field</th>
                    <th className="py-2 pr-2">{pending ? 'Value (edit to correct; separate several with ;)' : 'Confirmed value'}</th>
                    <th className="py-2 pr-2">Confidence</th>
                    <th className="py-2">Read from</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(latest.proposed)
                    .filter(([k, fs]) => fs.length > 0 || latest.confirmed?.[k]?.length)
                    .map(([k, fs]) => {
                      const flag = fs.some((f) => f.needs_review);
                      return (
                        <tr key={k} className={cn('border-b border-line/60 align-top', flag && 'bg-warning-soft/40')}>
                          <td className="py-2 pr-2 font-semibold">
                            {FIELD_LABELS[k] ?? humanize(k)}
                            {flag && (
                              <span className="mt-0.5 flex items-center gap-1 text-[11px] font-normal text-warning">
                                <AlertTriangle className="h-3 w-3" /> check this
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            {pending ? (
                              <div className="flex items-center gap-2">
                                <input
                                  className="input py-1"
                                  aria-label={FIELD_LABELS[k] ?? k}
                                  value={edits[k] ?? ''}
                                  onChange={(e) => {
                                    setEdits({ ...edits, [k]: e.target.value });
                                    setTouched({ ...touched, [k]: true });
                                  }}
                                />
                                {flag && (
                                  <label className="flex shrink-0 items-center gap-1 text-xs">
                                    <input type="checkbox" checked={!!touched[k]} onChange={(e) => setTouched({ ...touched, [k]: e.target.checked })} /> checked
                                  </label>
                                )}
                              </div>
                            ) : (
                              <span>{joinValues(latest.confirmed?.[k] ?? fs.map((f) => f.value)) || '—'}</span>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            <div className="flex flex-col gap-1">
                              {fs.map((f, i) => (
                                <ConfidenceBar key={i} value={f.confidence} />
                              ))}
                            </div>
                          </td>
                          <td className="py-2 text-xs text-ink-muted">
                            {fs.map((f, i) => (
                              <q key={i} className="block">
                                {f.evidence}
                              </q>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {pending && (
              <label className="block">
                <span className="label">Note (required to reject)</span>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Village corrected from the 7/12 extract" />
              </label>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

/* ----------------------------------------------------------- ask the Act */

interface LegalAnswer {
  answered: boolean;
  answer: string | null;
  citation?: string;
  title?: string;
  close_call?: boolean;
  also_relevant?: string[];
  message: string;
  retrieval: { top_score: number; coverage: number };
  passages: Array<{ id: string; citation: string; title: string; score: number; source: 'act' | 'rule-pack'; excerpt: string }>;
}

const EXAMPLES = [
  'Within how many days can a person object after the preliminary notification?',
  'What interest is payable if compensation is not paid before possession?',
  'Is Gram Sabha consent needed in Scheduled Areas?',
  'When does the award lapse?',
  'What is the one-time resettlement allowance?',
];

export function AskTheActView({ eyebrow }: { eyebrow?: string }) {
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<LegalAnswer | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const ask = async (question: string) => {
    if (question.trim().length < 5) return;
    setBusy(true);
    setErr(null);
    setAsked(question);
    try {
      setAnswer(await api.post<LegalAnswer>('/legal/ask', { question }));
    } catch (e) {
      setAnswer(null);
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title="Ask the Act"
        subtitle="Answers are quoted from the RFCTLARR Act 2013 and R-NLAM's rule packs, with the section. It refuses when it cannot find a good match. It is a finding aid, not legal advice."
      />
      <Card>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(q);
          }}
        >
          <label className="sr-only" htmlFor="legal-q">
            Question
          </label>
          <input id="legal-q" className="input flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What is the solatium?" maxLength={500} />
          <button className="btn-primary" disabled={busy || q.trim().length < 5}>
            {busy ? <Spinner /> : <BookOpenCheck className="h-4 w-4" />} Ask
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((x) => (
            <button
              key={x}
              className="rounded-full border border-line px-3 py-1 text-xs hover:border-saffron hover:text-saffron"
              onClick={() => {
                setQ(x);
                void ask(x);
              }}
            >
              {x}
            </button>
          ))}
        </div>
      </Card>

      {err && (
        <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {err}
        </p>
      )}

      {answer && (
        <div className="mt-4 space-y-4" aria-live="polite">
          <Card
            title={asked}
            subtitle={
              answer.answered ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{answer.citation}</Badge>
                  <span>{answer.title}</span>
                </span>
              ) : undefined
            }
          >
            {answer.answered ? (
              <>
                <blockquote className="border-l-4 border-saffron pl-3 text-[15px] leading-relaxed">{answer.answer}</blockquote>
                {answer.close_call && (
                  <p className="mt-3 flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Close call: {answer.also_relevant?.join(', ')} scored almost as high. Read both before acting.
                  </p>
                )}
                <p className="mt-3 text-xs text-ink-muted">{answer.message}</p>
              </>
            ) : (
              <p className="flex items-start gap-2 text-sm">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> {answer.message}
              </p>
            )}
          </Card>
          {answer.passages.length > 0 && (
            <Card title="Passages searched" subtitle="The top matches, so you can see why this answer was chosen.">
              <ol className="space-y-3">
                {answer.passages.map((p, i) => (
                  <li key={p.id} className="rounded-md border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-bold">{i + 1}.</span>
                      <Badge tone={i === 0 ? 'accent' : 'muted'}>{p.citation}</Badge>
                      <span className="font-semibold">{p.title}</span>
                      <span className="ml-auto text-[11px] text-ink-muted">
                        {p.source === 'act' ? 'Act text' : 'Rule pack'} · score {p.score}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                      {p.excerpt}
                      {p.excerpt.length >= 600 ? '…' : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-ink-muted">
        How good is it? On questions written after tuning, the right section came first 3 times in 8 and was in the top three 4 times in 8; every off-topic question was
        refused. Always read the cited section. Source: India Code text of Act 30 of 2013 (central text; state amendments are marked where included).
      </p>
    </div>
  );
}
