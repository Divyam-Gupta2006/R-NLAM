'use client';

import { CloudOff, CloudUpload, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { listBundles, QUEUE_EVENT, syncNow } from '@/lib/field/queue';
import { cn } from '@/lib/utils';

/** Online/offline state of the browser, kept current. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/** Counts of the local evidence queue, refreshed whenever it changes. */
export function useQueueCounts() {
  const [counts, setCounts] = useState({ waiting: 0, conflicts: 0, refused: 0 });
  const refresh = useCallback(async () => {
    try {
      const all = await listBundles();
      setCounts({
        waiting: all.filter((b) => b.status === 'QUEUED' || b.status === 'ERROR' || b.status === 'SYNCING').length,
        conflicts: all.filter((b) => b.status === 'CONFLICT').length,
        refused: all.filter((b) => b.status === 'REFUSED').length,
      });
    } catch {
      /* IndexedDB unavailable (private mode) */
    }
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener(QUEUE_EVENT, refresh);
    return () => window.removeEventListener(QUEUE_EVENT, refresh);
  }, [refresh]);
  return counts;
}

/**
 * Registers the field service worker (production builds only: dev chunks are
 * not content-hashed), syncs the queue when the connection returns, every
 * minute while open, and when Background Sync fires; and shows a sticky
 * connection + queue status bar.
 */
export function FieldRuntime() {
  const online = useOnline();
  const counts = useQueueCounts();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);

  const run = useCallback(
    async (manual = false) => {
      setSyncing(true);
      try {
        const r = await syncNow();
        if (r.needsLogin) toast('error', 'Sign in again to upload', 'Your evidence is safe on this device.');
        else if (r.synced || r.conflicts || r.refused) toast(r.refused ? 'error' : 'success', 'Field evidence synced', `${r.synced} accepted, ${r.conflicts} conflict(s), ${r.refused} refused`);
        else if (manual && r.offline) toast('error', 'Still offline', 'Evidence stays queued on this device.');
      } finally {
        setSyncing(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/field-sw.js', { scope: '/field/' })
        .then(async (reg) => {
          const bg = (reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync;
          if (bg) await bg.register('rnlam-evidence').catch(() => undefined);
        })
        .catch(() => undefined);
    }
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === 'rnlam-sync-now') void run();
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, [run]);

  useEffect(() => {
    if (!online) return;
    void run();
    const t = setInterval(() => void run(), 60_000);
    return () => clearInterval(t);
  }, [online, run]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'sticky top-0 z-20 -mx-4 -mt-4 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm font-semibold sm:-mx-6 sm:-mt-6 sm:px-6',
        online ? 'bg-bharat-soft text-bharat' : 'bg-warning-soft text-warning',
      )}
      data-tour="field-status"
    >
      {online ? <CloudUpload className="h-4 w-4" aria-hidden /> : <CloudOff className="h-4 w-4" aria-hidden />}
      <span>{online ? 'Online' : 'Offline: capture still works; evidence is sealed and queued on this device'}</span>
      <Link href="/field/sync" className="underline underline-offset-2">
        {counts.waiting} waiting to upload{counts.conflicts ? ` · ${counts.conflicts} conflict(s)` : ''}
        {counts.refused ? ` · ${counts.refused} refused` : ''}
      </Link>
      {online && counts.waiting > 0 && (
        <button className="ml-auto inline-flex items-center gap-1 rounded-md border border-current px-2 py-0.5 text-xs" onClick={() => void run(true)} disabled={syncing}>
          <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} aria-hidden /> Sync now
        </button>
      )}
    </div>
  );
}
