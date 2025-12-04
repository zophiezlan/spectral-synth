/**
 * Service Worker Registration
 *
 * Registers the service worker for PWA functionality.
 * Separated from index.html to comply with CSP (no inline scripts).
 */

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
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
