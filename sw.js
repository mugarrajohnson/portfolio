/* ============================================================
   sw.js — service worker for johnsonmugarra.com

   Strategy
     navigation     network first, cached shell as the offline fallback
     css and js     network first, cache as the offline fallback
     everything     stale-while-revalidate
     else same-origin

   Code is network-first on purpose. Filenames here carry no content
   hash, so serving index.html fresh while serving styles.css or
   script.js from cache would pair new markup with old behaviour. They
   are small enough (~70kB together) that fetching them is cheap, and
   the cache still covers the offline case.

   The old build was cache-first with no revalidation at all, so a
   returning visitor kept the previous deploy until CACHE_NAME changed.
   ============================================================ */
'use strict';

const CACHE_NAME = 'jm-portfolio-v7';

const PRECACHE_URLS = [
  './',
  './index.html',
  './404.html',
  './assets/styles.css',
  './script.js',
  './charts.js',
  './manifest.json',
  './img/vanilla-workshop-800.webp',
  './img/vanilla-workshop-1600.webp',
  './img/favicon-32x32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      /* addAll is all-or-nothing; one 404 would abandon the whole install. */
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })()
  );
});

/** Cache only complete, same-origin, basic responses. */
function isCacheable(response) {
  return response && response.ok && response.status === 200 && response.type === 'basic';
}

async function handleNavigation(event) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const preloaded = await event.preloadResponse;
    const response = preloaded || (await fetch(event.request));
    if (isCacheable(response)) cache.put(event.request, response.clone());
    return response;
  } catch {
    return (await cache.match(event.request)) || (await cache.match('./index.html')) || Response.error();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (isCacheable(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  /* Serve the cached copy at once; the refresh lands in the next visit. */
  if (cached) {
    network.catch(() => {});
    return cached;
  }
  return (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  /* Third-party requests (fonts, analytics, D3) go straight to the network. */
  if (url.origin !== self.location.origin) return;

  if (/\.(?:css|js)$/.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
