// Service worker: keeps the app shell available offline.
// API responses are never cached here (they may contain personal data); offline visits live in the
// encrypted outbox in IndexedDB instead.
const VERSION = 'vs-2026-10-22-1';
const SHELL = [
  '/', '/index.html', '/styles.css', '/manifest.webmanifest',
  '/app/main.js', '/app/api.js', '/app/i18n.js', '/app/ui.js', '/app/field.js', '/app/visit.js', '/app/dentist.js', '/app/admin.js', '/app/report.js', '/app/photo.js',
  '/shared/clinical.js', '/vendor/preact-htm.js', '/vendor/qrcode.js',
  '/icons/icon.svg', '/icons/icon-192.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/v/'))) return;
  // Fonts: cache-first.
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSION + '-fonts').then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // App shell: network first (so updates arrive), cache fallback offline.
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request);
      if (res.ok) (await caches.open(VERSION)).put(e.request, res.clone());
      return res;
    } catch {
      const hit = await caches.match(e.request);
      if (hit) return hit;
      if (e.request.mode === 'navigate') return caches.match('/index.html');
      throw new Error('offline');
    }
  })());
});
