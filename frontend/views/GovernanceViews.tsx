'use client';

import { Download, FileUp, ShieldAlert } from 'lucide-react';
import React, { useState } from 'react';
import { IntegrityBadge } from '@/components/IntegrityBadge';
import { verifyInclusionInBrowser } from '@/lib/merkle';
import { Badge, Card, DataState, Dialog, EmptyState, PageHeader, Select, Spinner, Stat, StatusBadge, SyntheticTag, Table } from '@/components/ui';
import { useUser } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { api, API_BASE_URL, ApiError, qs, tokenStore } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { AuditEntry, Compensation, CompensationPage, DocumentRecord, Health, Integration, NotificationItem, Paged, Parcel, Project, SlaTask } from '@/lib/api/types';
import { dateIST, dateTimeIST, humanize, num } from '@/lib/format';

/* ----------------------------------------------------------- audit */

export function AuditView({ eyebrow }: { eyebrow?: string }) {
  const [highlighted, setHighlighted] = useState(false);
  const [entityType, setEntityType] = useState('');
  const state = useApi<AuditEntry[]>(`/audit${qs({ highlighted: highlighted ? 'true' : undefined, entityType, limit: 300 })}`);
  const [open, setOpen] = useState<AuditEntry | null>(null);
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title="Audit trail" subtitle="Every write, hash-chained with SHA-256 over all stored fields and sealed daily into Merkle roots. Verification recomputes the whole chain and every root." actions={<IntegrityBadge />} />
      <div className="mb-5">
        <MerkleRoots />
      </div>
      <Card>
        <DataState state={state} isEmpty={() => false}>
          {(rows) => (
            <Table
              rows={rows}
              rowKey={(r) => r.id}
              caption="Audit entries"
              searchText={(r) => `${r.action} ${r.entityType} ${r.entityId} ${r.user?.name ?? ''} ${r.reason ?? ''}`}
              onRowClick={setOpen}
              toolbar={
                <>
                  <Select label="Entity" value={entityType} onChange={setEntityType} options={[{ value: '', label: 'All entities' }, ...['Parcel', 'Compensation', 'Objection', 'Hearing', 'RRCase', 'Possession', 'Project', 'StatutoryNotice', 'Document'].map((s) => ({ value: s, label: s }))]} />
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <input type="checkbox" checked={highlighted} onChange={(e) => setHighlighted(e.target.checked)} /> Overrides only
                  </label>
                </>
              }
              columns={[
                { key: 'seq', header: '#', align: 'right', sortValue: (r) => r.seq, cell: (r) => r.seq },
                { key: 'time', header: 'When (IST)', sortValue: (r) => r.timestamp, cell: (r) => <span className="text-xs">{dateTimeIST(r.timestamp)}</span> },
                {
                  key: 'action',
                  header: 'Action',
                  sortValue: (r) => r.action,
                  cell: (r) => (
                    <span className="flex items-center gap-1.5">
                      {r.highlighted && <ShieldAlert className="h-3.5 w-3.5 text-danger" aria-label="Override" />}
                      <span className={r.highlighted ? 'font-bold text-danger' : 'font-semibold'}>{humanize(r.action)}</span>
                    </span>
                  ),
                },
                { key: 'entity', header: 'Entity', cell: (r) => <span className="text-xs">{r.entityType} · {r.entityId.slice(0, 8)}</span> },
                { key: 'who', header: 'By', cell: (r) => <span className="text-xs">{r.user?.name ?? 'System'} · {humanize(r.actorRole)}</span> },
                { key: 'hash', header: 'Hash', cell: (r) => <code className="text-[11px] text-ink-muted">{r.hash.slice(0, 12)}…</code> },
              ]}
            />
          )}
        </DataState>
      </Card>
      {open && (
        <Dialog open onClose={() => setOpen(null)} title={`Audit entry #${open.seq}`} wide>
          <dl className="grid gap-2 text-sm sm:grid-cols-[140px_1fr]">
            <dt className="text-ink-muted">Action</dt>
            <dd className="font-semibold">{open.action}</dd>
            <dt className="text-ink-muted">Entity</dt>
            <dd>{open.entityType} {open.entityId}</dd>
            <dt className="text-ink-muted">By</dt>
            <dd>{open.user?.name ?? 'System'} ({open.actorRole})</dd>
            <dt className="text-ink-muted">When</dt>
            <dd>{dateTimeIST(open.timestamp)}</dd>
            {open.reason && (
              <>
                <dt className="text-ink-muted">Reason</dt>
                <dd>{open.reason}</dd>
              </>
            )}
            <dt className="text-ink-muted">Before</dt>
            <dd><pre className="overflow-x-auto rounded bg-surface p-2 text-xs">{JSON.stringify(open.previousState, null, 2)}</pre></dd>
            <dt className="text-ink-muted">After</dt>
            <dd><pre className="overflow-x-auto rounded bg-surface p-2 text-xs">{JSON.stringify(open.newState, null, 2)}</pre></dd>
            <dt className="text-ink-muted">Previous hash</dt>
            <dd><code className="break-all text-xs">{open.previousHash}</code></dd>
            <dt className="text-ink-muted">Hash</dt>
            <dd><code className="break-all text-xs">{open.hash}</code></dd>
          </dl>
          <ProofPanel seq={open.seq} entryHash={open.hash} />
        </Dialog>
      )}
    </div>
  );
}

interface Proof {
  sealed: boolean;
  message?: string;
  index: number;
  treeSize: number;
  path: string[];
  verified: boolean;
  algorithm: string;
  root: { period: string; root: string; chainHash: string; leafCount: number; fromSeq: number; toSeq: number };
}

/** Inclusion proof for one entry, re-verified in this browser with WebCrypto. */
function ProofPanel({ seq, entryHash }: { seq: number; entryHash: string }) {
  const [proof, setProof] = useState<Proof | null>(null);
  const [local, setLocal] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-4 rounded-lg border border-line p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Merkle inclusion proof</p>
        <button
          className="btn-ghost py-1"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const p = await api.get<Proof>(`/audit/entries/${seq}/proof`);
              setProof(p);
              setLocal(p.sealed ? await verifyInclusionInBrowser(entryHash, p.index, p.treeSize, p.path, p.root.root) : null);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Spinner />} Get proof and verify here
        </button>
      </div>
      {proof && !proof.sealed && <p className="mt-2 text-xs text-ink-muted">{proof.message}</p>}
      {proof?.sealed && (
        <div className="mt-2 space-y-1 text-xs">
          <p>
            Sealed in the <strong>{proof.root.period}</strong> root (entries #{proof.root.fromSeq}–#{proof.root.toSeq}, {proof.root.leafCount} leaves); this entry is leaf {proof.index}.
          </p>
          <p>
            Root <code className="break-all">{proof.root.root}</code>
          </p>
          <p>Path: {proof.path.length} sibling hashes (log₂ of the tree size).</p>
          <p className={local ? 'font-bold text-bharat' : 'font-bold text-danger'}>
            {local ? '✓ Verified in your browser (WebCrypto SHA-256), independently of the server' : '✗ Does not verify in your browser'}
          </p>
          <p className="text-ink-muted">{proof.algorithm}</p>
        </div>
      )}
    </div>
  );
}

function MerkleRoots() {
  const state = useApi<Array<{ id: string; period: string; fromSeq: number; toSeq: number; leafCount: number; root: string; chainHash: string; sealedAt: string }>>('/audit/merkle/roots');
  return (
    <Card title="Merkle roots" subtitle="One root per IST day over that day's entries; roots are chained, so rewriting history needs every later root rewritten too">
      <DataState state={state} empty={<EmptyState title="Nothing sealed yet" />}>
        {(rows) => (
          <ul className="max-h-72 divide-y divide-line overflow-y-auto text-xs">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="font-semibold">{r.period}</span>
                <span className="text-ink-muted">#{r.fromSeq}–#{r.toSeq} · {r.leafCount} entries</span>
                <code title={`chain ${r.chainHash}`}>{r.root.slice(0, 20)}…</code>
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </Card>
  );
}

/* ----------------------------------------------------------- SLA */

export function SlaView({ eyebrow }: { eyebrow?: string }) {
  const state = useApi<SlaTask[]>('/sla/tasks');
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title="SLA tracker" subtitle="Administrative targets (not statutory deadlines; those are on the statutory calendar)." />
      <Card>
        <DataState state={state} empty={<EmptyState title="No SLA tasks" />}>
          {(rows) => (
            <Table
              rows={rows}
              rowKey={(r) => r.id}
              caption="SLA tasks"
              columns={[
                { key: 't', header: 'Task', sortValue: (r) => r.taskName, cell: (r) => <div><p className="font-semibold">{r.taskName}</p><p className="text-xs text-ink-muted">{r.project.code} · {humanize(r.assignedRole)}</p></div> },
                { key: 'target', header: 'Target', sortValue: (r) => r.targetDate, cell: (r) => dateIST(r.targetDate) },
                {
                  key: 'left',
                  header: 'Status',
                  sortValue: (r) => r.daysRemaining ?? 9999,
                  cell: (r) =>
                    r.completedDate ? (
                      <Badge tone="good">Done {dateIST(r.completedDate)}</Badge>
                    ) : r.isBreached ? (
                      <Badge tone="bad">Breached {Math.abs(r.daysRemaining ?? 0)} days ago</Badge>
                    ) : (
                      <Badge tone={(r.daysRemaining ?? 99) <= 7 ? 'warn' : 'info'}>{r.daysRemaining} days left</Badge>
                    ),
                },
              ]}
            />
          )}
        </DataState>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------- documents */

const DOC_KINDS = ['GAZETTE_NOTIFICATION', 'AWARD_COPY', 'KHASRA_EXTRACT', 'GRAM_SABHA_CONSENT', 'FRA_SETTLEMENT_CERTIFICATE', 'FOREST_CLEARANCE', 'CRZ_CLEARANCE', 'WILDLIFE_CLEARANCE', 'POSSESSION_CERTIFICATE', 'COURT_ORDER', 'FIELD_PHOTO', 'OTHER'];

export function UploadDocumentButton({ parcelId, projectId, onDone, defaultKind = 'OTHER' }: { parcelId?: string; projectId?: string; onDone: () => void; defaultKind?: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(defaultKind);
  const [title, setTitle] = useState('');
  const [ref, setRef] = useState('');
  const [issuedOn, setIssuedOn] = useState('');
  const [parcelNo, setParcelNo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      let pid = parcelId;
      if (!pid && parcelNo) {
        const found = await api.get<Paged<Parcel>>(`/parcels${qs({ q: parcelNo, pageSize: 1 })}`);
        if (!found.items[0]) throw new Error(`No parcel matches ${parcelNo}`);
        pid = found.items[0].id;
      }
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      form.append('title', title || file.name);
      if (pid) form.append('parcelId', pid);
      if (projectId) form.append('projectId', projectId);
      if (ref) form.append('referenceNo', ref);
      if (issuedOn) form.append('issuedOn', issuedOn);
      const doc = await api.upload<DocumentRecord>('/documents', form);
      toast('success', 'Document uploaded', `SHA-256 ${doc.sha256.slice(0, 16)}…`);
      setOpen(false);
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <FileUp className="h-4 w-4" /> Upload document
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Upload document" footer={<button className="btn-primary" disabled={busy || !file || (!parcelId && !projectId && !parcelNo)} onClick={submit}>{busy && <Spinner />} Upload</button>}>
        <div className="space-y-3">
          <label className="block">
            <span className="label">File (PDF, PNG, JPEG, WebP; up to 10 MB)</span>
            <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className="block">
            <span className="label">Kind</span>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {DOC_KINDS.map((k) => <option key={k} value={k}>{humanize(k)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Title</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          {!parcelId && !projectId && (
            <label className="block">
              <span className="label">Parcel number</span>
              <input className="input" value={parcelNo} onChange={(e) => setParcelNo(e.target.value)} placeholder="e.g. YTL-KRS-004" />
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Reference no.</span>
              <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Issued on</span>
              <input type="date" className="input" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
            </label>
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
        </div>
      </Dialog>
    </>
  );
}

export function DocumentsView({ eyebrow }: { eyebrow?: string }) {
  const state = useApi<DocumentRecord[]>('/documents');
  const toast = useToast();
  const download = async (d: DocumentRecord) => {
    const res = await fetch(`${API_BASE_URL}/documents/${d.id}/download`, { headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` } });
    if (!res.ok) {
      toast('error', 'Download refused', ((await res.json().catch(() => ({}))) as { message?: string }).message ?? res.statusText);
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = d.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title="Documents" subtitle="Every file is stored with its SHA-256; downloads are re-hashed and refused if they differ." actions={<UploadDocumentButton onDone={state.reload} />} />
      <Card>
        <DataState state={state} empty={<EmptyState title="No documents yet" detail="Upload gazette notices, consent resolutions, clearances and court orders here." />}>
          {(rows) => (
            <Table
              rows={rows}
              rowKey={(d) => d.id}
              caption="Documents"
              searchText={(d) => `${d.title} ${d.kind} ${d.referenceNo ?? ''} ${d.parcel?.parcelNumber ?? ''}`}
              columns={[
                { key: 't', header: 'Document', sortValue: (d) => d.title, cell: (d) => <div><p className="font-semibold">{d.title}</p><p className="text-xs text-ink-muted">{humanize(d.kind)}{d.referenceNo ? ` · ${d.referenceNo}` : ''}</p></div> },
                { key: 'p', header: 'Attached to', cell: (d) => <span className="text-xs">{d.parcel ? `${d.parcel.parcelNumber} · ${d.parcel.villageName}` : d.project?.code ?? '—'}</span> },
                { key: 'd', header: 'Uploaded', sortValue: (d) => d.createdAt, cell: (d) => dateIST(d.createdAt) },
                { key: 'h', header: 'SHA-256', cell: (d) => <code className="text-[11px]">{d.sha256.slice(0, 16)}…</code> },
                {
                  key: 'dl',
                  header: '',
                  cell: (d) => (
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => download(d)}>
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                  ),
                },
              ]}
            />
          )}
        </DataState>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------- users, integrations, workflows */

export function UsersView() {
  const state = useApi<Array<{ id: string; name: string; email: string; role: string; designation: string | null; active: boolean; jurisdiction: { level: string; name: string } | null; organization: { name: string } | null }>>('/users');
  return (
    <div>
      <PageHeader eyebrow="Governance" title="Officers" subtitle="Accounts, roles and jurisdictions. Access is scoped to the jurisdiction on every query." />
      <Card>
        <DataState state={state}>
          {(rows) => (
            <Table
              rows={rows}
              rowKey={(u) => u.id}
              searchText={(u) => `${u.name} ${u.email} ${u.role} ${u.designation ?? ''} ${u.jurisdiction?.name ?? ''}`}
              columns={[
                { key: 'n', header: 'Name', sortValue: (u) => u.name, cell: (u) => <div><p className="font-semibold">{u.name}</p><p className="text-xs text-ink-muted">{u.designation}</p></div> },
                { key: 'r', header: 'Role', sortValue: (u) => u.role, cell: (u) => <Badge tone="info">{humanize(u.role)}</Badge> },
                { key: 'j', header: 'Jurisdiction', cell: (u) => (u.jurisdiction ? `${u.jurisdiction.name} (${u.jurisdiction.level.toLowerCase()})` : 'National') },
                { key: 'o', header: 'Organisation', cell: (u) => <span className="text-xs">{u.organization?.name ?? '—'}</span> },
                { key: 'e', header: 'Email', cell: (u) => <span className="text-xs">{u.email}</span> },
              ]}
            />
          )}
        </DataState>
      </Card>
    </div>
  );
}

export function IntegrationsView() {
  const state = useApi<Integration[]>('/integrations/status');
  const health = useApi<Health>('/system/health');
  return (
    <div>
      <PageHeader eyebrow="Governance" title="Integrations" subtitle="Every external system sits behind an adapter. In this build they are synthetic unless marked live." />
      <div className="grid gap-4 lg:grid-cols-2">
        <DataState state={state}>
          {(rows) => (
            <>
              {rows.map((r) => (
                <div key={r.key} className="panel flex items-start justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-xs text-ink-muted">{r.note}</p>
                  </div>
                  <StatusBadge status={r.mode} />
                </div>
              ))}
            </>
          )}
        </DataState>
      </div>
      <Card title="Active adapters" className="mt-5">
        <DataState state={health}>
          {(h) => (
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              {Object.entries(h.adapters).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line p-3">
                  <dt className="text-xs text-ink-muted">{humanize(k)}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </DataState>
      </Card>
    </div>
  );
}

export function WorkflowsView() {
  const state = useApi<Array<{ entityType: string; states: string[]; transitions: Array<{ event: string; label: string; from: string[]; to: string; roles: string[]; guards: string[]; domainOnly: boolean }> }>>('/lifecycle/definitions');
  return (
    <div>
      <PageHeader eyebrow="Governance" title="State machines" subtitle="The only paths any record can take. Guards are checked in the same transaction that writes the audit entry and the event." />
      <DataState state={state}>
        {(defs) => (
          <div className="grid gap-4 xl:grid-cols-2">
            {defs.map((d) => (
              <Card key={d.entityType} title={d.entityType} subtitle={d.states.map(humanize).join(' · ')}>
                <ul className="divide-y divide-line text-sm">
                  {d.transitions.map((t) => (
                    <li key={t.event} className="py-2">
                      <p className="font-semibold">
                        {t.label} <span className="font-normal text-ink-muted">({t.from.map(humanize).join(' / ')} → {humanize(t.to)})</span>
                      </p>
                      <p className="text-xs text-ink-muted">Roles: {t.roles.map(humanize).join(', ')}</p>
                      {t.guards.length > 0 && <p className="text-xs text-info">Guards: {t.guards.join(', ')}</p>}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </DataState>
    </div>
  );
}

/* ----------------------------------------------------------- notifications, settings, profile */

export function NotificationsView() {
  const state = useApi<NotificationItem[]>('/notifications');
  return (
    <div>
      <PageHeader title="Notifications" subtitle="Addressed to you or to your role in your jurisdiction." />
      <Card>
        <DataState state={state} empty={<EmptyState title="No notifications" />}>
          {(rows) => (
            <ul className="divide-y divide-line">
              {rows.map((n) => (
                <li key={n.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <div>
                    <p className="font-semibold">{n.title}</p>
                    <p className="text-sm text-ink-muted">{n.message}</p>
                    <p className="text-xs text-ink-muted">{dateTimeIST(n.createdAt)}</p>
                  </div>
                  <StatusBadge status={n.severity} />
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </Card>
    </div>
  );
}

export function SettingsView() {
  const health = useApi<Health>('/system/health');
  return (
    <div>
      <PageHeader title="Settings & system status" />
      <Card title="Server">
        <DataState state={health}>
          {(h) => (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-muted">Status</dt><dd className="font-semibold">{h.status}</dd></div>
              <div><dt className="text-xs text-ink-muted">Database</dt><dd className="font-semibold">{h.database} · PostGIS {h.postgis ?? 'n/a'}</dd></div>
              <div><dt className="text-xs text-ink-muted">Server clock</dt><dd className="font-semibold">{dateTimeIST(h.now)}{h.clockPinned && <Badge tone="warn" className="ml-2">Pinned for demo</Badge>}</dd></div>
              <div><dt className="text-xs text-ink-muted">Adapters</dt><dd className="font-semibold">{Object.entries(h.adapters).map(([k, v]) => `${k}: ${v}`).join(' · ')}</dd></div>
            </dl>
          )}
        </DataState>
      </Card>
    </div>
  );
}

export function ProfileView() {
  const user = useUser();
  return (
    <div>
      <PageHeader title="Profile" />
      <Card>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-ink-muted">Name</dt><dd className="font-semibold">{user.name}</dd></div>
          <div><dt className="text-xs text-ink-muted">Email</dt><dd className="font-semibold">{user.email}</dd></div>
          <div><dt className="text-xs text-ink-muted">Role</dt><dd className="font-semibold">{humanize(user.role)}</dd></div>
          <div><dt className="text-xs text-ink-muted">Jurisdiction</dt><dd className="font-semibold">{user.districtCode ?? user.stateCode ?? 'National'}</dd></div>
        </dl>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------- reports (CSV) */

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

function downloadCsv(name: string, rows: Array<Record<string, unknown>>) {
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsView({ eyebrow }: { eyebrow?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast('error', 'Export failed', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const reports = [
    {
      key: 'parcels',
      title: 'Parcel register',
      detail: 'Every parcel in your jurisdiction with stage, area and holders.',
      go: async () => {
        const all: Parcel[] = [];
        for (let page = 1; ; page++) {
          const d = await api.get<Paged<Parcel>>(`/parcels${qs({ page, pageSize: 500 })}`);
          all.push(...d.items);
          if (all.length >= d.total || d.items.length === 0) break;
        }
        downloadCsv('rnlam-parcels.csv', all.map((p) => ({ parcel: p.parcelNumber, survey: p.surveyNumber, ulpin: p.ulpin, village: p.villageName, district: p.districtName, state: p.stateName, area_ha: p.totalAreaHa, stage: p.stage, holders: p.displayOwnerName, families: p.familiesAffected, synthetic: p.isSynthetic })));
      },
    },
    {
      key: 'compensation',
      title: 'Compensation ledger',
      detail: 'Every compensation line in rupees, with status and UTR.',
      go: async () => {
        const d = await api.get<CompensationPage>(`/compensation${qs({ pageSize: 500 })}`);
        downloadCsv('rnlam-compensation.csv', d.items.map((c: Compensation) => ({ beneficiary: c.beneficiaryName, parcel: c.parcel?.parcelNumber, village: c.parcel?.villageName, award: c.award?.awardNumber, share_pct: c.sharePct, amount_rupees: (Number(c.amountPaise) / 100).toFixed(2), status: c.status, utr: c.paymentReferences[0]?.utrNumber ?? '', paid_on: c.paidOn ?? '' })));
      },
    },
    {
      key: 'projects',
      title: 'Project progress',
      detail: 'Parcels, area and possession share per project.',
      go: async () => {
        const d = await api.get<Project[]>('/projects');
        downloadCsv('rnlam-projects.csv', d.map((p) => ({ code: p.code, name: p.name, state: p.stateName, districts: p.districtNames.join('; '), status: p.status, parcels: p.parcelCount, area_ha: p.notifiedAreaHa, families: p.familiesAffected, possession_pct: p.possessionPct })));
      },
    },
  ];
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title="Reports" subtitle="CSV exports generated from live data in your jurisdiction (UTF-8, opens in Excel)." />
      <div className="grid gap-4 md:grid-cols-3">
        {reports.map((r) => (
          <div key={r.key} className="panel flex flex-col p-4">
            <p className="font-semibold">{r.title}</p>
            <p className="mt-1 flex-1 text-sm text-ink-muted">{r.detail}</p>
            <button className="btn-primary mt-3" disabled={!!busy} onClick={() => run(r.key, r.go)}>
              {busy === r.key ? <Spinner /> : <Download className="h-4 w-4" />} Download CSV
            </button>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted"><SyntheticTag /> Exports carry a synthetic flag where the underlying record is demonstration data.</p>
    </div>
  );
}

export function StatStrip({ items }: { items: Array<{ label: string; value: number | string }> }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((i) => <Stat key={i.label} label={i.label} value={typeof i.value === 'number' ? num(i.value) : i.value} />)}
    </div>
  );
}
