/**
 * Debug Logger Module
 *
 * Purpose: Provides conditional logging that can be disabled in production
 *
 * Dependencies: None
 *
 * Exports:
 * - Logger object with log, warn, error, info methods
 *
 * Usage:
 * Logger.log('Debug message'); // Only shows if DEBUG enabled
 * Logger.error('Error message'); // Always shows
 */

const Logger = {
    // Set to false in production, true in development
    // Can be controlled via URL parameter: ?debug=true
    DEBUG: false,

    /**
     * Initialize logger with settings
     * Checks URL parameters for debug flag
     */
    init() {
        // Check URL parameter for debug mode
        if (typeof window !== 'undefined' && window.location) {
            const params = new URLSearchParams(window.location.search);
            this.DEBUG = params.get('debug') === 'true';
        }

        if (this.DEBUG) {
            this.log('Debug mode enabled');
        }
    },

    /**
     * Log debug message (only in debug mode)
     * @param {...any} args - Arguments to log
     */
    log(...args) {
        if (this.DEBUG) {
            console.log(...args);
        }
    },

    /**
     * Log info message (only in debug mode)
     * @param {...any} args - Arguments to log
     */
    info(...args) {
        if (this.DEBUG) {
            console.info(...args);
        }
    },

    /**
     * Log warning message (only in debug mode)
     * @param {...any} args - Arguments to log
     */
    warn(...args) {
        if (this.DEBUG) {
            console.warn(...args);
        }
    },

    /**
     * Log error message (always logs, even in production)
     * @param {...any} args - Arguments to log
     */
    error(...args) {
        console.error(...args);
    },

    /**
     * Enable debug mode
     */
    enable() {
        this.DEBUG = true;
        console.log('Debug mode enabled');
    },

    /**
     * Disable debug mode
     */
    disable() {
        this.DEBUG = false;
    }
};

// Initialize on load
if (typeof window !== 'undefined') {
    Logger.init();
}
