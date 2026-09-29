'use client';

import { MessageSquare } from 'lucide-react';
import React, { useState } from 'react';
import { Badge, Card, DataState, Dialog, EmptyState, PageHeader, Spinner, Tabs } from '@/components/ui';
import { useUser } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { api, ApiError, qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { Grievance } from '@/lib/api/types';
import { dateTimeIST, humanize } from '@/lib/format';

type Row = Grievance & { citizenName: string | null; parcel?: { parcelNumber: string; villageName: string; surveyNumber: string } };
const LANG_NAME: Record<string, string> = { en: 'English', hi: 'Hindi', mr: 'Marathi' };
const REPLIERS = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'STATE_OFFICER', 'DISTRICT_OFFICER', 'RR_OFFICER', 'FINANCE_OFFICER'];

function ReplyButton({ g, onDone }: { g: Row; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState<'UNDER_REVIEW' | 'RESOLVED'>('RESOLVED');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        Reply
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Reply to ${g.registrationNo}`}
        footer={
          <button
            className="btn-primary"
            disabled={busy || reply.trim().length < 10}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await api.post(`/grievances/${g.id}/reply`, { status, reply });
                toast('success', 'Reply sent', 'The citizen sees it on their phone; recorded in the audit trail.');
                setOpen(false);
                onDone();
              } catch (e) {
                setErr((e as ApiError).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Send
          </button>
        }
      >
        <div className="space-y-3 text-sm">
          <blockquote className="border-l-4 border-saffron pl-3" lang={g.language}>
            {g.description}
          </blockquote>
          <label className="block">
            <span className="label">Status</span>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="UNDER_REVIEW">Being looked into</option>
              <option value="RESOLVED">Answered / resolved</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Reply (plain words; at least 10 characters)</span>
            <textarea className="input min-h-[100px]" value={reply} onChange={(e) => setReply(e.target.value)} />
          </label>
          {err && <p className="text-danger">{err}</p>}
        </div>
      </Dialog>
    </>
  );
}

/** Citizen complaints (synthetic CPGRAMS numbers) for parcels in the officer's jurisdiction. */
export function GrievanceDeskView({ eyebrow }: { eyebrow?: string }) {
  const user = useUser();
  const [status, setStatus] = useState<'open' | 'RESOLVED'>('open');
  const state = useApi<Row[]>(`/grievances${qs({ status: status === 'RESOLVED' ? 'RESOLVED' : undefined })}`);
  const rows = state.data ? (status === 'open' ? state.data.filter((g) => g.status !== 'RESOLVED') : state.data) : undefined;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow={eyebrow} title="Citizen grievances" subtitle="Complaints land holders register from the citizen portal, in their own language. Numbers are issued by a synthetic CPGRAMS adapter." />
      <Tabs
        value={status}
        onChange={setStatus}
        tabs={[
          { key: 'open', label: 'Open' },
          { key: 'RESOLVED', label: 'Answered' },
        ]}
      />
      <DataState state={{ ...state, data: rows }} empty={<EmptyState icon={<MessageSquare className="h-7 w-7" />} title={status === 'open' ? 'No open grievances' : 'Nothing answered yet'} />}>
        {(list) => (
          <div className="space-y-3">
            {list.map((g) => (
              <Card
                key={g.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <code>{g.registrationNo}</code>
                    <Badge tone={g.status === 'RESOLVED' ? 'good' : g.status === 'UNDER_REVIEW' ? 'info' : 'warn'}>{humanize(g.status)}</Badge>
                    <Badge tone="muted">{humanize(g.category)}</Badge>
                  </span>
                }
                subtitle={`${g.citizenName ?? 'Land holder'} · ${g.parcel ? `${g.parcel.parcelNumber}, survey ${g.parcel.surveyNumber}, ${g.parcel.villageName}` : ''} · ${dateTimeIST(g.createdAt)}`}
              >
                <p className="text-xs text-ink-muted">Written in {LANG_NAME[g.language] ?? g.language}</p>
                <p className="mt-1 text-[15px]" lang={g.language}>
                  {g.description}
                </p>
                {g.reply && (
                  <p className="mt-2 rounded-md bg-bharat-soft/60 p-2 text-sm">
                    <strong>Reply ({dateTimeIST(g.repliedAt)}):</strong> {g.reply}
                  </p>
                )}
                {g.status !== 'RESOLVED' && REPLIERS.includes(user.role) && (
                  <div className="mt-3">
                    <ReplyButton g={g} onDone={state.reload} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </DataState>
    </div>
  );
}
