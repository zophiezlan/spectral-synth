/**
 * Data Loader Utility
 *
 * Provides lazy loading functionality for large data files with progress tracking
 * and caching to improve initial page load performance.
 */

// Private cache for loaded data
const cache = new Map();

// Track loading state
const loadingState = new Map();

/**
 * Load JSON data from a URL with progress tracking
 *
 * @param {string} url - URL to fetch data from
 * @param {Object} options - Loading options
 * @param {Function} options.onProgress - Progress callback (receives percentage 0-100)
 * @param {boolean} options.useCache - Whether to cache the result (default: true)
 * @returns {Promise<Object>} The loaded data
 */
export async function loadJSON(url, options = {}) {
    const {
        onProgress = null,
        useCache = true
    } = options;

    // Return cached data if available
    if (useCache && cache.has(url)) {
        console.info('[DataLoader] Returning cached data for:', url);
        if (onProgress) {
            onProgress(100);
        }
        return cache.get(url);
    }

    // Check if already loading
    if (loadingState.has(url)) {
        console.info('[DataLoader] Already loading, waiting for existing request:', url);
        return loadingState.get(url);
    }

    // Create loading promise
    const loadPromise = (async () => {
        try {
            console.info('[DataLoader] Starting fetch for:', url);

            // Fetch with progress tracking
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentLength = response.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;

            // Read the response as a stream for progress tracking
            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                chunks.push(value);
                receivedLength += value.length;

                // Report progress
                if (onProgress && total > 0) {
                    const percentage = Math.round((receivedLength / total) * 100);
                    onProgress(percentage);
                }
            }

            // Combine chunks and parse JSON
            const chunksAll = new Uint8Array(receivedLength);
            let position = 0;
            for (const chunk of chunks) {
                chunksAll.set(chunk, position);
                position += chunk.length;
            }

            const text = new TextDecoder('utf-8').decode(chunksAll);
            const data = JSON.parse(text);

            console.info('[DataLoader] Successfully loaded:', url, `(${receivedLength} bytes)`);

            // Cache the result
            if (useCache) {
                cache.set(url, data);
                console.info('[DataLoader] Cached data for:', url);
            }

            return data;

        } catch (error) {
            console.error('[DataLoader] Failed to load:', url, error);
            throw error;
        } finally {
            // Clean up loading state
            loadingState.delete(url);
        }
    })();

    // Store loading promise
    loadingState.set(url, loadPromise);

    return loadPromise;
}

/**
 * Preload data in the background without blocking
 *
 * @param {string} url - URL to preload
 * @param {Object} options - Loading options
 * @returns {Promise<void>}
 */
export async function preload(url, options = {}) {
    try {
        await loadJSON(url, { ...options, useCache: true });
        console.info('[DataLoader] Preloaded:', url);
    } catch (error) {
        console.warn('[DataLoader] Preload failed:', url, error);
    }
}

/**
 * Check if data is cached
 *
 * @param {string} url - URL to check
 * @returns {boolean} Whether data is cached
 */
export function isCached(url) {
    return cache.has(url);
}

/**
 * Clear cached data
 *
 * @param {string} url - URL to clear (if not provided, clears all)
 */
export function clearCache(url = null) {
    if (url) {
        cache.delete(url);
        console.info('[DataLoader] Cleared cache for:', url);
    } else {
        cache.clear();
        console.info('[DataLoader] Cleared all cache');
    }
}

/**
 * Get cache statistics
 *
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
    let totalSize = 0;
    const entries = [];

    for (const [url, data] of cache.entries()) {
        const size = JSON.stringify(data).length;
        totalSize += size;
        entries.push({ url, size });
    }

    return {
        count: cache.size,
        totalSize,
        entries
    };
}

// For backward compatibility, also export as default object
export const DataLoader = {
    loadJSON,
    preload,
    isCached,
    clearCache,
    getCacheStats
};
