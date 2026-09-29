'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { PayButton, TransitionButton } from '@/components/actions';
import { Badge, Card, DataState, EmptyState, PageHeader, Select, StatusBadge, Table } from '@/components/ui';
import { useUser } from '@/context/SessionContext';
import { qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { Compensation, CompensationPage } from '@/lib/api/types';
import { dateIST, humanize, inr, inrShort, num } from '@/lib/format';

const STATUSES = ['ASSESSED', 'APPROVED', 'INITIATED', 'PAID', 'FAILED', 'DISPUTED', 'ON_HOLD'];
const APPROVERS = ['CENTRAL_ADMIN', 'STATE_ADMIN', 'DISTRICT_OFFICER'];
const PAYERS = ['CENTRAL_ADMIN', 'FINANCE_OFFICER'];

/**
 * Compensation lines with the action each status allows: approve (Collector),
 * pay through the gateway (Finance), retry a failure. Holds and disputes are
 * released from the parcel's lifecycle panel.
 */
export function CompensationView({ title = 'Compensation', eyebrow, status: fixedStatus, subtitle }: { title?: string; eyebrow?: string; status?: string; subtitle?: string }) {
  const user = useUser();
  const router = useRouter();
  const [status, setStatus] = useState(fixedStatus ?? '');
  const state = useApi<CompensationPage>(`/compensation${qs({ status: fixedStatus ?? status, pageSize: 500 })}`);

  const action = (c: Compensation) => {
    if (c.status === 'ASSESSED' && APPROVERS.includes(user.role)) return <TransitionButton entityType="Compensation" entityId={c.id} event="APPROVE" label="Approve" onDone={state.reload} tone="primary" />;
    if (c.status === 'APPROVED' && PAYERS.includes(user.role)) return <PayButton compensationId={c.id} onDone={state.reload} />;
    if (c.status === 'FAILED' && PAYERS.includes(user.role)) return <TransitionButton entityType="Compensation" entityId={c.id} event="RETRY" label="Retry" onDone={state.reload} />;
    return null;
  };

  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle ?? 'Money in paise, paid only through the treasury gateway; every step is audited.'} />
      <DataState state={state} isEmpty={() => false} rows={6}>
        {(d) => (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {d.totalsByStatus.map((t) => (
                <div key={t.status} className="panel px-3 py-2">
                  <StatusBadge status={t.status} />
                  <p className="tabular mt-1 text-sm font-bold">{inrShort(t.amountPaise)}</p>
                  <p className="text-[11px] text-ink-muted">{num(t.count)} lines</p>
                </div>
              ))}
              <div className="panel ml-auto px-3 py-2 text-xs">
                <p className="font-semibold">Gateway</p>
                <p className="text-ink-muted">{d.gateway.name}</p>
                {d.gateway.synthetic && <Badge tone="warn">Synthetic, no money moves</Badge>}
              </div>
            </div>
            <Card>
              <Table
                rows={d.items}
                rowKey={(c) => c.id}
                caption="Compensation lines"
                searchText={(c) => `${c.beneficiaryName} ${c.parcel?.parcelNumber} ${c.parcel?.villageName} ${c.award?.awardNumber} ${c.paymentReferences.map((r) => r.utrNumber).join(' ')}`}
                searchPlaceholder="Beneficiary, parcel, award no., UTR…"
                onRowClick={(c) => c.parcel && router.push(`/parcel/${c.parcel.id}`)}
                toolbar={
                  !fixedStatus && (
                    <Select label="Status" value={status} onChange={setStatus} options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: humanize(s) }))]} />
                  )
                }
                empty={<EmptyState title="Nothing in this queue" detail="All clear." />}
                columns={[
                  {
                    key: 'who',
                    header: 'Beneficiary',
                    sortValue: (c) => c.beneficiaryName,
                    cell: (c) => (
                      <div>
                        <p className="font-semibold">{c.beneficiaryName}</p>
                        <p className="text-xs text-ink-muted">
                          {c.sharePct}% share{c.bankAccountLast4 ? ` · a/c ••${c.bankAccountLast4}` : ''}
                        </p>
                      </div>
                    ),
                  },
                  { key: 'parcel', header: 'Parcel', sortValue: (c) => c.parcel?.parcelNumber ?? '', cell: (c) => <span className="text-xs">{c.parcel?.parcelNumber} · {c.parcel?.villageName}</span> },
                  { key: 'award', header: 'Award', sortValue: (c) => c.award?.awardDate ?? '', cell: (c) => <span className="text-xs">{c.award ? `${c.award.awardNumber} · ${dateIST(c.award.awardDate)}` : '—'}</span> },
                  { key: 'amount', header: 'Amount', align: 'right', sortValue: (c) => Number(c.amountPaise), cell: (c) => <span className="font-semibold">{inr(c.amountPaise)}</span> },
                  {
                    key: 'status',
                    header: 'Status',
                    sortValue: (c) => c.status,
                    cell: (c) => (
                      <div className="space-y-1">
                        <StatusBadge status={c.status} />
                        {c.paymentReferences[0] && <p className="text-[11px] text-ink-muted">UTR {c.paymentReferences[0].utrNumber}</p>}
                      </div>
                    ),
                  },
                  { key: 'act', header: '', cell: (c) => action(c) },
                ]}
              />
            </Card>
          </div>
        )}
      </DataState>
    </div>
  );
}
