import * as device from '../../../frontend/lib/field/bundle';
import { bundleSeal, photoMismatch, validateBundle } from './field-evidence';

const NOW = new Date('2026-09-29T06:00:00Z');
const bundle = {
  clientId: '7d4c2b0e-3f7a-4a51-9d0a-2f1c6a9e8b11',
  deviceId: 'device-abc12345',
  parcelId: 'parcel-1',
  kind: 'POINT' as const,
  geometry: { type: 'Point' as const, coordinates: [78.6021345, 20.7456123] as [number, number] },
  accuracyM: 4.2,
  samples: 12,
  capturedAt: '2026-09-29T05:40:12.000Z',
  baseSyncedAt: null,
  note: 'Boundary stone found at the north-east corner',
  photoHashes: ['a'.repeat(64)],
};

describe('field evidence seal', () => {
  it('the device (WebCrypto, frontend/lib/field/bundle.ts) and the server compute the same SHA-256', async () => {
    const onDevice = await device.sealBundle(bundle);
    expect(onDevice).toMatch(/^[0-9a-f]{64}$/);
    expect(bundleSeal(bundle)).toBe(onDevice);
  });

  it('key order and extra local fields do not change the seal; any sealed value does', async () => {
    const reordered = Object.fromEntries(Object.entries(bundle).reverse());
    expect(bundleSeal({ ...reordered, status: 'QUEUED', bundleHash: 'x' })).toBe(bundleSeal(bundle));
    expect(bundleSeal({ ...bundle, accuracyM: 4.3 })).not.toBe(bundleSeal(bundle));
    expect(bundleSeal({ ...bundle, geometry: { type: 'Point', coordinates: [78.6021346, 20.7456123] } })).not.toBe(bundleSeal(bundle));
  });

  it('validates shape: a well-formed bundle has no problems', () => {
    expect(validateBundle({ ...bundle, bundleHash: bundleSeal(bundle) }, NOW)).toEqual([]);
  });

  it.each([
    ['a future capture time (device clock ahead by 1 h)', { capturedAt: '2026-09-29T07:00:00Z' }, /future/],
    ['an open polygon ring', { kind: 'POLYGON', geometry: { type: 'Polygon', coordinates: [[[78.6, 20.7], [78.61, 20.7], [78.61, 20.71], [78.6, 20.71]]] } }, /closed/],
    ['a ring with only two distinct corners', { kind: 'POLYGON', geometry: { type: 'Polygon', coordinates: [[[78.6, 20.7], [78.61, 20.7], [78.6, 20.7]]] } }, /at least 3 corners/],
    ['latitude out of range', { geometry: { type: 'Point', coordinates: [78.6, 95] } }, /Point/],
    ['zero accuracy', { accuracyM: 0 }, /accuracyM/],
    ['seven photos', { photoHashes: Array(7).fill('b'.repeat(64)) }, /photoHashes/],
    ['a missing seal', { bundleHash: undefined }, /bundleHash/],
  ])('refuses %s', (_label, patch, msg) => {
    const errs = validateBundle({ ...bundle, bundleHash: 'c'.repeat(64), ...patch }, NOW);
    expect(errs.join('; ')).toMatch(msg);
  });

  it('photo hashes must match the sealed list in order', () => {
    expect(photoMismatch(['a', 'b'], ['a', 'b'])).toBeNull();
    expect(photoMismatch(['a', 'b'], ['b', 'a'])).toMatch(/Photo 1/);
    expect(photoMismatch(['a'], [])).toMatch(/1 photo\(s\) but 0 arrived/);
  });
});

describe('GNSS helpers (device)', () => {
  it('weights fixes by 1/accuracy²: a 2 m fix dominates a 20 m fix; accuracy reported is the worst (20 m)', () => {
    const r = device.averageFixes([
      { lat: 20.0, lng: 78.0, accuracyM: 2, at: '' },
      { lat: 20.001, lng: 78.001, accuracyM: 20, at: '' },
    ]);
    // weights 0.25 and 0.0025 → 1% of the way to the poor fix
    expect(r.lat).toBeCloseTo(20.0000099, 6);
    expect(r).toMatchObject({ accuracyM: 20, samples: 2 });
  });

  it('a 100 m × 100 m square near 20.7°N has an area of about 1 ha', () => {
    const dLat = 100 / 111195;
    const dLng = 100 / (111195 * Math.cos((20.7 * Math.PI) / 180));
    const ring = device.closeRing([
      [78.6, 20.7],
      [78.6 + dLng, 20.7],
      [78.6 + dLng, 20.7 + dLat],
      [78.6, 20.7 + dLat],
    ]);
    expect(device.ringAreaSqm(ring)).toBeCloseTo(10000, -1);
  });

  it.each([
    [3, 'good'],
    [5, 'good'],
    [12, 'fair'],
    [30, 'poor'],
  ])('accuracy %d m is %s', (m, band) => expect(device.accuracyBand(m)).toBe(band));
});
