'use client';

import { CalendarPlus, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { TransitionButton } from '@/components/actions';
import { Card, DataState, Dialog, EmptyState, PageHeader, Select, Spinner, StatusBadge, SyntheticTag, Table } from '@/components/ui';
import { useUser } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { api, ApiError, qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { Award, Notice, Objection, Possession } from '@/lib/api/types';
import { dateIST, dateTimeIST, daysFromNow, ha, humanize, inr } from '@/lib/format';

const ACQUISITION = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'STATE_OFFICER', 'DISTRICT_OFFICER'];

/* ----------------------------------------------------------- possession */

export function PossessionView({ title = 'Possession & handover', eyebrow }: { title?: string; eyebrow?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const state = useApi<Possession[]>(`/possession${qs({ status })}`);
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} subtitle="Parcels eligible for possession (fully paid), taken under s.38, and handed to the requiring body. Open a parcel to act." />
      <Card>
        <DataState state={state} isEmpty={() => false}>
          {(rows) => (
            <Table
              rows={rows}
              rowKey={(r) => r.id}
              caption="Possession records"
              searchText={(r) => `${r.parcel?.parcelNumber} ${r.parcel?.villageName} ${r.authority ?? ''}`}
              onRowClick={(r) => r.parcel && router.push(`/parcel/${r.parcel.id}`)}
              toolbar={<Select label="Status" value={status} onChange={setStatus} options={[{ value: '', label: 'All' }, ...['ELIGIBLE', 'SCHEDULED', 'POSSESSION_TAKEN', 'HANDED_TO_PIA'].map((s) => ({ value: s, label: humanize(s) }))]} />}
              empty={<EmptyState title="No possession records" />}
              columns={[
                { key: 'p', header: 'Parcel', sortValue: (r) => r.parcel?.parcelNumber ?? '', cell: (r) => <span className="font-semibold">{r.parcel?.parcelNumber}</span> },
                { key: 'v', header: 'Village', sortValue: (r) => r.parcel?.villageName ?? '', cell: (r) => `${r.parcel?.villageName}, ${r.parcel?.districtName}` },
                { key: 'a', header: 'Area', align: 'right', sortValue: (r) => r.parcel?.totalAreaHa ?? 0, cell: (r) => ha(r.parcel?.totalAreaHa) },
                { key: 't', header: 'Taken', sortValue: (r) => r.takenOn ?? '', cell: (r) => dateIST(r.takenOn) },
                { key: 'h', header: 'Handed over', sortValue: (r) => r.handedOverOn ?? '', cell: (r) => dateIST(r.handedOverOn) },
                { key: 's', header: 'Status', sortValue: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
              ]}
            />
          )}
        </DataState>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------- objections & hearings */

function ScheduleHearingButton({ objection, onDone }: { objection: Objection; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState('');
  const [venue, setVenue] = useState(`Collectorate, ${objection.parcel?.districtName ?? ''}`);
  const [officer, setOfficer] = useState('Sub-Divisional Officer (LA)');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  return (
    <>
      <button className="btn-ghost px-2.5 py-1 text-xs" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        <CalendarPlus className="h-3.5 w-3.5" /> Schedule hearing
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule hearing (s.15(2))"
        footer={
          <button
            className="btn-primary"
            disabled={busy || !when}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await api.post(`/objections/${objection.id}/hearings`, { scheduledAt: new Date(when).toISOString(), venue, presidingOfficer: officer });
                toast('success', 'Hearing scheduled', `${objection.applicant} will be notified.`);
                setOpen(false);
                onDone();
              } catch (e) {
                setErr(e as ApiError);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Schedule
          </button>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="label">Date and time</span>
            <input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Venue</span>
            <input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Presiding officer</span>
            <input className="input" value={officer} onChange={(e) => setOfficer(e.target.value)} />
          </label>
          {err && <p className="text-sm text-danger">{err.message}</p>}
        </div>
      </Dialog>
    </>
  );
}

function RecordHearingButton({ hearingId, onDone }: { hearingId: string; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (held: boolean) => {
    setBusy(true);
    try {
      await api.post(`/objections/hearings/${hearingId}/outcome`, { held, outcome: outcome || undefined });
      toast('success', held ? 'Hearing recorded as held' : 'Hearing adjourned');
      setOpen(false);
      onDone();
    } catch (e) {
      toast('error', 'Not recorded', (e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button className="btn-ghost px-2.5 py-1 text-xs" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Record outcome
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Record hearing"
        footer={
          <>
            <button className="btn-ghost" disabled={busy} onClick={() => submit(false)}>
              Adjourned
            </button>
            <button className="btn-primary" disabled={busy} onClick={() => submit(true)}>
              {busy && <Spinner />} Held
            </button>
          </>
        }
      >
        <label className="block">
          <span className="label">What was heard / decided</span>
          <textarea className="input min-h-[100px]" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        </label>
      </Dialog>
    </>
  );
}

export function ObjectionsView({ title = 'Objections (s.15)', eyebrow, hearingsOnly }: { title?: string; eyebrow?: string; hearingsOnly?: boolean }) {
  const user = useUser();
  const router = useRouter();
  const [status, setStatus] = useState('');
  const state = useApi<Objection[]>(`/objections${qs({ status })}`);
  const canAct = ACQUISITION.includes(user.role);

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={hearingsOnly ? 'Every hearing on an objection, upcoming first. The objector must be heard before a decision (s.15(2)).' : 'Objections filed within the s.15 window, with their hearings and disposal. They block the s.19 declaration and the award until disposed of.'}
      />
      <Card>
        <DataState state={state} isEmpty={() => false}>
          {(rows) => {
            if (hearingsOnly) {
              const hearings = rows.flatMap((o) => o.hearings.map((h) => ({ h, o }))).sort((a, b) => +new Date(a.h.scheduledAt) - +new Date(b.h.scheduledAt));
              return (
                <Table
                  rows={hearings}
                  rowKey={(r) => r.h.id}
                  caption="Hearings"
                  onRowClick={(r) => r.o.parcel && router.push(`/parcel/${r.o.parcel.id}`)}
                  empty={<EmptyState title="No hearings" />}
                  columns={[
                    {
                      key: 'when',
                      header: 'When',
                      sortValue: (r) => r.h.scheduledAt,
                      cell: (r) => {
                        const d = daysFromNow(r.h.scheduledAt);
                        return (
                          <div>
                            <p className="font-semibold">{dateTimeIST(r.h.scheduledAt)}</p>
                            {r.h.status === 'SCHEDULED' && <p className={`text-xs ${d < 0 ? 'text-danger' : 'text-ink-muted'}`}>{d === 0 ? 'today' : d > 0 ? `in ${d} days` : `${-d} days ago`}</p>}
                          </div>
                        );
                      },
                    },
                    { key: 'who', header: 'Objector', sortValue: (r) => r.o.applicant, cell: (r) => <div><p>{r.o.applicant}</p><p className="text-xs text-ink-muted">{humanize(r.o.category)}</p></div> },
                    { key: 'parcel', header: 'Parcel', cell: (r) => <span className="text-xs">{r.o.parcel?.parcelNumber} · {r.o.parcel?.villageName}</span> },
                    { key: 'venue', header: 'Venue', cell: (r) => <span className="text-xs">{r.h.venue}<br />{r.h.presidingOfficer}</span> },
                    { key: 'status', header: 'Status', sortValue: (r) => r.h.status, cell: (r) => <StatusBadge status={r.h.status} /> },
                    { key: 'act', header: '', cell: (r) => (canAct && r.h.status === 'SCHEDULED' ? <RecordHearingButton hearingId={r.h.id} onDone={state.reload} /> : null) },
                  ]}
                />
              );
            }
            return (
              <Table
                rows={rows}
                rowKey={(o) => o.id}
                caption="Objections"
                searchText={(o) => `${o.applicant} ${o.category} ${o.description} ${o.parcel?.parcelNumber} ${o.parcel?.villageName}`}
                onRowClick={(o) => o.parcel && router.push(`/parcel/${o.parcel.id}`)}
                toolbar={<Select label="Status" value={status} onChange={setStatus} options={[{ value: '', label: 'All' }, ...['SUBMITTED', 'UNDER_REVIEW', 'HEARING_SCHEDULED', 'ESCALATED', 'RESOLVED', 'REJECTED'].map((s) => ({ value: s, label: humanize(s) }))]} />}
                empty={<EmptyState title="No objections" />}
                columns={[
                  { key: 'filed', header: 'Filed', sortValue: (o) => o.filedOn, cell: (o) => dateIST(o.filedOn) },
                  {
                    key: 'who',
                    header: 'Objection',
                    sortValue: (o) => o.applicant,
                    cell: (o) => (
                      <div className="max-w-md">
                        <p className="font-semibold">
                          {o.applicant} · <span className="font-normal">{humanize(o.category)}</span>
                        </p>
                        <p className="line-clamp-2 text-xs text-ink-muted">{o.description}</p>
                      </div>
                    ),
                  },
                  { key: 'parcel', header: 'Parcel', cell: (o) => <span className="text-xs">{o.parcel?.parcelNumber} · {o.parcel?.villageName}</span> },
                  { key: 'hearing', header: 'Hearing', cell: (o) => (o.hearings.length ? <span className="text-xs">{dateTimeIST(o.hearings[o.hearings.length - 1].scheduledAt)} · {humanize(o.hearings[o.hearings.length - 1].status)}</span> : '—') },
                  { key: 'status', header: 'Status', sortValue: (o) => o.status, cell: (o) => <StatusBadge status={o.status} /> },
                  {
                    key: 'act',
                    header: '',
                    cell: (o) =>
                      canAct ? (
                        <div className="flex flex-col items-start gap-1">
                          {['SUBMITTED', 'UNDER_REVIEW', 'ESCALATED'].includes(o.status) && <ScheduleHearingButton objection={o} onDone={state.reload} />}
                          {o.status === 'SUBMITTED' && <TransitionButton entityType="Objection" entityId={o.id} event="REVIEW" label="Start review" onDone={state.reload} />}
                          {['HEARING_SCHEDULED', 'UNDER_REVIEW'].includes(o.status) && o.hearings.some((h) => h.status === 'HELD') && (
                            <>
                              <TransitionButton entityType="Objection" entityId={o.id} event="RESOLVE" label="Allow" onDone={state.reload} />
                              <TransitionButton entityType="Objection" entityId={o.id} event="REJECT" label="Disallow" onDone={state.reload} />
                            </>
                          )}
                        </div>
                      ) : null,
                  },
                ]}
              />
            );
          }}
        </DataState>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------- awards */

export function AwardsView({ title = 'Awards (s.23)', eyebrow }: { title?: string; eyebrow?: string }) {
  const router = useRouter();
  const state = useApi<Award[]>('/awards');
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} subtitle="Declared awards with their full calculation. To declare one, open a parcel in the Declared stage." />
      <Card>
        <DataState state={state} empty={<EmptyState title="No awards declared" />}>
          {(rows) => (
            <Table
              rows={rows}
              rowKey={(a) => a.id}
              caption="Awards"
              searchText={(a) => `${a.awardNumber} ${a.parcel?.parcelNumber} ${a.parcel?.villageName} ${a.parcel?.displayOwnerName}`}
              onRowClick={(a) => router.push(`/parcel/${a.parcelId}`)}
              columns={[
                { key: 'no', header: 'Award', sortValue: (a) => a.awardNumber, cell: (a) => <div><p className="font-semibold">{a.awardNumber}</p><p className="text-xs text-ink-muted">{dateIST(a.awardDate)}</p></div> },
                { key: 'p', header: 'Parcel', cell: (a) => <span className="text-xs">{a.parcel?.parcelNumber} · {a.parcel?.villageName}<br />{a.parcel?.displayOwnerName}</span> },
                { key: 'mv', header: 'Market value', align: 'right', sortValue: (a) => Number(a.marketValuePaise), cell: (a) => inr(a.marketValuePaise, { paise: false }) },
                { key: 'm', header: 'Factor', align: 'right', cell: (a) => `×${a.multiplier}` },
                { key: 'sol', header: 'Solatium', align: 'right', sortValue: (a) => Number(a.solatiumPaise), cell: (a) => inr(a.solatiumPaise, { paise: false }) },
                { key: 'add', header: 'Additional 12%', align: 'right', sortValue: (a) => Number(a.additionalAmountPaise), cell: (a) => inr(a.additionalAmountPaise, { paise: false }) },
                { key: 't', header: 'Total', align: 'right', sortValue: (a) => Number(a.totalPaise), cell: (a) => <strong>{inr(a.totalPaise, { paise: false })}</strong> },
                { key: 's', header: 'Parcel stage', cell: (a) => <StatusBadge status={a.parcel?.stage} /> },
              ]}
            />
          )}
        </DataState>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------- notices */

export function NoticesView({ title = 'Statutory notices', eyebrow }: { title?: string; eyebrow?: string }) {
  const state = useApi<Notice[]>('/notices');
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} subtitle="Gazette notifications under ss.11, 19 and 21. Publishing one moves every parcel it covers through the lifecycle." />
      <Card>
        <DataState state={state} empty={<EmptyState title="No notices published" />}>
          {(rows) => (
            <Table
              rows={rows}
              rowKey={(n) => n.id}
              caption="Notices"
              searchText={(n) => `${n.kind} ${n.referenceNo} ${n.project?.code}`}
              columns={[
                { key: 'd', header: 'Published', sortValue: (n) => n.publishedOn, cell: (n) => dateIST(n.publishedOn) },
                { key: 'k', header: 'Notice', sortValue: (n) => n.kind, cell: (n) => <span className="font-semibold">{humanize(n.kind)}</span> },
                { key: 'r', header: 'Reference', cell: (n) => <span className="text-xs">{n.referenceNo}<br />{n.gazetteRef}</span> },
                { key: 'p', header: 'Project', cell: (n) => n.project?.code },
                { key: 'c', header: 'Parcels', align: 'right', cell: (n) => n._count?.parcels ?? 0 },
                { key: 's', header: '', cell: () => <SyntheticTag /> },
              ]}
            />
          )}
        </DataState>
      </Card>
    </div>
  );
}
