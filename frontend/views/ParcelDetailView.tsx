'use client';

import { ArrowLeft, FileText, Gavel, HeartHandshake, IndianRupee, KeyRound, Landmark, MapPin, Megaphone, Users } from 'lucide-react';
import Link from 'next/link';
import React, { useMemo } from 'react';
import { DeclareAwardButton, HandOverButton, PayButton, TakePossessionButton, TransitionButton } from '@/components/actions';
import { AwardBreakdown } from '@/components/AwardBreakdown';
import { LifecyclePanel } from '@/components/LifecyclePanel';
import { ParcelMapCanvas } from '@/components/map/ParcelMap';
import type { ParcelFeature } from '@/components/map/ParcelMapInner';
import { Badge, Card, DataState, EmptyState, PageHeader, Stat, StatusBadge, SyntheticTag } from '@/components/ui';
import { useUser } from '@/context/SessionContext';
import { useApi } from '@/lib/api/hooks';
import type { ParcelDetail } from '@/lib/api/types';
import { dateIST, dateTimeIST, ha, humanize, inr, inrShort, num } from '@/lib/format';

const ACQUISITION = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'STATE_OFFICER', 'DISTRICT_OFFICER'];
const FINANCE = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'FINANCE_OFFICER', 'DISTRICT_OFFICER'];
const POSSESSION = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'DISTRICT_OFFICER', 'FIELD_OFFICER'];

interface ThreadItem {
  at: string;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  tone?: 'good' | 'bad' | 'accent' | 'info';
}

/** Merge every dated event on the parcel into one chronological thread. */
function buildThread(p: ParcelDetail): ThreadItem[] {
  const items: ThreadItem[] = [];
  for (const n of p.notices) items.push({ at: n.publishedOn, icon: <Megaphone className="h-3.5 w-3.5" />, title: humanize(n.kind), detail: `${n.referenceNo}${n.gazetteRef ? ` · ${n.gazetteRef}` : ''}`, tone: 'info' });
  for (const o of p.objections) {
    items.push({ at: o.filedOn, icon: <Gavel className="h-3.5 w-3.5" />, title: `Objection filed: ${humanize(o.category)}`, detail: `${o.applicant}: ${o.description}`, tone: 'accent' });
    for (const h of o.hearings) items.push({ at: h.scheduledAt, icon: <Gavel className="h-3.5 w-3.5" />, title: `Hearing ${humanize(h.status).toLowerCase()}`, detail: `${h.venue} · ${h.presidingOfficer}${h.outcome ? ` · ${h.outcome}` : ''}` });
  }
  for (const a of p.awards) items.push({ at: a.awardDate, icon: <Landmark className="h-3.5 w-3.5" />, title: `Award ${a.awardNumber}`, detail: `Total ${inr(a.totalPaise)}`, tone: 'accent' });
  for (const c of p.compensations) for (const r of c.paymentReferences) items.push({ at: r.transactedAt, icon: <IndianRupee className="h-3.5 w-3.5" />, title: `Payment ${r.status === 'SUCCESS' ? 'credited' : 'failed'}: ${c.beneficiaryName}`, detail: `${inr(r.amountPaise)} · UTR ${r.utrNumber} · ${r.gatewaySource}`, tone: r.status === 'SUCCESS' ? 'good' : 'bad' });
  for (const rc of p.rrCases) for (const g of rc.grants) if (g.deliveredOn) items.push({ at: g.deliveredOn, icon: <HeartHandshake className="h-3.5 w-3.5" />, title: `R&R delivered: ${g.entitlement.name}`, detail: rc.family.headName, tone: 'good' });
  for (const h of p.history) items.push({ at: h.createdAt, icon: <KeyRound className="h-3.5 w-3.5" />, title: `Stage: ${humanize(h.fromState)} → ${humanize(h.toState)}`, detail: `${h.actor?.name ?? h.actorRole ?? 'System'}${h.reason ? ` · ${h.reason}` : ''}`, tone: h.override ? 'bad' : undefined });
  return items.sort((a, b) => +new Date(a.at) - +new Date(b.at));
}

export function ParcelDetailView({ id }: { id: string }) {
  const state = useApi<ParcelDetail>(`/parcels/${id}`);
  return (
    <DataState state={state} rows={8}>
      {(p) => <ParcelDetailBody p={p} reload={state.reload} />}
    </DataState>
  );
}

function ParcelDetailBody({ p, reload }: { p: ParcelDetail; reload: () => void }) {
  const user = useUser();
  const thread = useMemo(() => buildThread(p), [p]);
  const award = p.awards[0];
  const feature: ParcelFeature[] = p.geometry
    ? [{ type: 'Feature', id: p.id, geometry: p.geometry, properties: { id: p.id, parcelNumber: p.parcelNumber, surveyNumber: p.surveyNumber, villageName: p.villageName, districtName: p.districtName, totalAreaHa: p.totalAreaHa, stage: p.stage, displayOwnerName: p.displayOwnerName } }]
    : [];
  const paid = p.compensations.filter((c) => c.status === 'PAID').reduce((s, c) => s + Number(c.amountPaise), 0);
  const total = p.compensations.reduce((s, c) => s + Number(c.amountPaise), 0);

  return (
    <div className="space-y-5">
      <Link href={`/project/${p.project.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-info hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> {p.project.name}
      </Link>
      <PageHeader
        eyebrow={`${p.project.code} · ${p.villageName}${p.village.nameLocal ? ` (${p.village.nameLocal})` : ''}, ${p.districtName}`}
        title={`Parcel ${p.parcelNumber}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Survey {p.surveyNumber}
            {p.ulpin && <span>· ULPIN {p.ulpin}</span>}
            <StatusBadge status={p.stage} />
            {p.isSynthetic && <SyntheticTag />}
          </span>
        }
        actions={
          <>
            {p.stage === 'DECLARED' && ACQUISITION.includes(user.role) && <DeclareAwardButton parcelId={p.id} onDone={reload} />}
            {p.stage === 'COMPENSATION_PAID' && POSSESSION.includes(user.role) && <TakePossessionButton parcelId={p.id} onDone={reload} />}
            {p.stage === 'POSSESSION_TAKEN' && ACQUISITION.includes(user.role) && <HandOverButton parcelId={p.id} onDone={reload} />}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Area" value={ha(p.totalAreaHa, 3)} hint={p.landClass} />
        <Stat label="Families affected" value={num(p.familiesAffected)} hint={`${p.rrCases.length} displaced-family R&R case(s)`} />
        <Stat label="Award" value={award ? inrShort(award.totalPaise) : '—'} hint={award ? `${award.awardNumber} · ${dateIST(award.awardDate)}` : 'Not yet declared'} tone="accent" />
        <Stat label="Paid" value={total ? `${Math.round((paid / total) * 100)}%` : '—'} hint={total ? `${inrShort(paid)} of ${inrShort(total)}` : 'No compensation assessed'} tone={total && paid === total ? 'good' : total ? 'warn' : 'default'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card title="Holders" subtitle="As recorded; names are shown in the script of the source record">
            <ul className="divide-y divide-line">
              {p.holders.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-semibold">{h.nameAsRecorded}</span>
                    {h.person.fatherName && <span className="text-xs text-ink-muted"> · s/o {h.person.fatherName}</span>}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-ink-muted">
                    <Badge tone={h.person.nameScript === 'Deva' ? 'accent' : 'muted'}>{h.person.nameScript === 'Deva' ? 'Devanagari' : 'Latin'}</Badge>
                    {h.sharePct}% share · {humanize(h.source)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {award && (
            <Card title={`Award ${award.awardNumber}`} subtitle={`Declared ${dateIST(award.awardDate)} · status ${humanize(award.status)}`}>
              <AwardBreakdown lines={award.calculation.lines} unverified={award.calculation.unverified} />
            </Card>
          )}

          {p.compensations.length > 0 && (
            <Card title="Compensation" subtitle="One line per holder, split by share to the paisa">
              <ul className="divide-y divide-line">
                {p.compensations.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-semibold">{c.beneficiaryName}</p>
                      <p className="text-xs text-ink-muted">
                        {c.sharePct}% · {c.paymentReferences.map((r) => `UTR ${r.utrNumber} (${humanize(r.status)})`).join(', ') || 'no payment yet'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular font-semibold">{inr(c.amountPaise)}</span>
                      <StatusBadge status={c.status} />
                      {c.status === 'ASSESSED' && ['CENTRAL_ADMIN', 'STATE_ADMIN', 'DISTRICT_OFFICER'].includes(user.role) && <TransitionButton entityType="Compensation" entityId={c.id} event="APPROVE" label="Approve" onDone={reload} />}
                      {c.status === 'APPROVED' && FINANCE.includes(user.role) && <PayButton compensationId={c.id} onDone={reload} />}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {p.rrCases.length > 0 && (
            <Card title="Rehabilitation & resettlement" subtitle="Possession needs every entitlement delivered (s.38(1))">
              {p.rrCases.map((rc) => (
                <div key={rc.id} className="mb-3 last:mb-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4 text-ink-muted" /> {rc.family.headName} · family of {rc.family.familySize} <StatusBadge status={rc.status} />
                  </p>
                  <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                    {rc.grants.map((g) => (
                      <li key={g.id} className="flex items-center justify-between rounded border border-line px-2 py-1 text-xs">
                        <span>{g.entitlement.name}</span>
                        <StatusBadge status={g.status} />
                      </li>
                    ))}
                    {rc.grants.length === 0 && <li className="text-xs text-ink-muted">No entitlements assigned yet</li>}
                  </ul>
                </div>
              ))}
            </Card>
          )}

          <Card title="Digital thread" subtitle="Every dated event on this parcel, in order">
            {thread.length === 0 ? (
              <EmptyState title="No events yet" />
            ) : (
              <ol className="relative space-y-3 border-l-2 border-line pl-5">
                {thread.map((t, i) => (
                  <li key={i}>
                    <span className={`absolute -left-[11px] mt-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-panel ${t.tone === 'good' ? 'bg-bharat text-white' : t.tone === 'bad' ? 'bg-danger text-white' : t.tone === 'accent' ? 'bg-saffron text-white' : t.tone === 'info' ? 'bg-info text-white' : 'bg-line text-ink'}`}>
                      {t.icon}
                    </span>
                    <p className="text-sm font-semibold text-ink">{t.title}</p>
                    <p className="text-xs text-ink-muted">
                      {dateTimeIST(t.at)}
                      {t.detail ? ` · ${t.detail}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <LifecyclePanel entityType="Parcel" entityId={p.id} onChanged={reload} showHistory={false} title="What can happen next" />
          {feature.length > 0 && (
            <Card title="Boundary" subtitle={<span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> PostGIS-validated geometry</span>}>
              <ParcelMapCanvas features={feature} height={260} />
            </Card>
          )}
          <Card title="Documents">
            {p.documents.length === 0 ? (
              <EmptyState title="No documents attached" icon={<FileText className="h-6 w-6" />} />
            ) : (
              <ul className="divide-y divide-line text-sm">
                {p.documents.map((d) => (
                  <li key={d.id} className="py-2">
                    <p className="font-semibold">{d.title}</p>
                    <p className="text-xs text-ink-muted">
                      {humanize(d.kind)} · {d.referenceNo ?? d.fileName} · SHA-256 {d.sha256.slice(0, 12)}…
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Notices">
            <ul className="space-y-1 text-sm">
              {p.notices.map((n) => (
                <li key={n.id} className="flex justify-between gap-2">
                  <span>{humanize(n.kind)}</span>
                  <span className="text-xs text-ink-muted">{dateIST(n.publishedOn)}</span>
                </li>
              ))}
              {p.notices.length === 0 && <li className="text-xs text-ink-muted">None published</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
