/* Ribbon — service worker
   Caches the app shell so the editor keeps working offline once installed.
   Bump CACHE_VERSION whenever a shipped asset changes. */

const CACHE_VERSION = 'ribbon-v14';
const SCOPE_URL = new URL(self.registration.scope);

const APP_SHELL = [
  '',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/dom.js',
  'js/toast.js',
  'js/storage.js',
  'js/editor-ops.js',
  'js/press.js',
  'js/toolbar.js',
  'js/notes.js',
  'js/export.js',
  'js/plugins.js',
  'js/viewport.js',
  'js/highlight.js',
  'js/settings.js',
  'js/vendor/marked.min.js',
  'js/vendor/purify.min.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/favicon-32.png',
  'icons/favicon-64.png',
].map((p) => new URL(p, SCOPE_URL).toString());

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let Google Fonts etc. go straight to network

  // Navigations: try network first so updates show up, fall back to cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(new URL('index.html', SCOPE_URL).toString()))
    );
    return;
  }

  // Static assets: cache-first, refresh in background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
