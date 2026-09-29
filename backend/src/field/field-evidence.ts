import * as crypto from 'crypto';
import { canonicalJson } from '../common/canonical-json';

/**
 * Server side of the device seal (mirrors frontend/lib/field/bundle.ts).
 * Pure functions: validation and hashing, no I/O.
 */

export const BUNDLE_KEYS = ['clientId', 'deviceId', 'parcelId', 'kind', 'geometry', 'accuracyM', 'samples', 'capturedAt', 'baseSyncedAt', 'note', 'photoHashes', 'positionSource'] as const;

export interface EvidenceBundle {
  clientId: string;
  deviceId: string;
  parcelId: string;
  kind: 'POINT' | 'POLYGON';
  geometry: { type: 'Point'; coordinates: [number, number] } | { type: 'Polygon'; coordinates: Array<Array<[number, number]>> };
  accuracyM: number;
  samples: number;
  capturedAt: string;
  baseSyncedAt: string | null;
  note: string | null;
  photoHashes: string[];
  positionSource: 'DEVICE_GNSS' | 'SIMULATED';
}

export function sealedPart(b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of BUNDLE_KEYS) out[k] = b[k] === undefined ? null : b[k];
  return out;
}

export function bundleSeal(b: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(canonicalJson(sealedPart(b))).digest('hex');
}

const UUIDISH = /^[0-9a-f-]{16,64}$/i;
const HEX64 = /^[0-9a-f]{64}$/;
const isPos = (p: unknown): p is [number, number] =>
  Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === 'number' && Number.isFinite(x)) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;

/** Returns a list of problems; empty means the bundle is well-formed. */
export function validateBundle(raw: unknown, now: Date): string[] {
  const errs: string[] = [];
  if (!raw || typeof raw !== 'object') return ['bundle must be a JSON object'];
  const b = raw as Record<string, unknown>;
  if (typeof b.clientId !== 'string' || !UUIDISH.test(b.clientId)) errs.push('clientId must be a UUID generated on the device');
  if (typeof b.deviceId !== 'string' || b.deviceId.length < 8 || b.deviceId.length > 64) errs.push('deviceId is required');
  if (typeof b.parcelId !== 'string') errs.push('parcelId is required');
  if (b.kind !== 'POINT' && b.kind !== 'POLYGON') errs.push('kind must be POINT or POLYGON');
  const g = b.geometry as { type?: unknown; coordinates?: unknown } | undefined;
  if (!g || typeof g !== 'object') errs.push('geometry is required');
  else if (b.kind === 'POINT') {
    if (g.type !== 'Point' || !isPos(g.coordinates)) errs.push('geometry must be a GeoJSON Point [lng, lat]');
  } else if (b.kind === 'POLYGON') {
    const ring = Array.isArray(g.coordinates) ? (g.coordinates as unknown[])[0] : null;
    if (g.type !== 'Polygon' || !Array.isArray(ring) || ring.length < 4 || !ring.every(isPos)) errs.push('geometry must be a GeoJSON Polygon with at least 3 corners');
    else {
      const [f, l] = [ring[0] as number[], ring[ring.length - 1] as number[]];
      if (f[0] !== l[0] || f[1] !== l[1]) errs.push('polygon ring must be closed');
    }
  }
  if (typeof b.accuracyM !== 'number' || !(b.accuracyM > 0) || b.accuracyM > 1000) errs.push('accuracyM must be between 0 and 1000 metres');
  if (typeof b.samples !== 'number' || !Number.isInteger(b.samples) || b.samples < 1 || b.samples > 10000) errs.push('samples must be a positive integer');
  const at = typeof b.capturedAt === 'string' ? new Date(b.capturedAt) : null;
  if (!at || Number.isNaN(at.getTime())) errs.push('capturedAt must be an ISO date-time');
  else if (at.getTime() > now.getTime() + 5 * 60_000) errs.push('capturedAt is in the future (check the device clock)');
  if (b.baseSyncedAt !== null && b.baseSyncedAt !== undefined && (typeof b.baseSyncedAt !== 'string' || Number.isNaN(new Date(b.baseSyncedAt).getTime()))) errs.push('baseSyncedAt must be an ISO date-time or null');
  if (b.note !== null && b.note !== undefined && (typeof b.note !== 'string' || b.note.length > 1000)) errs.push('note must be text up to 1000 characters');
  if (!Array.isArray(b.photoHashes) || b.photoHashes.length > 6 || !b.photoHashes.every((h) => typeof h === 'string' && HEX64.test(h))) errs.push('photoHashes must list up to 6 SHA-256 hex digests');
  if (b.positionSource !== 'DEVICE_GNSS' && b.positionSource !== 'SIMULATED') errs.push('positionSource must be DEVICE_GNSS or SIMULATED');
  if (typeof b.bundleHash !== 'string' || !HEX64.test(b.bundleHash)) errs.push('bundleHash (the device seal) is required');
  return errs;
}

/** Photo hashes must match the sealed list exactly, in order. */
export function photoMismatch(sealed: string[], received: string[]): string | null {
  if (sealed.length !== received.length) return `The bundle lists ${sealed.length} photo(s) but ${received.length} arrived`;
  for (let i = 0; i < sealed.length; i++) if (sealed[i] !== received[i]) return `Photo ${i + 1} does not match its hash in the sealed bundle`;
  return null;
}
