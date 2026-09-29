/* R-NLAM Field service worker (6.10).
 *
 * Scope /field/. Keeps the field app usable offline:
 *  - pages: network first, falling back to the last copy (query strings ignored);
 *  - Next.js build assets (/_next/static, content-hashed): cache first;
 *  - the API is never cached here; evidence waits in IndexedDB instead.
 * Background Sync (where the browser supports it) wakes open field pages to
 * upload their queue when the connection returns.
 */
const VERSION = 'rnlam-field-v1';
const SHELL = ['/field/assignments', '/field/capture', '/field/sync', '/field.webmanifest', '/icons/field-192.png', '/icons/field-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rnlam-field-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API and tiles: not ours to cache

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html') || url.pathname.startsWith('/field/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() => caches.match(url.pathname, { ignoreSearch: true }).then((hit) => hit || caches.match('/field/assignments'))),
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag !== 'rnlam-evidence') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) c.postMessage({ type: 'rnlam-sync-now' });
    }),
  );
});
