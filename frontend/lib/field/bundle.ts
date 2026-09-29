/**
 * Field evidence bundles, sealed on the device (6.10).
 *
 * The seal is SHA-256 over the canonical JSON of exactly these fields. The
 * server recomputes it (backend/src/common/canonical-json.ts is the same
 * algorithm) and refuses a bundle whose seal or photo hashes do not match.
 * No DOM or Next imports: the backend test suite imports this file to check
 * that device and server agree byte for byte.
 */

export type LngLat = [number, number];

export interface EvidenceGeometry {
  type: 'Point' | 'Polygon';
  coordinates: LngLat | LngLat[][];
}

/** What is sealed. Order of keys does not matter; canonical JSON sorts them. */
export interface EvidenceBundle {
  clientId: string;
  deviceId: string;
  parcelId: string;
  kind: 'POINT' | 'POLYGON';
  geometry: EvidenceGeometry;
  accuracyM: number;
  samples: number;
  capturedAt: string; // ISO-8601 UTC
  baseSyncedAt: string | null;
  note: string | null;
  photoHashes: string[];
}

export const BUNDLE_KEYS: Array<keyof EvidenceBundle> = ['clientId', 'deviceId', 'parcelId', 'kind', 'geometry', 'accuracyM', 'samples', 'capturedAt', 'baseSyncedAt', 'note', 'photoHashes'];

/** Deterministic JSON: keys sorted recursively, undefined dropped, Dates as ISO. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalise(value));
}

function normalise(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = normalise(v);
    }
    return out;
  }
  return value;
}

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Only the sealed fields, so extra local state never changes the hash. */
export function sealedPart(b: EvidenceBundle): EvidenceBundle {
  const out = {} as Record<string, unknown>;
  for (const k of BUNDLE_KEYS) out[k] = b[k];
  return out as unknown as EvidenceBundle;
}

export function sealBundle(b: EvidenceBundle): Promise<string> {
  return sha256Hex(canonicalJson(sealedPart(b)));
}

/* ----------------------------------------------------------- GNSS helpers */

export interface Fix {
  lat: number;
  lng: number;
  accuracyM: number;
  at: string;
}

/**
 * Average several fixes, weighting each by 1/accuracy². Reported accuracy is
 * the worst single fix: honest, never better than what was observed.
 */
export function averageFixes(fixes: Fix[]): { lng: number; lat: number; accuracyM: number; samples: number } {
  if (!fixes.length) throw new Error('No fixes');
  let wSum = 0;
  let lat = 0;
  let lng = 0;
  for (const f of fixes) {
    const w = 1 / Math.max(f.accuracyM, 0.5) ** 2;
    wSum += w;
    lat += f.lat * w;
    lng += f.lng * w;
  }
  const r7 = (x: number) => Math.round(x * 1e7) / 1e7;
  return { lat: r7(lat / wSum), lng: r7(lng / wSum), accuracyM: Math.round(Math.max(...fixes.map((f) => f.accuracyM)) * 10) / 10, samples: fixes.length };
}

/** Area of a small lng/lat ring in m² (local equirectangular projection; fine for a field plot). */
export function ringAreaSqm(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const R = 6371008.8;
  const xy = ring.map(([lng, lat]) => [R * (lng * Math.PI) / 180 * Math.cos(lat0), (R * lat * Math.PI) / 180]);
  let a = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

export function closeRing(points: LngLat[]): LngLat[] {
  if (!points.length) return points;
  const [f, l] = [points[0], points[points.length - 1]];
  return f[0] === l[0] && f[1] === l[1] ? points : [...points, f];
}

export type AccuracyBand = 'good' | 'fair' | 'poor';
export const accuracyBand = (m: number): AccuracyBand => (m <= 5 ? 'good' : m <= 15 ? 'fair' : 'poor');
