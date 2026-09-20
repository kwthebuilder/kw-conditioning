/* Service worker: precache the app shell at install, then cache-first for
 * hashed assets and network-first for navigations. Hand-written; no
 * build step. Bump CACHE when the caching strategy changes; asset
 * changes are picked up because the shell is re-read on every install. */
const CACHE = 'acro-base-sc-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch('./index.html', { cache: 'no-cache' });
      const html = await res.text();
      const urls = new Set(SHELL);
      for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
        const u = m[1];
        if (!u || /^(https?:)?\/\//.test(u) || u.startsWith('data:')) continue;
        urls.add(u);
      }
      await cache.put('./index.html', new Response(html, { headers: res.headers }));
      await cache.put('./', new Response(html, { headers: res.headers }));
      await Promise.all(
        [...urls].filter((u) => u !== './' && u !== './index.html').map(async (u) => {
          try {
            const r = await fetch(u, { cache: 'no-cache' });
            if (r.ok) await cache.put(u, r);
          } catch {
            /* an optional asset failing to precache must not block install */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put('./index.html', fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match('./index.html');
          return cached || new Response('Offline and no cached app shell yet. Open the app once while online.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      const fresh = await fetch(req);
      if (fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    })(),
  );
});
