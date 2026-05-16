/**
 * Service Worker for Spectral Synthesizer PWA
 *
 * Provides offline functionality and caching for improved performance
 */

const VERSION = '1.2.0';
const CACHE_NAME = `spectral-synth-v${VERSION}`;

// Minimal pre-cache list: only assets that exist in BOTH dev (source layout) and
// prod (bundled dist/ layout). Everything else (individual modules in dev, the
// hashed bundle in prod) is picked up by the runtime cache-first handler below.
// Keeping this list tight means SW install can't be broken by a stale path.
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/sw-register.js'
];

// Large files that can be cached on demand
const DYNAMIC_CACHE = `spectral-synth-dynamic-v${VERSION}`;
const LARGE_FILES = [
    '/ftir-library.json'
];

// Library chunks (lazy loading). Production: dist/library/ served as /library/.
// Dev: path 404s; loader falls back to the monolith.
const LIBRARY_PATH = '/library/';
const LIBRARY_INDEX = `${LIBRARY_PATH}index.json`;

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...', VERSION);

    event.waitUntil((async () => {
        try {
            const cache = await caches.open(CACHE_NAME);
            console.log('[Service Worker] Caching static assets');

            // Use allSettled so one bad path doesn't abort the whole install.
            // cache.addAll() is atomic — a single 404 rejects everything.
            const results = await Promise.allSettled(
                STATIC_ASSETS.map((asset) => cache.add(asset))
            );
            const failed = results
                .map((r, i) => (r.status === 'rejected' ? STATIC_ASSETS[i] : null))
                .filter(Boolean);
            if (failed.length) {
                console.warn('[Service Worker] Skipped missing assets:', failed);
            }

            // Library index is optional (only exists after `npm run build`).
            try {
                await cache.add(LIBRARY_INDEX);
                console.log('[Service Worker] Library index cached');
            } catch {
                console.log('[Service Worker] Library index not available — using runtime caching');
            }

            console.log('[Service Worker] Installation complete');
            await self.skipWaiting(); // Activate immediately
        } catch (error) {
            console.error('[Service Worker] Installation failed:', error);
        }
    })());
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...', VERSION);

    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames
                .filter((cacheName) => {
                    // Remove old caches
                    return cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE;
                })
                .map((cacheName) => {
                    console.log('[Service Worker] Deleting old cache:', cacheName);
                    return caches.delete(cacheName);
                })
        );
        console.log('[Service Worker] Activation complete');
        await self.clients.claim(); // Take control immediately
    })());
});

/**
 * Fetch event - serve from cache with network fallback
 * Strategy: Cache first, then network
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle same-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Handle library files (lazy loading) with cache-first strategy
    if (url.pathname.startsWith(LIBRARY_PATH)) {
        event.respondWith((async () => {
            const cache = await caches.open(DYNAMIC_CACHE);

            // Try cache first
            const cachedResponse = await cache.match(request);
            if (cachedResponse) {
                console.log(`[Service Worker] Serving ${url.pathname} from cache`);
                return cachedResponse;
            }

            // Fetch from network and cache
            try {
                const response = await fetch(request);
                if (response.ok) {
                    console.log(`[Service Worker] Caching ${url.pathname}`);
                    cache.put(request, response.clone());
                }
                return response;
            } catch (error) {
                console.error(`[Service Worker] Failed to fetch ${url.pathname}:`, error);
                throw error;
            }
        })());
        return;
    }

    // Handle large files (FTIR library monolithic) with network-first strategy
    if (LARGE_FILES.some(file => url.pathname.includes(file))) {
        event.respondWith((async () => {
            const cache = await caches.open(DYNAMIC_CACHE);
            try {
                const response = await fetch(request);
                // Cache successful responses
                if (response.ok) {
                    cache.put(request, response.clone());
                }
                return response;
            } catch (error) {
                // Fallback to cache if network fails
                return cache.match(request);
            }
        })());
        return;
    }

    // Handle static assets with cache-first strategy
    event.respondWith((async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            // Return cached version
            return cachedResponse;
        }

        try {
            // Fetch from network
            const response = await fetch(request);

            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
            }

            // Cache successful responses
            const responseToCache = response.clone();
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, responseToCache);

            return response;
        } catch (error) {
            console.error('[Service Worker] Fetch failed:', error);
            // Could return a custom offline page here
            throw error;
        }
    })());
});

/**
 * Message event - handle messages from the main app
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        return caches.delete(cacheName);
                    })
                );
            })
        );
    }
});
