'use client';

import { ArrowRight, History, Lock, ShieldAlert } from 'lucide-react';
import React, { useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { LifecycleOption, LifecycleView } from '@/lib/api/types';
import { dateTimeIST, humanize } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { BlockerList, Card, DataState, Dialog, Spinner, StatusBadge } from './ui';

/**
 * What can happen next to one entity, and why not. Reads the lifecycle engine
 * (`GET /lifecycle/:type/:id`) so the UI never guesses: disabled actions show
 * the same cited blockers the backend enforces.
 */
export function LifecyclePanel({ entityType, entityId, onChanged, showHistory = true, title }: { entityType: string; entityId: string; onChanged?: () => void; showHistory?: boolean; title?: string }) {
  const state = useApi<LifecycleView>(`/lifecycle/${entityType}/${entityId}`);
  const [active, setActive] = useState<LifecycleOption | null>(null);

  return (
    <Card title={title ?? 'Lifecycle'} subtitle="Enforced by the backend state machine" actions={state.data && <StatusBadge status={state.data.state} />}>
      <DataState state={state} rows={3}>
        {(view) => (
          <div className="space-y-4">
            {view.options.length === 0 ? (
              <p className="text-sm text-ink-muted">No further transitions from {humanize(view.state)}.</p>
            ) : (
              <ul className="space-y-2">
                {view.options.map((o) => (
                  <li key={o.event} className="rounded-lg border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                        {o.label}
                        <ArrowRight className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
                        <StatusBadge status={o.to} />
                      </div>
                      {o.domainOnly ? (
                        <span className="text-xs text-ink-muted">Done from its own screen</span>
                      ) : !o.permitted ? (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                          <Lock className="h-3 w-3" /> Not your role
                        </span>
                      ) : (
                        <button className={o.blockers.length && !o.canOverride ? 'btn-ghost' : 'btn-primary'} disabled={o.blockers.length > 0 && !o.canOverride} onClick={() => setActive(o)}>
                          {o.blockers.length && o.canOverride ? (
                            <>
                              <ShieldAlert className="h-4 w-4" /> Override…
                            </>
                          ) : (
                            'Proceed'
                          )}
                        </button>
                      )}
                    </div>
                    {/* An action done from its own screen creates its own record ("no award yet" is expected); show only real blockers. */}
                    {(o.domainOnly ? o.blockers.filter((b) => !b.code.startsWith('NO_')) : o.blockers).length > 0 && (
                      <div className="mt-2">
                        <BlockerList blockers={o.domainOnly ? o.blockers.filter((b) => !b.code.startsWith('NO_')) : o.blockers} compact />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {showHistory && view.history.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                  <History className="h-3.5 w-3.5" /> History
                </p>
                <ol className="space-y-1.5 border-l-2 border-line pl-3">
                  {view.history.map((h) => (
                    <li key={h.id} className="text-xs">
                      <span className="font-semibold text-ink">{humanize(h.event)}</span>{' '}
                      <span className="text-ink-muted">
                        {humanize(h.fromState)} → {humanize(h.toState)} · {dateTimeIST(h.createdAt)} · {h.actor?.name ?? h.actorRole ?? 'System'}
                      </span>
                      {h.override && <span className="ml-1 font-bold text-danger">OVERRIDE</span>}
                      {h.reason && <p className="text-ink-muted">“{h.reason}”</p>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </DataState>

      {active && (
        <TransitionDialog
          entityType={entityType}
          entityId={entityId}
          option={active}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            state.reload();
            onChanged?.();
          }}
        />
      )}
    </Card>
  );
}

function TransitionDialog({ entityType, entityId, option, onClose, onDone }: { entityType: string; entityId: string; option: LifecycleOption; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const override = option.blockers.length > 0;
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const tooShort = override && reason.trim().length < 20;

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await api.post(`/lifecycle/${entityType}/${entityId}/transitions`, { event: option.event, reason: reason || undefined, override: override || undefined });
      toast('success', `${option.label}: done`, override ? 'Recorded as a highlighted override in the audit trail.' : undefined);
      onDone();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={override ? `Override: ${option.label}` : option.label}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className={override ? 'btn-danger' : 'btn-primary'} disabled={pending || tooShort} onClick={submit}>
            {pending && <Spinner />} {override ? 'Override and proceed' : 'Confirm'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {override && (
          <>
            <p className="text-sm text-ink">
              You are proceeding despite these blockers. Your name, role and reason are written to the tamper-evident audit trail as a <strong>highlighted</strong> entry, and national admins are notified.
            </p>
            <BlockerList blockers={option.blockers} compact />
          </>
        )}
        <label className="block">
          <span className="label">{override ? 'Reason (at least 20 characters, required)' : 'Remarks (optional)'}</span>
          <textarea className="input min-h-[90px]" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && (
          <div className="space-y-2">
            <p role="alert" className="text-sm font-semibold text-danger">
              {error.message}
            </p>
            <BlockerList blockers={error.blockers} compact />
          </div>
        )}
      </div>
    </Dialog>
  );
}
