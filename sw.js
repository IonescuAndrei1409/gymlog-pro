/* =====================================================================
 * GymLog Pro — sw.js (service worker)
 * ---------------------------------------------------------------------
 * Face aplicația să meargă FĂRĂ INTERNET după prima deschidere de pe un link
 * https (sau localhost). Pe file:// (dublu-click) nu se folosește.
 *
 *   • la instalare: salvează în cache toate fișierele aplicației
 *   • Tailwind / Chart.js din CDN → servite din copiile locale js/vendor/
 *   • fișierele proprii: răspuns imediat din cache + actualizare în fundal
 *   • fontul Inter (Google Fonts): păstrat în cache după prima încărcare
 *
 * La o versiune nouă a aplicației, crește VERSION ca telefoanele să o preia.
 * ===================================================================== */
const VERSION = 'gymlog-v2';
const FONTS = 'gymlog-fonts';

const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/data.js',
  './js/storage.js',
  './js/stats.js',
  './js/charts.js',
  './js/app.js',
  './js/vendor/chart.umd.min.js',
  './js/vendor/tailwind-browser.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/qr.png',
];

/* Aceleași versiuni ca în index.html → servim copia locală, fără rețea. */
const CDN_TO_LOCAL = {
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.5/dist/index.global.js': './js/vendor/tailwind-browser.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.6.1/dist/chart.umd.min.js': './js/vendor/chart.umd.min.js',
};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* Răspunde din cache, apoi actualizează cache-ul din rețea (stale-while-revalidate). */
async function staleWhileRevalidate(request, cacheName, matchOptions) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, matchOptions);
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  const fresh = await network;
  return fresh || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // 1. Biblioteci din CDN → copia locală din cache
  const local = CDN_TO_LOCAL[url.href];
  if (local) {
    event.respondWith(caches.match(new URL(local, self.location).href).then((r) => r || fetch(request)));
    return;
  }

  // 2. Fișierele aplicației (aceeași origine)
  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      // orice pagină din aplicație → index.html (navigarea internă folosește #hash)
      event.respondWith(staleWhileRevalidate(new Request(new URL('./index.html', self.location).href), VERSION));
      return;
    }
    event.respondWith(staleWhileRevalidate(request, VERSION, { ignoreSearch: true }));
    return;
  }

  // 3. Fontul Inter (opțional — fără el se folosește fontul sistemului)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONTS));
  }
});
