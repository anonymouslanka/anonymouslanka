import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/**
 * Emits `sw.js` at build time: a hand-written, dependency-free service worker whose precache list is the
 * exact set of built files (so every deploy gets a new cache version and old caches are purged).
 *
 * Caching rules (privacy first):
 *  - Only same-origin requests are handled (app shell, static files, navigations).
 *  - API and image requests are never intercepted: offline case data is cached by the app itself
 *    (see lib/api.ts), so a service-worker problem can never break data loading.
 */
export function pwa(opts: { extraCore?: string[] } = {}): Plugin {
  const staticCore = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/offline.html',
    '/favicon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/apple-touch-icon.png',
    ...(opts.extraCore ?? []),
  ];

  return {
    name: 'detectivelanka-pwa',
    apply: 'build',
    generateBundle(_, bundle) {
      const built = Object.values(bundle)
        .map((f) => f.fileName)
        .filter((f) => /\.(js|css|svg|png|woff2?)$/.test(f))
        .map((f) => `/${f}`);
      const core = [...new Set([...staticCore, ...built])];
      const version = createHash('sha1').update(core.join('|') + SW_SOURCE).digest('hex').slice(0, 10);
      const source = SW_SOURCE.replace('__VERSION__', version).replace('__CORE__', JSON.stringify(core));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

const SW_SOURCE = String.raw`/* DetectiveLanka service worker — generated at build time. */
const VERSION = '__VERSION__';
const PRECACHE = 'dl-precache-' + VERSION;
const RUNTIME = 'dl-runtime-v1';
const CORE = __CORE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PRECACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PRECACHE, RUNTIME]);
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  // Never touch authenticated / key-bearing requests.
  if (request.headers.has('authorization') || request.headers.has('x-edit-key')) return;

  const url = new URL(request.url);

  // Cross-origin traffic (API, Cloudinary images) is left entirely to the browser.
  if (url.origin !== self.location.origin) return;

  // Page navigations: network first, fall back to the cached app shell, then the offline page.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = event.preloadResponse ? await event.preloadResponse : undefined;
        if (preload) return preload;
        return await withTimeout(fetch(request), 8000);
      } catch (err) {
        const cache = await caches.open(PRECACHE);
        return (await cache.match('/index.html', { ignoreVary: true })) || (await cache.match('/offline.html', { ignoreVary: true })) || Response.error();
      }
    })());
    return;
  }

  // Static assets: cache first (hashed filenames), then network.
  event.respondWith((async () => {
    // ignoreVary: module scripts send an Origin header the precache request did not.
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/splash/'))) {
      const cache = await caches.open(RUNTIME);
      cache.put(request, response.clone());
    }
    return response;
  })());
});
`;
