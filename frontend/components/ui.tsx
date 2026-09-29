'use client';

import { AlertTriangle, ArrowDownUp, FlaskConical, Inbox, Loader2, RefreshCw, Search, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ApiError, Blocker } from '@/lib/api/client';
import { humanize } from '@/lib/format';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ layout */

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-bold uppercase tracking-wider text-saffron">{eyebrow}</p>}
        <h1 className="text-xl font-bold text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className, bodyClassName }: { title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn('panel', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-bold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone = 'default', icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' | 'accent'; icon?: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink-muted">{label}</p>
        {icon && <span className="text-ink-muted">{icon}</span>}
      </div>
      <p
        className={cn(
          'tabular mt-1 text-2xl font-bold',
          tone === 'good' && 'text-bharat',
          tone === 'warn' && 'text-warning',
          tone === 'bad' && 'text-danger',
          tone === 'accent' && 'text-saffron',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ badges */

const TONES: Record<string, string> = {
  good: 'bg-bharat-soft text-bharat border-bharat/25',
  warn: 'bg-warning-soft text-warning border-warning/25',
  bad: 'bg-danger-soft text-danger border-danger/25',
  info: 'bg-info-soft text-info border-info/25',
  accent: 'bg-saffron-soft text-saffron border-saffron/30',
  muted: 'bg-surface text-ink-muted border-line',
};

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  // parcel stages
  IDENTIFIED: 'muted',
  PRELIM_NOTIFIED: 'info',
  DECLARED: 'info',
  AWARDED: 'accent',
  COMPENSATION_PAID: 'good',
  POSSESSION_TAKEN: 'good',
  HANDED_OVER: 'good',
  LAPSED: 'bad',
  WITHDRAWN: 'muted',
  // money
  ASSESSED: 'muted',
  APPROVED: 'info',
  INITIATED: 'accent',
  PAID: 'good',
  FAILED: 'bad',
  DISPUTED: 'bad',
  ON_HOLD: 'warn',
  SUCCESS: 'good',
  // cases
  SUBMITTED: 'info',
  UNDER_REVIEW: 'info',
  HEARING_SCHEDULED: 'accent',
  RESOLVED: 'good',
  REJECTED: 'muted',
  ESCALATED: 'bad',
  SCHEDULED: 'info',
  HELD: 'good',
  ADJOURNED: 'warn',
  CANCELLED: 'muted',
  ASSIGNED: 'warn',
  DELIVERED: 'good',
  COMPLETED: 'good',
  BENEFIT_DELIVERED: 'good',
  BENEFIT_ASSIGNED: 'warn',
  ELIGIBLE: 'info',
  HANDED_TO_PIA: 'good',
  ACTIVE: 'good',
  DRAFT: 'muted',
  ON_TRACK: 'good',
  BREACHED: 'bad',
  CRITICAL: 'bad',
  WARNING: 'warn',
  INFO: 'info',
  SYNTHETIC: 'warn',
  LIVE: 'good',
  NOT_CONNECTED: 'muted',
};

export function Badge({ children, tone = 'muted', className, title }: { children: React.ReactNode; tone?: keyof typeof TONES; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold', TONES[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return <span className="text-ink-muted">—</span>;
  return (
    <Badge tone={STATUS_TONE[status] ?? 'muted'} className={className}>
      {humanize(status)}
    </Badge>
  );
}

/** Marks data that is synthetic (demo), as the brief requires. */
export function SyntheticTag({ className }: { className?: string }) {
  return (
    <Badge tone="warn" className={className} title="Demonstration data. Not a real government record.">
      <FlaskConical className="h-3 w-3" aria-hidden /> Synthetic
    </Badge>
  );
}

/* ------------------------------------------------------------------ states */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden />;
}

export function LoadingBlock({ label = 'Loading…', rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg bg-line/60" style={{ opacity: 1 - i * 0.15 }} />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({ title, detail, action, icon }: { title: string; detail?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <span className="text-ink-muted">{icon ?? <Inbox className="h-7 w-7" aria-hidden />}</span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {detail && <p className="max-w-md text-xs text-ink-muted">{detail}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError | Error; onRetry?: () => void }) {
  const status = 'status' in error ? (error as ApiError).status : undefined;
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft/50 px-6 py-8 text-center">
      <AlertTriangle className="h-6 w-6 text-danger" aria-hidden />
      <p className="text-sm font-semibold text-danger">{status === 403 ? 'You do not have access to this' : status === 0 ? 'Server unreachable' : 'Could not load this'}</p>
      <p className="max-w-lg text-xs text-ink-muted">{error.message}</p>
      {onRetry && (
        <button className="btn-ghost mt-1" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      )}
    </div>
  );
}

/**
 * Render loading, error, empty or content from one API state. Keeps stale data
 * on screen while refreshing, so reloads do not flash.
 */
export function DataState<T>({
  state,
  empty,
  isEmpty,
  children,
  rows,
}: {
  state: { data: T | undefined; error: ApiError | undefined; loading: boolean; reload: () => void };
  empty?: React.ReactNode;
  isEmpty?: (d: T) => boolean;
  children: (data: T) => React.ReactNode;
  rows?: number;
}) {
  if (state.error && state.data === undefined) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.data === undefined) return <LoadingBlock rows={rows} />;
  const blank = isEmpty ? isEmpty(state.data) : Array.isArray(state.data) && state.data.length === 0;
  if (blank) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return <>{children(state.data)}</>;
}

/* ------------------------------------------------------------------ blockers */

export function BlockerList({ blockers, compact }: { blockers: Blocker[]; compact?: boolean }) {
  if (!blockers.length) return null;
  return (
    <ul className="space-y-2">
      {blockers.map((b) => (
        <li key={b.code} className={cn('rounded-lg border border-danger/25 bg-danger-soft/40', compact ? 'p-2' : 'p-3')}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="bad">{b.code.replace(/_/g, ' ')}</Badge>
            {b.citation && <span className="text-[11px] font-semibold text-ink-muted">{b.citation}</span>}
            {!b.overridable && <span className="text-[11px] text-ink-muted">· cannot be overridden</span>}
          </div>
          <p className="mt-1 text-sm text-ink">{b.message}</p>
          {b.unblockedBy?.length ? <p className="mt-1 text-xs text-ink-muted">Unblocked by: {b.unblockedBy.map(humanize).join(', ')}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ dialog */

export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[900] flex items-end justify-center bg-navy/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={cn('panel max-h-[92vh] w-full overflow-y-auto outline-none', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-surface hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ table */

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

/**
 * Accessible table with client-side search and sort. `searchText` decides what
 * the search box matches. Server paging stays with the caller.
 */
export function Table<T>({
  rows,
  columns,
  rowKey,
  searchText,
  searchPlaceholder = 'Search…',
  onRowClick,
  toolbar,
  empty,
  pageSize = 25,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;
  empty?: React.ReactNode;
  pageSize?: number;
  caption?: string;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = needle && searchText ? rows.filter((r) => searchText(r).toLowerCase().includes(needle)) : rows;
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        const sv = col.sortValue;
        out = [...out].sort((a, b) => {
          const x = sv(a);
          const y = sv(b);
          return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
        });
      }
    }
    return out;
  }, [rows, q, sort, columns, searchText]);

  useEffect(() => setPage(0), [q, rows]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div className="space-y-3">
      {(searchText || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchText && (
            <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
              <span className="sr-only">{searchPlaceholder}</span>
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-muted" aria-hidden />
              <input className="input pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} />
            </label>
          )}
          {toolbar}
          <span className="ml-auto text-xs text-ink-muted">{filtered.length.toLocaleString('en-IN')} rows</span>
        </div>
      )}
      {filtered.length === 0 ? (
        empty ?? <EmptyState title={q ? 'No matches' : 'No records'} detail={q ? `Nothing matches “${q}”.` : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[640px] text-sm">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead className="bg-surface text-left text-xs font-semibold text-ink-muted">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={cn('px-3 py-2', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
                    {c.sortValue ? (
                      <button
                        className="inline-flex items-center gap-1 hover:text-ink"
                        onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}
                        aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                      >
                        {c.header} <ArrowDownUp className="h-3 w-3" aria-hidden />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-panel">
              {visible.map((r) => (
                <tr
                  key={rowKey(r)}
                  className={cn(onRowClick && 'cursor-pointer hover:bg-saffron-soft/40 focus-within:bg-saffron-soft/40')}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(r) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-3 py-2 align-top', c.align === 'right' && 'text-right tabular', c.align === 'center' && 'text-center', c.className)}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-ink-muted">
          <button className="btn-ghost px-2 py-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page + 1} of {pages}
          </span>
          <button className="btn-ghost px-2 py-1" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ tabs */

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: Array<{ key: K; label: React.ReactNode }>; value: K; onChange: (k: K) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-semibold', value === t.key ? 'border-saffron text-ink' : 'border-transparent text-ink-muted hover:text-ink')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; className?: string }) {
  return (
    <label className={cn('text-xs', className)}>
      <span className="sr-only">{label}</span>
      <select aria-label={label} className="input py-1.5" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A proportion bar with an accessible label. */
export function Progress({ value, tone = 'good', label }: { value: number; tone?: 'good' | 'accent' | 'bad'; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn('h-full rounded-full', tone === 'good' && 'bg-bharat', tone === 'accent' && 'bg-saffron', tone === 'bad' && 'bg-danger')} style={{ width: `${v}%` }} />
      </div>
      <span className="tabular w-11 text-right text-xs text-ink-muted">{v.toFixed(0)}%</span>
    </div>
  );
}
