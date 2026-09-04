/**
 * KUS WORLD ENGINE — Service Worker
 *
 * Cache-first strategy for the app shell and Babylon.js CDN assets.
 * Network-first for video assets.
 * Enables offline play and fast repeat visits.
 */

const CACHE_NAME = 'kus-world-engine-v1';
const RUNTIME_CACHE = 'kus-world-runtime-v1';

// App shell — these are cached on install
const APP_SHELL = [
  'index.html',
  'manifest.json',
  'public/icon-192.png',
  'public/icon-256.png',
  'public/icon-512.png',
];

// Babylon.js CDN prefix — all Babylon imports will be cached
const CDN_PREFIX = 'https://esm.sh/@babylonjs/core@7.0.0';

// Max age for CDN assets in cache (7 days in seconds)
const CDN_MAX_AGE = 7 * 24 * 60 * 60;

/* ── Install Event — Pre-cache the app shell ── */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).then(() => {
        console.log('[KUS SW] App shell cached');
      });
    }).catch((err) => {
      console.warn('[KUS SW] Shell caching failed (CDN may be unavailable):', err.message);
    })
  );
});

/* ── Activate Event — Clean old caches ── */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== RUNTIME_CACHE) {
            console.log(`[KUS SW] Clearing old cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

/* ── Fetch Event — Smart caching strategy ── */

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // App shell files — cache first, network fallback
  if (isAppShell(url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Babylon.js CDN assets — cache first with max age
  if (url.href.startsWith(CDN_PREFIX)) {
    event.respondWith(cacheFirst(event.request, CDN_MAX_AGE));
    return;
  }

  // Local assets (JS modules, etc.) — cache first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Everything else — network first, cache fallback
  event.respondWith(networkFirst(event.request));
});

/* ── Caching Strategies ── */

/**
 * Cache First: look in cache, fall back to network, update cache
 */
async function cacheFirst(request, maxAgeSeconds) {
  const cached = await caches.match(request);
  if (cached) {
    // Check if cache is stale
    if (maxAgeSeconds) {
      const cachedDate = cached.headers.get('date') || new Date().toUTCString();
      const age = (Date.now() - new Date(cachedDate).getTime()) / 1000;
      if (age > maxAgeSeconds) {
        // Stale — fetch in background
        fetchAndCache(request).catch(() => {});
      }
    }
    return cached;
  }

  // Not in cache — fetch and store
  try {
    return await fetchAndCache(request);
  } catch (err) {
    // Offline and not cached — return a fallback
    if (request.url.includes('.js')) {
      return new Response('', { status: 200, statusText: 'OK' });
    }
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network First: try network first, fall back to cache
 */
async function networkFirst(request) {
  try {
    const response = await fetchAndCache(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Offline fallback for video files
    if (request.headers.get('Accept')?.includes('video')) {
      return new Response('Video unavailable offline', {
        status: 503,
        statusText: 'Video offline',
      });
    }

    return new Response('Offline', { status: 503 });
  }
}

/**
 * Fetch a resource and store it in the runtime cache
 */
async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response.ok && response.type === 'basic' || response.type === 'cors') {
    const cache = await caches.open(RUNTIME_CACHE);
    // Don't cache video files (too large)
    if (!request.url.includes('.mp4') && !request.url.includes('.mov') && !request.url.includes('.avi')) {
      cache.put(request, response.clone());
    }
  }
  return response;
}

/**
 * Check if the URL matches the app shell
 */
function isAppShell(url) {
  const path = url.pathname;
  return APP_SHELL.some(shellPath => {
    const shellUrl = new URL(shellPath, self.location.origin);
    return path === shellUrl.pathname;
  });
}

/* ── Message Handling ── */

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});