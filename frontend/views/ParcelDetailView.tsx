'use client';

import { ArrowLeft, FileText, MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import React from 'react';
import { DeclareAwardButton, HandOverButton, PayButton, TakePossessionButton, TransitionButton } from '@/components/actions';
import { AwardBreakdown } from '@/components/AwardBreakdown';
import { DigitalThread } from '@/components/DigitalThread';
import { LifecyclePanel } from '@/components/LifecyclePanel';
import { ParcelCourtCases } from '@/views/CourtLinksView';
import { ParcelMapCanvas } from '@/components/map/ParcelMap';
import { ParcelClocks } from '@/views/StatutoryViews';
import { ParcelGateCard } from '@/views/GisGateView';
import type { ParcelFeature } from '@/components/map/map-types';
import { Badge, Card, DataState, EmptyState, PageHeader, Stat, StatusBadge, SyntheticTag } from '@/components/ui';
import { useUser } from '@/context/SessionContext';
import { useApi } from '@/lib/api/hooks';
import type { ParcelDetail } from '@/lib/api/types';
import { dateIST, ha, humanize, inr, inrShort, num } from '@/lib/format';

const ACQUISITION = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'STATE_OFFICER', 'DISTRICT_OFFICER'];
const FINANCE = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'FINANCE_OFFICER', 'DISTRICT_OFFICER'];
const POSSESSION = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'DISTRICT_OFFICER', 'FIELD_OFFICER'];

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
            {user.role === 'FIELD_OFFICER' && (
              <Link className="btn-primary" href={`/field/capture?parcel=${p.id}`}>
                <MapPin className="h-4 w-4" /> Capture evidence
              </Link>
            )}
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

          <Card title="Digital thread" subtitle="Every audited event on this parcel and its notices, cases, money, R&R, possession and documents, each sealed by its hash">
            <DigitalThread parcelId={p.id} />
          </Card>
        </div>

        <div className="space-y-5">
          <LifecyclePanel entityType="Parcel" entityId={p.id} onChanged={reload} showHistory={false} title="What can happen next" />
          <ParcelGateCard parcelId={p.id} projectId={p.project.id} onChanged={reload} />
          <Card title="Statutory clocks" subtitle="From the rule pack in force when each clock started">
            <ParcelClocks parcelId={p.id} />
          </Card>
          {feature.length > 0 && (
            <Card title="Boundary" subtitle={<span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> PostGIS-validated geometry</span>}>
              <ParcelMapCanvas features={feature} height={260} />
            </Card>
          )}
          <ParcelCourtCases parcelId={p.id} />
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
