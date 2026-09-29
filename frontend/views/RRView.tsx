'use client';

import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { TransitionButton } from '@/components/actions';
import { Badge, Card, DataState, EmptyState, PageHeader, Progress, Stat, StatusBadge, Table } from '@/components/ui';
import { useUser } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { api, ApiError, qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { Entitlement, Family, RRCase } from '@/lib/api/types';
import { dateIST, humanize, inr, num } from '@/lib/format';

const RR_ROLES = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'RR_OFFICER', 'DISTRICT_OFFICER'];
const NEXT_EVENT: Record<string, { event: string; label: string }> = {
  IDENTIFIED: { event: 'VERIFY_ELIGIBILITY', label: 'Verify eligibility' },
  ELIGIBILITY_VERIFIED: { event: 'CREATE_PLAN', label: 'Create plan' },
  BENEFIT_DELIVERED: { event: 'CLOSE', label: 'Close case' },
};

function DeliverButton({ grantId, onDone }: { grantId: string; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost px-2 py-0.5 text-[11px]"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          await api.post(`/rr/grants/${grantId}/deliver`, {});
          toast('success', 'Entitlement delivered');
          onDone();
        } catch (err) {
          toast('error', 'Could not record delivery', (err as ApiError).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <CheckCircle2 className="h-3 w-3" /> Deliver
    </button>
  );
}

/** Assigns the standard Second Schedule package (house only for displaced families). */
function AssignPackageButton({ rrCase, onDone }: { rrCase: RRCase; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const codes = ['RESETTLEMENT_ALLOWANCE', 'SUBSISTENCE_GRANT', 'TRANSPORTATION', 'CHOICE_EMPLOYMENT_OR_ANNUITY', ...(rrCase.family.isDisplaced ? ['HOUSE_RURAL'] : [])];
  return (
    <button
      className="btn-primary px-2.5 py-1 text-xs"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          await api.post(`/rr/cases/${rrCase.id}/grants`, { entitlementCodes: codes });
          toast('success', 'Entitlements assigned', `${codes.length} Second Schedule entitlements`);
          onDone();
        } catch (err) {
          toast('error', 'Could not assign', (err as ApiError).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      Assign package
    </button>
  );
}

/** R&R cases: family, entitlements with delivery status, and the next step. */
export function RRCasesView({ title = 'R&R cases', eyebrow, status, subtitle }: { title?: string; eyebrow?: string; status?: string; subtitle?: string }) {
  const user = useUser();
  const router = useRouter();
  const state = useApi<RRCase[]>(`/rr/cases${qs({ status })}`);
  const canAct = RR_ROLES.includes(user.role);

  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle ?? 'Second Schedule entitlements per displaced family. Possession waits until all are delivered.'} />
      <DataState state={state} isEmpty={() => false} rows={6}>
        {(cases) => {
          const grants = cases.flatMap((c) => c.grants);
          const delivered = grants.filter((g) => g.status === 'DELIVERED').length;
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Cases" value={num(cases.length)} />
                <Stat label="Families displaced" value={num(cases.filter((c) => c.family.isDisplaced).length)} />
                <Stat label="Vulnerable families" value={num(cases.filter((c) => c.family.isVulnerable).length)} tone="warn" />
                <Stat label="Entitlements delivered" value={`${delivered}/${grants.length}`} tone={delivered === grants.length ? 'good' : 'warn'} />
              </div>
              <Card>
                <Table
                  rows={cases}
                  rowKey={(c) => c.id}
                  caption="R&R cases"
                  searchText={(c) => `${c.family.headName} ${c.family.villageName} ${c.parcel?.parcelNumber}`}
                  searchPlaceholder="Family head, village, parcel…"
                  onRowClick={(c) => c.parcel && router.push(`/parcel/${c.parcel.id}`)}
                  empty={<EmptyState title="No cases in this queue" />}
                  columns={[
                    {
                      key: 'family',
                      header: 'Family',
                      sortValue: (c) => c.family.headName,
                      cell: (c) => (
                        <div>
                          <p className="font-semibold">{c.family.headName}</p>
                          <p className="text-xs text-ink-muted">
                            {c.family.familySize} members · {humanize(c.family.category)} · {c.family.villageName}
                          </p>
                          {c.family.isVulnerable && <Badge tone="warn">Vulnerable</Badge>}
                        </div>
                      ),
                    },
                    { key: 'parcel', header: 'Parcel', sortValue: (c) => c.parcel?.parcelNumber ?? '', cell: (c) => <span className="text-xs">{c.parcel?.parcelNumber} · <StatusBadge status={c.parcel?.stage} /></span> },
                    {
                      key: 'grants',
                      header: 'Entitlements',
                      cell: (c) => (
                        <ul className="space-y-1">
                          {c.grants.map((g) => (
                            <li key={g.id} className="flex items-center justify-between gap-2 text-xs">
                              <span>
                                {g.entitlement.name}
                                {g.amountPaise ? ` · ${inr(g.amountPaise, { paise: false })}` : ''}
                                {g.deliveredOn ? ` · ${dateIST(g.deliveredOn)}` : ''}
                              </span>
                              {g.status === 'ASSIGNED' && canAct ? <DeliverButton grantId={g.id} onDone={state.reload} /> : <StatusBadge status={g.status} />}
                            </li>
                          ))}
                          {c.grants.length === 0 && <li className="text-xs text-ink-muted">None assigned</li>}
                        </ul>
                      ),
                    },
                    {
                      key: 'status',
                      header: 'Case',
                      sortValue: (c) => c.status,
                      cell: (c) => {
                        const next = NEXT_EVENT[c.status];
                        const allDone = c.grants.length > 0 && c.grants.every((g) => g.status !== 'ASSIGNED');
                        return (
                          <div className="space-y-1">
                            <StatusBadge status={c.status} />
                            {canAct && c.status === 'PLAN_CREATED' && <AssignPackageButton rrCase={c} onDone={state.reload} />}
                            {canAct && next && <TransitionButton entityType="RRCase" entityId={c.id} event={next.event} label={next.label} onDone={state.reload} />}
                            {canAct && c.status === 'BENEFIT_ASSIGNED' && allDone && <TransitionButton entityType="RRCase" entityId={c.id} event="MARK_DELIVERED" label="Mark delivered" onDone={state.reload} />}
                          </div>
                        );
                      },
                    },
                  ]}
                />
              </Card>
            </div>
          );
        }}
      </DataState>
    </div>
  );
}

export function FamiliesView() {
  const state = useApi<Array<Family & { rrCases: Array<{ id: string; status: string }> }>>('/rr/families');
  return (
    <div>
      <PageHeader eyebrow="R&R" title="Affected families" subtitle="Identified through the social impact assessment and field survey. IDs are stored only as salted hashes." />
      <Card>
        <DataState state={state}>
          {(rows) => (
            <Table
              rows={rows}
              rowKey={(f) => f.id}
              searchText={(f) => `${f.headName} ${f.villageName} ${f.category}`}
              columns={[
                { key: 'h', header: 'Head of family', sortValue: (f) => f.headName, cell: (f) => <span className="font-semibold">{f.headName}</span> },
                { key: 'v', header: 'Village', sortValue: (f) => f.villageName, cell: (f) => f.villageName },
                { key: 's', header: 'Members', align: 'right', sortValue: (f) => f.familySize, cell: (f) => f.familySize },
                { key: 'c', header: 'Category', cell: (f) => humanize(f.category) },
                { key: 'flags', header: '', cell: (f) => <span className="flex gap-1">{f.isDisplaced && <Badge tone="info">Displaced</Badge>}{f.isVulnerable && <Badge tone="warn">Vulnerable</Badge>}</span> },
                { key: 'case', header: 'Case', cell: (f) => <StatusBadge status={f.rrCases[0]?.status} /> },
              ]}
            />
          )}
        </DataState>
      </Card>
    </div>
  );
}

export function EntitlementsView() {
  const state = useApi<Entitlement[]>('/rr/entitlements');
  return (
    <div>
      <PageHeader eyebrow="R&R" title="Entitlement catalogue" subtitle="Second Schedule of RFCTLARR 2013 (minimums; states may enhance)." />
      <Card>
        <DataState state={state}>
          {(rows) => (
            <ul className="divide-y divide-line">
              {rows.map((e) => (
                <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <div>
                    <p className="font-semibold">{e.name}</p>
                    <p className="text-sm text-ink-muted">{e.description}</p>
                    {e.citation && <p className="text-[11px] font-semibold text-info">{e.citation}</p>}
                  </div>
                  <span className="tabular text-sm font-bold">{e.amountPaise ? inr(e.amountPaise, { paise: false }) : 'In kind'}</span>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </Card>
    </div>
  );
}

export function RRProgressView() {
  const state = useApi<RRCase[]>('/rr/cases');
  return (
    <div>
      <PageHeader eyebrow="R&R" title="Delivery progress" subtitle="Share of assigned entitlements delivered, by village." />
      <Card>
        <DataState state={state}>
          {(cases) => {
            const byVillage = new Map<string, { total: number; done: number; families: number }>();
            for (const c of cases) {
              const v = byVillage.get(c.family.villageName) ?? { total: 0, done: 0, families: 0 };
              v.families++;
              v.total += c.grants.length;
              v.done += c.grants.filter((g) => g.status === 'DELIVERED').length;
              byVillage.set(c.family.villageName, v);
            }
            return (
              <ul className="space-y-3">
                {[...byVillage.entries()].sort().map(([village, v]) => (
                  <li key={village}>
                    <p className="text-sm font-semibold">
                      {village} <span className="text-xs font-normal text-ink-muted">· {v.families} families · {v.done}/{v.total} entitlements</span>
                    </p>
                    <Progress value={v.total ? (v.done / v.total) * 100 : 0} label={`${village} R&R delivery`} tone={v.done === v.total ? 'good' : 'accent'} />
                  </li>
                ))}
              </ul>
            );
          }}
        </DataState>
      </Card>
    </div>
  );
}
