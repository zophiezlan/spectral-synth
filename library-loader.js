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

/* global IndexedDBStorage */

const LibraryLoader = (function() {
    'use strict';

    // Private state
    let libraryIndex = null;
    let loadedCategories = {};
    let isInitialized = false;
    let useLazyLoading = true; // Feature flag

    // Configuration
    const LIBRARY_BASE_PATH = 'dist/library/';
    const FALLBACK_LIBRARY_FILE = 'ftir-library.json';
    const POPULAR_CATEGORIES = ['opioids', 'stimulants']; // Preload these

    /**
     * Initialize the library loader
     * Load the index file to get category metadata
     * @returns {Promise<Object>} Library index
     */
    async function init() {
        // Initialize IndexedDB if available
        if (typeof IndexedDBStorage !== 'undefined' && IndexedDBStorage.isSupported()) {
            try {
                await IndexedDBStorage.init();

                // Try to load index from IndexedDB first
                const cachedIndex = await IndexedDBStorage.getIndex();
                if (cachedIndex) {
                    libraryIndex = cachedIndex;
                    isInitialized = true;
                    useLazyLoading = true;

                    if (typeof Logger !== 'undefined') {
                        Logger.log(`✓ Library index loaded from IndexedDB: ${libraryIndex.totalSubstances} substances`);
                    }

                    return libraryIndex;
                }
            } catch (error) {
                // IndexedDB initialization failed, continue without it
                if (typeof Logger !== 'undefined') {
                    Logger.debug('IndexedDB initialization failed:', error.message);
                }
            }
        }

        try {
            // Try to load the library index for lazy loading
            const response = await fetch(`${LIBRARY_BASE_PATH}index.json`);

            if (!response.ok) {
                throw new Error('Index file not found');
            }

            libraryIndex = await response.json();
            isInitialized = true;
            useLazyLoading = true;

            // Store index in IndexedDB for offline use
            if (typeof IndexedDBStorage !== 'undefined' && IndexedDBStorage.isSupported()) {
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
                Logger.log(`✓ Library index loaded: ${libraryIndex.totalSubstances} substances in ${libraryIndex.categories.length} categories`);
            }

            return libraryIndex;
        } catch (error) {
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

        // Try to load from IndexedDB first (offline-first strategy)
        if (typeof IndexedDBStorage !== 'undefined' && IndexedDBStorage.isSupported()) {
            try {
                const cachedSubstances = await IndexedDBStorage.getCategory(categoryName, libraryIndex.version);
                if (cachedSubstances) {
                    loadedCategories[categoryName] = cachedSubstances;
                    if (typeof Logger !== 'undefined') {
                        Logger.log(`✓ Loaded ${cachedSubstances.length} substances from IndexedDB (offline cache)`);
                    }
                    return cachedSubstances;
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

            // Cache the loaded category in memory
            loadedCategories[categoryName] = substances;

            // Store in IndexedDB for offline use
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

            if (typeof Logger !== 'undefined') {
                Logger.log(`✓ Loaded ${substances.length} substances from category '${categoryName}' (network)`);
            }

            return substances;
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
        if (!useLazyLoading) {
            // Load monolithic file
            if (typeof LoadingOverlay !== 'undefined') {
                LoadingOverlay.show('Loading FTIR library (381 spectra)...');
            }

            try {
                const response = await fetch(FALLBACK_LIBRARY_FILE);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const library = await response.json();

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

        // Load all categories and combine
        const allSubstances = [];

        for (const categoryInfo of libraryIndex.categories) {
            if (categoryInfo.count > 0) {
                const substances = await loadCategory(categoryInfo.name);
                allSubstances.push(...substances);
            }
        }

        return allSubstances;
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
