/* ============================================================
   sw.js — app-shell caching only. data/data.json and market
   data calls always go to network.
   ============================================================ */

const CACHE_NAME = 'finance-tracker-v2';
const SHELL_FILES = [
  './index.html', './stocks-ind.html', './stocks-us.html',
  './mutual-funds.html', './fixed-deposits.html', './epf.html',
  './manifest.json', './robots.txt', './css/theme.css',
  './js/icons.js', './js/theme.js', './js/store.js', './js/finance.js',
  './js/market.js', './js/valuation.js', './js/charts.js', './js/app.js',
  './js/dashboard.js', './js/stocklike.js', './js/mutualfunds.js',
  './js/fixeddeposits.js', './js/epf.js',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('data/data.json')) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
