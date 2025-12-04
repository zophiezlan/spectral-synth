/**
 * Service Worker for Spectral Synthesizer PWA
 *
 * Provides offline functionality and caching for improved performance
 */

const VERSION = '1.1.0';
const CACHE_NAME = `spectral-synth-v${VERSION}`;

// Files to cache for offline use
const STATIC_ASSETS = [
    '/',
    '/index.html',
    // CSS files (split architecture)
    '/base.css',
    '/components.css',
    '/modals.css',
    '/responsive.css',
    '/manifest.json',
    // Configuration and constants
    '/config.js',
    '/constants.js',
    '/debug-logger.js',
    // Utility modules
    '/ui-utilities.js',
    '/visualization-utilities.js',
    '/storage-utilities.js',
    '/tutorial-manager.js',
    '/analysis-utilities.js',
    '/substance-utilities.js',
    '/performance-utilities.js',
    // Core modules
    '/frequency-mapper.js',
    '/audio-engine.js',
    '/visualizer.js',
    '/csv-importer.js',
    '/jcamp-importer.js',
    '/mp3-encoder.js',
    '/midi-output.js',
    // DOM and event handling
    '/dom-elements.js',
    '/event-handlers.js',
    '/handlers-import-export.js',
    '/handlers-midi.js',
    // State and feature modules
    '/app-state.js',
    '/modal-manager.js',
    '/filter-manager.js',
    '/keyboard-shortcuts.js',
    '/onboarding.js',
    '/playback-controller.js',
    '/theme-manager.js',
    // Main application
    '/app.js',
    '/sw-register.js'
];

// Large files that can be cached on demand
const DYNAMIC_CACHE = 'spectral-synth-dynamic-v1';
const LARGE_FILES = [
    '/ftir-library.json'
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...', VERSION);

    event.waitUntil((async () => {
        try {
            const cache = await caches.open(CACHE_NAME);
            console.log('[Service Worker] Caching static assets');
            await cache.addAll(STATIC_ASSETS);
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

    // Handle large files (FTIR library) with network-first strategy
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
