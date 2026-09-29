'use client';

/**
 * The field device's evidence queue (IndexedDB), and the sync that drains
 * it. A bundle is sealed when it is queued and never edited afterwards; sync
 * only updates its local status. Nothing is deleted unless the officer
 * clears synced items.
 */
import { API_BASE_URL, tokenStore } from '@/lib/api/client';
import { EvidenceBundle, sealedPart } from './bundle';

export type LocalStatus = 'QUEUED' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'REFUSED' | 'ERROR';

export interface QueuedPhoto {
  name: string;
  type: string;
  blob: Blob;
  sha256: string;
}

export interface QueuedBundle extends EvidenceBundle {
  bundleHash: string;
  parcelNumber: string;
  photos: QueuedPhoto[];
  status: LocalStatus;
  queuedAt: string;
  attempts: number;
  lastAttemptAt: string | null;
  error: string | null;
  server: { id: string; status: string; distanceM: number | null; overlapIoU: number | null; capturedAreaSqm: number | null; conflictReason: string | null; receivedAt: string } | null;
}

const DB = 'rnlam-field';
const STORE = 'bundles';
export const QUEUE_EVENT = 'rnlam:field-queue';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'clientId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(r.result);
    };
    t.onerror = () => reject(t.error);
  });
}

const changed = () => window.dispatchEvent(new CustomEvent(QUEUE_EVENT));

export async function putBundle(b: QueuedBundle) {
  await tx('readwrite', (s) => s.put(b));
  changed();
}

export async function listBundles(): Promise<QueuedBundle[]> {
  const all = await tx<QueuedBundle[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedBundle[]>);
  return all.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export async function clearSynced() {
  const all = await listBundles();
  for (const b of all.filter((x) => x.status === 'SYNCED')) await tx('readwrite', (s) => s.delete(b.clientId));
  changed();
}

/** A stable id for this device (not personal data; lets the server tell devices apart). */
export function deviceId(): string {
  const KEY = 'rnlam.field.deviceId';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `web-${crypto.randomUUID().slice(0, 18)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

/** When this device last saw the server's evidence for a parcel (for conflict detection). */
export const lastSeen = {
  get: (parcelId: string): string | null => localStorage.getItem(`rnlam.field.lastSeen.${parcelId}`),
  set: (parcelId: string, iso: string) => localStorage.setItem(`rnlam.field.lastSeen.${parcelId}`, iso),
};

let running: Promise<SyncResult> | null = null;
export interface SyncResult {
  attempted: number;
  synced: number;
  conflicts: number;
  refused: number;
  failed: number;
  offline: boolean;
  needsLogin: boolean;
}

/** Upload every queued bundle once. Safe to call often; concurrent calls share one run. */
export function syncNow(): Promise<SyncResult> {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

async function doSync(): Promise<SyncResult> {
  const r: SyncResult = { attempted: 0, synced: 0, conflicts: 0, refused: 0, failed: 0, offline: !navigator.onLine, needsLogin: false };
  if (r.offline) return r;
  const token = tokenStore.get();
  const pending = (await listBundles()).filter((b) => b.status === 'QUEUED' || b.status === 'ERROR' || b.status === 'SYNCING');
  for (const b of pending) {
    r.attempted++;
    await putBundle({ ...b, status: 'SYNCING', attempts: b.attempts + 1, lastAttemptAt: new Date().toISOString() });
    const form = new FormData();
    form.append('bundle', JSON.stringify({ ...sealedPart(b), bundleHash: b.bundleHash }));
    for (const p of b.photos) form.append('photos', p.blob, p.name);
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/field/evidence`, { method: 'POST', body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch {
      await putBundle({ ...b, status: 'QUEUED', attempts: b.attempts + 1, lastAttemptAt: new Date().toISOString(), error: 'No connection to the server; will retry.' });
      r.offline = true;
      break;
    }
    const body = (await res.json().catch(() => ({}))) as { evidence?: QueuedBundle['server'] & { receivedAt: string }; message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join('; ') : body.message ?? res.statusText;
    const base = { ...b, attempts: b.attempts + 1, lastAttemptAt: new Date().toISOString() };
    if (res.ok && body.evidence) {
      const e = body.evidence;
      const server = { id: e.id, status: e.status, distanceM: e.distanceM, overlapIoU: e.overlapIoU, capturedAreaSqm: e.capturedAreaSqm, conflictReason: e.conflictReason, receivedAt: e.receivedAt };
      const conflict = e.status === 'CONFLICT';
      await putBundle({ ...base, status: conflict ? 'CONFLICT' : 'SYNCED', error: null, server });
      if (conflict) r.conflicts++;
      else r.synced++;
    } else if (res.status === 401) {
      await putBundle({ ...base, status: 'QUEUED', error: 'Sign in again to upload; the evidence is safe on this device.' });
      r.needsLogin = true;
      break;
    } else if (res.status === 422 || res.status === 409 || res.status === 400 || res.status === 404) {
      // The server looked at it and said no; retrying will not help. Keep it for the record.
      await putBundle({ ...base, status: 'REFUSED', error: message });
      r.refused++;
    } else {
      await putBundle({ ...base, status: 'ERROR', error: `Server error (${res.status}); will retry.` });
      r.failed++;
    }
  }
  return r;
}

/** Demo retakes: forget everything this device holds for the field app. */
export async function resetDevice() {
  await new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase(DB);
    r.onsuccess = r.onerror = r.onblocked = () => resolve();
  });
  for (const k of Object.keys(localStorage)) if (k.startsWith('rnlam.field.')) localStorage.removeItem(k);
  changed();
}
