/**
 * Performance Utilities Module
 *
 * Purpose: Provides performance optimization utilities for smooth UX
 *
 * Dependencies:
 * - None
 *
 * Exports:
 * - debounce(func, wait, immediate) - Delays function execution
 * - throttle(func, limit) - Limits function call frequency
 * - rafThrottle(callback) - Throttles to animation frame rate
 * - MicroInteractions object - Visual feedback utilities
 *
 * Usage:
 * ```javascript
 * // Debounce search input
 * const debouncedSearch = debounce(handleSearch, 300);
 * searchInput.addEventListener('input', debouncedSearch);
 *
 * // Throttle scroll handler
 * const throttledScroll = throttle(handleScroll, 100);
 * window.addEventListener('scroll', throttledScroll);
 *
 * // Add pulse effect to button
 * MicroInteractions.addPulseEffect(button);
 * ```
 *
 * Performance Patterns:
 * - Debounce: Wait until user stops typing before processing
 * - Throttle: Limit to max one call per time period
 * - RAF Throttle: Sync with browser repaint for smooth animations
 *
 * Best Practices:
 * - Use debounce for inputs (search, resize)
 * - Use throttle for continuous events (scroll, mousemove)
 * - Use rafThrottle for animations and visual updates
 */

/**
 * Debounce function - delays execution until after wait milliseconds have elapsed
 * since the last time it was invoked.
 *
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @param {boolean} immediate - If true, trigger on leading edge instead of trailing
 * @returns {Function} Debounced function
 */
function debounce(func, wait, immediate = false) {
    let timeout;

    return function executedFunction(...args) {
        const context = this;

        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };

        const callNow = immediate && !timeout;

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);

        if (callNow) func.apply(context, args);
    };
}

/**
 * Throttle function - ensures function is called at most once per specified time period
 *
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds between calls
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    let lastResult;

    return function executedFunction(...args) {
        const context = this;

        if (!inThrottle) {
            lastResult = func.apply(context, args);
            inThrottle = true;

            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }

        return lastResult;
    };
}

/**
 * RequestAnimationFrame utility with automatic cleanup
 */
const RAFManager = {
    activeRAFs: new Map(),

    /**
     * Start a RAF loop with automatic ID management
     * @param {string} id - Unique identifier for this RAF loop
     * @param {Function} callback - Function to call on each frame
     */
    start(id, callback) {
        // Stop existing RAF with same ID
        this.stop(id);

        const loop = () => {
            callback();
            const rafId = requestAnimationFrame(loop);
            this.activeRAFs.set(id, rafId);
        };

        loop();
    },

    /**
     * Stop a RAF loop
     * @param {string} id - ID of the RAF loop to stop
     */
    stop(id) {
        const rafId = this.activeRAFs.get(id);
        if (rafId !== undefined) {
            cancelAnimationFrame(rafId);
            this.activeRAFs.delete(id);
        }
    },

    /**
     * Stop all active RAF loops
     */
    stopAll() {
        this.activeRAFs.forEach(rafId => cancelAnimationFrame(rafId));
        this.activeRAFs.clear();
    }
};

/**
 * Memory management utilities
 */
const MemoryManager = {
    /**
     * Clear data from memory with null assignment
     * @param {Object} obj - Object to clear
     * @param {Array<string>} keys - Keys to clear (if not provided, clears all)
     */
    clearObject(obj, keys = null) {
        if (!obj) return;

        const keysToClean = keys || Object.keys(obj);
        keysToClean.forEach(key => {
            if (obj[key] instanceof Array) {
                obj[key].length = 0;
            } else {
                obj[key] = null;
            }
        });
    },

    /**
     * Revoke object URLs to free memory
     * @param {string|Array<string>} urls - URL or array of URLs to revoke
     */
    revokeObjectURLs(urls) {
        const urlArray = Array.isArray(urls) ? urls : [urls];
        urlArray.forEach(url => {
            if (url && typeof url === 'string') {
                URL.revokeObjectURL(url);
            }
        });
    }
};

/**
 * Lazy loading utility for heavy operations
 */
const LazyLoader = {
    cache: new Map(),

    /**
     * Load and cache result of expensive operation
     * @param {string} key - Cache key
     * @param {Function} loader - Async function that loads the data
     * @returns {Promise} Cached or freshly loaded data
     */
    async load(key, loader) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        const result = await loader();
        this.cache.set(key, result);
        return result;
    },

    /**
     * Clear cache entry
     * @param {string} key - Cache key to clear
     */
    clear(key) {
        this.cache.delete(key);
    },

    /**
     * Clear all cache
     */
    clearAll() {
        this.cache.clear();
    }
};

/**
 * Batch DOM operations for better performance
 */
const DOMBatcher = {
    /**
     * Update multiple elements at once using DocumentFragment
     * @param {HTMLElement} container - Container element
     * @param {Array<HTMLElement>} elements - Elements to append
     */
    batchAppend(container, elements) {
        const fragment = document.createDocumentFragment();
        elements.forEach(el => fragment.appendChild(el));
        container.appendChild(fragment);
    },

    /**
     * Update element styles in batch (avoids reflows)
     * @param {HTMLElement} element - Element to update
     * @param {Object} styles - Style properties to set
     */
    batchStyles(element, styles) {
        const cssText = Object.entries(styles)
            .map(([prop, value]) => `${prop}: ${value}`)
            .join('; ');
        element.style.cssText += `; ${cssText}`;
    }
};

/**
 * Intersection Observer utility for lazy loading
 */
const LazyObserver = {
    observer: null,

    /**
     * Initialize observer for lazy loading elements
     * @param {Function} callback - Function to call when element is visible
     * @param {Object} options - Intersection Observer options
     */
    init(callback, options = { threshold: 0.1 }) {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        callback(entry.target);
                        this.observer.unobserve(entry.target);
                    }
                });
            }, options);
        }
    },

    /**
     * Observe an element
     * @param {HTMLElement} element - Element to observe
     */
    observe(element) {
        if (this.observer) {
            this.observer.observe(element);
        }
    },

    /**
     * Disconnect observer
     */
    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
};
