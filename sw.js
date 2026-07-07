/* ═══════════════════════════════════════════════════
   sw.js — Service Worker for Johnson Mugarra Portfolio
   Strategy: cache-first for assets, network-first for HTML
   ═══════════════════════════════════════════════════ */
'use strict';

const CACHE_NAME = 'jm-portfolio-v5';

const PRECACHE_URLS = [
  './',
  './index.html',
  './script.js',
  './404.html',
  './manifest.json',
  './img/vanilla-workshop-800.webp',
  './img/vanilla-workshop-1600.webp',
  './img/favicon-32x32.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(PRECACHE_URLS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);

  /* Network-first for navigation (HTML pages) */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function (res) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(event.request, clone); });
          return res;
        })
        .catch(function () {
          return caches.match('./index.html');
        })
    );
    return;
  }

  /* Cache-first for same-origin static assets */
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        return fetch(event.request).then(function (res) {
          if (res.ok) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(event.request, clone); });
          }
          return res;
        });
      })
    );
  }
});
