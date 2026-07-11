/**
 * Library Loader Module
 *
 * Purpose: Manages lazy loading of FTIR library data
 *
 * Features:
 * - Load library index on initialization
 * - On-demand category loading
 * - Smart preloading of popular categories
 * - Caching of loaded categories
 * - Progress indicators during loading
 *
 * Usage:
 * ```javascript
 * // Initialize with index
 * await LibraryLoader.init();
 *
 * // Load specific category
 * const substances = await LibraryLoader.loadCategory('opioids');
 *
 * // Load all categories
 * const allSubstances = await LibraryLoader.loadAll();
 * ```
 */

/* global IndexedDBStorage, SpectrumCodec */

const LibraryLoader = (function() {
    'use strict';

    // Private state
    let libraryIndex = null;
    let loadedCategories = {};
    let isInitialized = false;
    let useLazyLoading = true; // Feature flag

    // Configuration
    // Path is relative to the served root. In production the build outputs
    // chunks to dist/library/ and Vercel serves dist/ as /, so /library/ resolves
    // correctly. In dev (no build run) this 404s and triggers the monolith fallback.
    const LIBRARY_BASE_PATH = 'library/';
    const FALLBACK_LIBRARY_FILE = 'ftir-library.json';
    const POPULAR_CATEGORIES = ['opioids', 'stimulants']; // Preload these

    /**
     * Initialize the library loader
     *
     * Always fetches the (tiny) network index first so a new deploy's
     * content-hash version reaches clients immediately; the IndexedDB
     * copy is only used as an offline fallback. Category caches are
     * validated against the index version, so stale data self-invalidates.
     *
     * @returns {Promise<Object>} Library index
     */
    async function init() {
        // Initialize IndexedDB if available (used for offline caching)
        let idbAvailable = false;
        if (typeof IndexedDBStorage !== 'undefined' && IndexedDBStorage.isSupported()) {
            try {
                await IndexedDBStorage.init();
                idbAvailable = true;
            } catch (error) {
                if (typeof Logger !== 'undefined') {
                    Logger.debug('IndexedDB initialization failed:', error.message);
                }
            }
        }

        try {
            // Network-first: the index is tiny and carries the current version
            const response = await fetch(`${LIBRARY_BASE_PATH}index.json`);

            if (!response.ok) {
                throw new Error('Index file not found');
            }

            libraryIndex = await response.json();
            isInitialized = true;
            useLazyLoading = true;

            // Store index in IndexedDB for offline use
            if (idbAvailable) {
                try {
                    await IndexedDBStorage.storeIndex(libraryIndex);
                } catch (error) {
                    // Don't fail if IndexedDB storage fails
                    if (typeof Logger !== 'undefined') {
                        Logger.debug('Failed to store index in IndexedDB:', error.message);
                    }
                }
            }

            if (typeof Logger !== 'undefined') {
                Logger.log(`✓ Library index loaded: ${libraryIndex.totalSubstances} substances in ${libraryIndex.categories.length} categories (v${libraryIndex.version})`);
            }

            return libraryIndex;
        } catch (_networkError) {
            // Offline (or no build): fall back to the cached index
            if (idbAvailable) {
                try {
                    const cachedIndex = await IndexedDBStorage.getIndex();
                    if (cachedIndex) {
                        libraryIndex = cachedIndex;
                        isInitialized = true;
                        useLazyLoading = true;

                        if (typeof Logger !== 'undefined') {
                            Logger.log(`✓ Library index loaded from IndexedDB (offline): ${libraryIndex.totalSubstances} substances`);
                        }

                        return libraryIndex;
                    }
                } catch (error) {
                    if (typeof Logger !== 'undefined') {
                        Logger.debug('IndexedDB index fallback failed:', error.message);
                    }
                }
            }

            // Fallback to monolithic library
            if (typeof Logger !== 'undefined') {
                Logger.info('Library index not found, using monolithic library');
            }
            useLazyLoading = false;
            isInitialized = true;
            return null;
        }
    }

    /**
     * Load a specific category
     * @param {string} categoryName - Name of the category to load
     * @returns {Promise<Array>} Array of substances in the category
     */
    async function loadCategory(categoryName) {
        // Check if already loaded in memory
        if (loadedCategories[categoryName]) {
            if (typeof Logger !== 'undefined') {
                Logger.log(`✓ Category '${categoryName}' already loaded (memory cache)`);
            }
            return loadedCategories[categoryName];
        }

        // Find category info from index
        const categoryInfo = libraryIndex.categories.find(c => c.name === categoryName);
        if (!categoryInfo) {
            throw new Error(`Category not found: ${categoryName}`);
        }

        // Try to load from IndexedDB first (offline-first strategy).
        // The version check against the network index invalidates stale caches.
        if (typeof IndexedDBStorage !== 'undefined' && IndexedDBStorage.isSupported()) {
            try {
                const cachedSubstances = await IndexedDBStorage.getCategory(categoryName, libraryIndex.version);
                if (cachedSubstances) {
                    const decoded = SpectrumCodec.decodeLibrary(cachedSubstances);
                    loadedCategories[categoryName] = decoded;
                    if (typeof Logger !== 'undefined') {
                        Logger.log(`✓ Loaded ${decoded.length} substances from IndexedDB (offline cache)`);
                    }
                    return decoded;
                }
            } catch (error) {
                // IndexedDB failed, continue to network fetch
                if (typeof Logger !== 'undefined') {
                    Logger.debug('IndexedDB load failed, fetching from network:', error.message);
                }
            }
        }

        // Show loading indicator for network fetch
        if (typeof LoadingOverlay !== 'undefined') {
            LoadingOverlay.show(`Loading ${categoryInfo.displayName} (${categoryInfo.count} substances)...`);
        }

        try {
            const response = await fetch(`${LIBRARY_BASE_PATH}${categoryInfo.filename}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const substances = await response.json();

            // Store the compact wire format in IndexedDB (smaller on disk);
            // it gets decoded again on retrieval.
            if (typeof IndexedDBStorage !== 'undefined' && IndexedDBStorage.isSupported()) {
                try {
                    await IndexedDBStorage.storeCategory(categoryName, substances, libraryIndex.version);
                } catch (error) {
                    // Don't fail if IndexedDB storage fails
                    if (typeof Logger !== 'undefined') {
                        Logger.debug('Failed to store in IndexedDB:', error.message);
                    }
                }
            }

            // Decode compact spectra to runtime point arrays and cache in memory
            const decoded = SpectrumCodec.decodeLibrary(substances);
            loadedCategories[categoryName] = decoded;

            if (typeof Logger !== 'undefined') {
                Logger.log(`✓ Loaded ${decoded.length} substances from category '${categoryName}' (network)`);
            }

            return decoded;
        } catch (error) {
            if (typeof Logger !== 'undefined') {
                Logger.error(`Failed to load category ${categoryName}:`, error);
            }
            throw error;
        } finally {
            if (typeof LoadingOverlay !== 'undefined') {
                LoadingOverlay.hide();
            }
        }
    }

    /**
     * Load all categories (fallback to monolithic file or load all categories)
     * @returns {Promise<Array>} Array of all substances
     */
    async function loadAll() {
        if (!useLazyLoading || !libraryIndex) {
            // Load monolithic file
            if (typeof LoadingOverlay !== 'undefined') {
                LoadingOverlay.show('Loading FTIR library...');
            }

            try {
                const response = await fetch(FALLBACK_LIBRARY_FILE);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const library = SpectrumCodec.decodeLibrary(await response.json());

                if (typeof Logger !== 'undefined') {
                    Logger.log(`✓ Loaded ${library.length} spectra from monolithic library`);
                }

                return library;
            } finally {
                if (typeof LoadingOverlay !== 'undefined') {
                    LoadingOverlay.hide();
                }
            }
        }

        // Load all categories concurrently and combine
        const results = await Promise.all(
            libraryIndex.categories
                .filter(categoryInfo => categoryInfo.count > 0)
                .map(categoryInfo => loadCategory(categoryInfo.name))
        );

        return results.flat();
    }

    /**
     * Preload popular categories in the background
     * Only preload on fast connections to avoid wasting bandwidth
     */
    async function preloadPopularCategories() {
        if (!useLazyLoading || !libraryIndex) return;

        // Check connection speed if available
        if (navigator.connection && navigator.connection.effectiveType) {
            const connectionType = navigator.connection.effectiveType;
            // Only preload on 4G connections
            if (connectionType !== '4g') {
                if (typeof Logger !== 'undefined') {
                    Logger.info(`Skipping preload on ${connectionType} connection`);
                }
                return;
            }
        }

        if (typeof Logger !== 'undefined') {
            Logger.log('Preloading popular categories...');
        }

        // Load popular categories in the background
        for (const category of POPULAR_CATEGORIES) {
            try {
                await loadCategory(category);
            } catch (error) {
                // Fail silently for preloading
                if (typeof Logger !== 'undefined') {
                    Logger.debug(`Failed to preload ${category}:`, error.message);
                }
            }
        }
    }

    /**
     * Get substances for a specific category (load if needed)
     * @param {string} categoryName - Category name or 'all'
     * @returns {Promise<Array>} Array of substances
     */
    async function getSubstancesByCategory(categoryName) {
        if (!isInitialized) {
            throw new Error('Library loader not initialized. Call init() first.');
        }

        if (categoryName === 'all') {
            return await loadAll();
        }

        return await loadCategory(categoryName);
    }

    /**
     * Get currently loaded categories
     * @returns {Array} Array of category names
     */
    function getLoadedCategories() {
        return Object.keys(loadedCategories);
    }

    /**
     * Clear category cache
     */
    function clearCache() {
        loadedCategories = {};
        if (typeof Logger !== 'undefined') {
            Logger.log('Library cache cleared');
        }
    }

    /**
     * Check if lazy loading is enabled
     * @returns {boolean}
     */
    function isLazyLoadingEnabled() {
        return useLazyLoading;
    }

    /**
     * Get library index
     * @returns {Object|null}
     */
    function getIndex() {
        return libraryIndex;
    }

    /**
     * Get all loaded substances from cache
     * @returns {Array}
     */
    function getAllLoadedSubstances() {
        const allSubstances = [];
        for (const substances of Object.values(loadedCategories)) {
            allSubstances.push(...substances);
        }
        return allSubstances;
    }

    // Public API
    return {
        init,
        loadCategory,
        loadAll,
        preloadPopularCategories,
        getSubstancesByCategory,
        getLoadedCategories,
        clearCache,
        isLazyLoadingEnabled,
        getIndex,
        getAllLoadedSubstances,
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.LibraryLoader = LibraryLoader;
}
