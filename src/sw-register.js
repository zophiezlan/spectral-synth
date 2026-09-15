/**
 * Service Worker Registration
 *
 * Registers the service worker for PWA functionality.
 * Separated from index.html to comply with CSP (no inline scripts).
 */

import { Logger } from './core/logger.js';

// Register service worker for PWA functionality. Skipped on localhost so the
// dev server always serves fresh files instead of the SW's cached copies.
const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
if ('serviceWorker' in navigator && !isLocalDev) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                Logger.log('✓ Service Worker registered:', registration.scope);

                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 60000); // Check every minute
            })
            .catch((error) => {
                Logger.error('Service Worker registration failed:', error);
            });
    });
}
