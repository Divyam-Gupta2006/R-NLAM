'use client';

import { Gavel, IndianRupee, KeyRound, Landmark, MessageSquareWarning } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { LifecyclePanel } from '@/components/LifecyclePanel';
import { Card, DataState, EmptyState, PageHeader, Stat, StatusBadge, Table } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { api, ApiError, qs } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { CompensationPage, Objection, Paged, Parcel, Project } from '@/lib/api/types';
import { dateIST, dateTimeIST, daysFromNow, ha, humanize, inrShort, num } from '@/lib/format';

/* ----------------------------------------------------------- district work queue */

function QueueList({ title, icon, href, items, empty }: { title: string; icon: React.ReactNode; href: string; items: Array<{ key: string; primary: string; secondary: string; to: string }>; empty: string }) {
  return (
    <Card title={<span className="flex items-center gap-2">{icon}{title}</span>} actions={<Link href={href} className="text-xs font-semibold text-info">Open queue</Link>}>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.slice(0, 6).map((i) => (
            <li key={i.key} className="py-2">
              <Link href={i.to} className="block hover:text-saffron">
                <p className="text-sm font-semibold">{i.primary}</p>
                <p className="text-xs text-ink-muted">{i.secondary}</p>
              </Link>
            </li>
          ))}
          {items.length > 6 && <li className="pt-2 text-xs text-ink-muted">+{items.length - 6} more</li>}
        </ul>
      )}
    </Card>
  );
}

export function WorkQueueView() {
  const declared = useApi<Paged<Parcel>>(`/parcels${qs({ stage: 'DECLARED', pageSize: 200 })}`);
  const ready = useApi<Paged<Parcel>>(`/parcels${qs({ stage: 'COMPENSATION_PAID', pageSize: 200 })}`);
  const toApprove = useApi<CompensationPage>(`/compensation${qs({ status: 'ASSESSED', pageSize: 200 })}`);
  const objections = useApi<Objection[]>('/objections');

  const open = (objections.data ?? []).filter((o) => ['SUBMITTED', 'UNDER_REVIEW', 'HEARING_SCHEDULED', 'ESCALATED'].includes(o.status));
  const hearings = open.flatMap((o) => o.hearings.filter((h) => h.status === 'SCHEDULED').map((h) => ({ h, o }))).sort((a, b) => +new Date(a.h.scheduledAt) - +new Date(b.h.scheduledAt));

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="District Collectorate" title="Today’s work queue" subtitle="Everything in your district that is waiting on you, straight from the lifecycle engine." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Awaiting award (s.23)" value={num(declared.data?.total)} icon={<Landmark className="h-4 w-4" />} tone="accent" />
        <Stat label="Compensation to approve" value={num(toApprove.data?.total)} hint={toApprove.data ? inrShort(toApprove.data.totalsByStatus.reduce((s, t) => s + Number(t.amountPaise), 0)) : undefined} icon={<IndianRupee className="h-4 w-4" />} />
        <Stat label="Open objections" value={num(open.length)} hint={`${hearings.length} hearings scheduled`} icon={<MessageSquareWarning className="h-4 w-4" />} tone={open.length ? 'warn' : 'default'} />
        <Stat label="Ready for possession" value={num(ready.data?.total)} hint="Paid; R&R may still block" icon={<KeyRound className="h-4 w-4" />} tone="good" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <QueueList
          title="Hearings coming up"
          icon={<Gavel className="h-4 w-4 text-saffron" />}
          href="/district/hearings"
          empty="No hearings scheduled."
          items={hearings.map(({ h, o }) => {
            const d = daysFromNow(h.scheduledAt);
            return { key: h.id, primary: `${o.applicant}: ${humanize(o.category)}`, secondary: `${dateTimeIST(h.scheduledAt)} (${d >= 0 ? `in ${d} days` : `${-d} days overdue`}) · ${o.parcel?.parcelNumber}`, to: `/parcel/${o.parcelId}` };
          })}
        />
        <QueueList
          title="Declared parcels awaiting award"
          icon={<Landmark className="h-4 w-4 text-saffron" />}
          href="/district/parcels"
          empty="No declared parcels without an award."
          items={(declared.data?.items ?? []).map((p) => ({ key: p.id, primary: `${p.parcelNumber} · ${p.villageName}`, secondary: `${ha(p.totalAreaHa)} · ${p.displayOwnerName}`, to: `/parcel/${p.id}` }))}
        />
        <QueueList
          title="Compensation to approve"
          icon={<IndianRupee className="h-4 w-4 text-saffron" />}
          href="/district/compensation"
          empty="Nothing waiting for approval."
          items={(toApprove.data?.items ?? []).map((c) => ({ key: c.id, primary: `${c.beneficiaryName} · ${inrShort(c.amountPaise)}`, secondary: `${c.parcel?.parcelNumber} · award ${c.award?.awardNumber ?? ''}`, to: `/parcel/${c.parcelId}` }))}
        />
        <QueueList
          title="Paid parcels: take possession"
          icon={<KeyRound className="h-4 w-4 text-saffron" />}
          href="/district/possession"
          empty="No paid parcels waiting for possession."
          items={(ready.data?.items ?? []).map((p) => ({ key: p.id, primary: `${p.parcelNumber} · ${p.villageName}`, secondary: `${ha(p.totalAreaHa)} · ${p.familiesAffected} families`, to: `/parcel/${p.id}` }))}
        />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- approvals (projects + proposals) */

interface Proposal {
  id: string;
  projectId: string;
  title: string;
  landRequiredHa: number;
  status: string;
  remarks: string | null;
  updatedAt: string;
  project: { code: string; name: string; stateName: string };
}

export function ApprovalsView() {
  const projects = useApi<Project[]>('/projects');
  const proposals = useApi<Proposal[]>('/proposals');
  const pendingProjects = (projects.data ?? []).filter((p) => ['SUBMITTED', 'UNDER_SCRUTINY'].includes(p.status));
  const pendingProposals = (proposals.data ?? []).filter((p) => ['SUBMITTED', 'UNDER_SCRUTINY', 'QUERY_RAISED'].includes(p.status));
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="State portal" title="Approvals" subtitle="Projects and proposals waiting for state scrutiny or approval." />
      <DataState state={projects} isEmpty={() => false}>
        {() =>
          pendingProjects.length === 0 && pendingProposals.length === 0 ? (
            <EmptyState title="Nothing awaiting approval" detail="New projects appear here when a requiring body submits them." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {pendingProjects.map((p) => (
                <LifecyclePanel key={p.id} entityType="Project" entityId={p.id} title={`${p.code}: ${p.name}`} onChanged={projects.reload} />
              ))}
              {pendingProposals.map((p) => (
                <LifecyclePanel key={p.id} entityType="Proposal" entityId={p.id} title={`Proposal: ${p.title}`} onChanged={proposals.reload} />
              ))}
            </div>
          )
        }
      </DataState>
    </div>
  );
}

export function ProposalsView({ canCreate }: { canCreate?: boolean }) {
  const toast = useToast();
  const state = useApi<Proposal[]>('/proposals');
  const projects = useApi<Project[]>(canCreate ? '/projects' : null);
  const [form, setForm] = useState({ projectId: '', title: '', landRequiredHa: '' });
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    try {
      await api.post('/proposals', { projectId: form.projectId, title: form.title, landRequiredHa: Number(form.landRequiredHa) });
      toast('success', 'Draft proposal created', 'Submit it from its lifecycle panel.');
      setForm({ projectId: '', title: '', landRequiredHa: '' });
      state.reload();
    } catch (e) {
      toast('error', 'Not created', (e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Acquisition proposals" subtitle="Land requirement proposals from the requiring body, scrutinised by district and state." />
      {canCreate && (
        <Card title="New proposal">
          <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_150px_auto]">
            <select aria-label="Project" className="input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">Project…</option>
              {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
            <input aria-label="Title" className="input" placeholder="Title, e.g. Additional land for toll plaza" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input aria-label="Land required (ha)" className="input" inputMode="decimal" placeholder="Land (ha)" value={form.landRequiredHa} onChange={(e) => setForm({ ...form, landRequiredHa: e.target.value })} />
            <button className="btn-primary" disabled={busy || !form.projectId || form.title.length < 3 || !(Number(form.landRequiredHa) > 0)} onClick={create}>
              Create draft
            </button>
          </div>
        </Card>
      )}
      <Card>
        <DataState state={state} empty={<EmptyState title="No proposals" />}>
          {(rows) => (
            <Table
              rows={rows}
              rowKey={(p) => p.id}
              onRowClick={(p) => setSelected(p.id === selected ? null : p.id)}
              columns={[
                { key: 't', header: 'Proposal', sortValue: (p) => p.title, cell: (p) => <div><p className="font-semibold">{p.title}</p><p className="text-xs text-ink-muted">{p.project.code} · {p.project.stateName}</p></div> },
                { key: 'a', header: 'Land', align: 'right', sortValue: (p) => p.landRequiredHa, cell: (p) => ha(p.landRequiredHa) },
                { key: 'u', header: 'Updated', sortValue: (p) => p.updatedAt, cell: (p) => dateIST(p.updatedAt) },
                { key: 's', header: 'Status', sortValue: (p) => p.status, cell: (p) => <StatusBadge status={p.status} /> },
              ]}
            />
          )}
        </DataState>
      </Card>
      {selected && <LifecyclePanel entityType="Proposal" entityId={selected} onChanged={state.reload} title="Selected proposal" />}
    </div>
  );
}

export function NewProjectView() {
  const toast = useToast();
  const router = useRouter();
  const [f, setF] = useState({ code: '', name: '', sector: 'Roads', description: '', stateCode: 'MH', stateName: 'Maharashtra', districtCodes: 'MH-WRD', districtNames: 'Wardha', piaName: '', requiredAreaHa: '', estimatedCostRupees: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const p = await api.post<Project>('/projects', {
        code: f.code.toUpperCase(),
        name: f.name,
        sector: f.sector,
        description: f.description || undefined,
        stateCode: f.stateCode,
        stateName: f.stateName,
        districtCodes: f.districtCodes.split(',').map((s) => s.trim()).filter(Boolean),
        districtNames: f.districtNames.split(',').map((s) => s.trim()).filter(Boolean),
        piaName: f.piaName,
        requiredAreaHa: Number(f.requiredAreaHa),
        estimatedCostRupees: Number(f.estimatedCostRupees),
      });
      toast('success', `Project ${p.code} created as draft`, 'Submit it for approval from the project page.');
      router.push(`/project/${p.id}`);
    } catch (e2) {
      setErr((e2 as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" value={f[k]} onChange={set(k)} required {...props} />
    </label>
  );

  return (
    <div>
      <PageHeader eyebrow="Requiring body" title="New project" subtitle="Creates a draft. The state scrutinises and approves it through the project lifecycle." />
      <form className="panel grid gap-4 p-5 md:grid-cols-2" onSubmit={submit}>
        {field('code', 'Project code (A–Z, 0–9, -)', { pattern: '[A-Za-z0-9-]{3,32}' })}
        {field('name', 'Project name')}
        <label className="block">
          <span className="label">Sector</span>
          <select className="input" value={f.sector} onChange={set('sector')}>
            {['Roads', 'Railways', 'Energy', 'Irrigation', 'Industrial', 'Urban'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        {field('piaName', 'Requiring body')}
        {field('stateCode', 'State code', { pattern: '[A-Z]{2}' })}
        {field('stateName', 'State')}
        {field('districtCodes', 'District codes (comma separated)')}
        {field('districtNames', 'District names (comma separated)')}
        {field('requiredAreaHa', 'Land required (ha)', { inputMode: 'decimal' })}
        {field('estimatedCostRupees', 'Estimated cost (₹)', { inputMode: 'numeric' })}
        <label className="block md:col-span-2">
          <span className="label">Description</span>
          <textarea className="input min-h-[90px]" value={f.description} onChange={set('description')} />
        </label>
        {err && <p className="text-sm text-danger md:col-span-2">{err}</p>}
        <div className="md:col-span-2">
          <button className="btn-primary" disabled={busy}>Create draft project</button>
        </div>
      </form>
    </div>
  );
}
