'use strict';

const url = new URL(self.location.href);
const BUILD = url.searchParams.get('v') || 'dev';
const CACHE_PREFIX = 'orten2-shell-';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles.css',
  './styles-base.css',
  './styles-game.css',
  './styles-responsive.css',
  './styles-atlas.css',
  './styles-map-themes.css',
  './data.js',
  './app.js',
  './app-core.js',
  './app-setup.js',
  './game-geometry.js',
  './app-map.js',
  './map-themes.js',
  './app-search.js',
  './app-ui.js',
  './app-online.js',
  './app-online-entry.js',
  './place-worker.js',
  './assets/logo.svg'
];

const NETWORK_ONLY = [
  '/data/world-places.json',
  '/data/world-meta.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (NETWORK_ONLY.some(suffix => requestUrl.pathname.endsWith(suffix))) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      const fresh = fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
