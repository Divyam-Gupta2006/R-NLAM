/** Small planar helpers for building synthetic parcel polygons along an alignment. */

export type LngLat = [number, number];

const KM_PER_DEG_LAT = 110.574;
const kmPerDegLng = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

/** Point `km` along the straight line a → b. */
export function along(a: LngLat, b: LngLat, km: number): LngLat {
  const total = distanceKm(a, b);
  const t = km / total;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function distanceKm(a: LngLat, b: LngLat): number {
  const midLat = (a[1] + b[1]) / 2;
  const dx = (b[0] - a[0]) * kmPerDegLng(midLat);
  const dy = (b[1] - a[1]) * KM_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/** Offset a point by (east, north) kilometres. */
export function offset(p: LngLat, eastKm: number, northKm: number): LngLat {
  return [p[0] + eastKm / kmPerDegLng(p[1]), p[1] + northKm / KM_PER_DEG_LAT];
}

/**
 * Rectangle on the alignment a → b from `startKm` to `endKm`, extending
 * `leftKm` to the left and `rightKm` to the right of the centreline.
 * Returns a closed GeoJSON Polygon ring and its planar area in hectares.
 */
export function corridorRect(a: LngLat, b: LngLat, startKm: number, endKm: number, leftKm: number, rightKm: number) {
  const midLat = (a[1] + b[1]) / 2;
  const dx = (b[0] - a[0]) * kmPerDegLng(midLat);
  const dy = (b[1] - a[1]) * KM_PER_DEG_LAT;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // left normal
  const nx = -uy;
  const ny = ux;
  const p0 = along(a, b, startKm);
  const p1 = along(a, b, endKm);
  const ring: LngLat[] = [
    offset(p0, nx * leftKm, ny * leftKm),
    offset(p1, nx * leftKm, ny * leftKm),
    offset(p1, -nx * rightKm, -ny * rightKm),
    offset(p0, -nx * rightKm, -ny * rightKm),
  ];
  ring.push(ring[0]);
  const round = (v: number) => Math.round(v * 1e7) / 1e7;
  const areaHa = (endKm - startKm) * (leftKm + rightKm) * 100;
  return { geometry: { type: 'Polygon', coordinates: [ring.map(([x, y]) => [round(x), round(y)])] }, areaHa: Math.round(areaHa * 1000) / 1000 };
}

/** Axis-aligned-ish polygon around a centre, for constraint layers. */
export function blob(center: LngLat, radiusKm: number, points = 10, jitter = 0.18, seed = 1) {
  const ring: LngLat[] = [];
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < points; i++) {
    const ang = (2 * Math.PI * i) / points;
    const r = radiusKm * (1 - jitter / 2 + rnd() * jitter);
    ring.push(offset(center, Math.cos(ang) * r, Math.sin(ang) * r));
  }
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring.map(([x, y]) => [Math.round(x * 1e7) / 1e7, Math.round(y * 1e7) / 1e7])] };
}
