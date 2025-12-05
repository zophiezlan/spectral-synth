/**
 * IndexedDB Storage Module
 *
 * Purpose: Provides persistent offline storage for FTIR library data
 *
 * Features:
 * - Store library categories in IndexedDB
 * - Retrieve cached categories for offline use
 * - Version management for cache invalidation
 * - Automatic cleanup of old data
 *
 * Usage:
 * ```javascript
 * // Initialize
 * await IndexedDBStorage.init();
 *
 * // Store category
 * await IndexedDBStorage.storeCategory('opioids', substances, '1.0.0');
 *
 * // Retrieve category
 * const substances = await IndexedDBStorage.getCategory('opioids', '1.0.0');
 *
 * // Clear all data
 * await IndexedDBStorage.clear();
 * ```
 */

/* global indexedDB */

const IndexedDBStorage = (function() {
    'use strict';

    const DB_NAME = 'SpectralSynthLibrary';
    const DB_VERSION = 1;
    const STORE_NAME = 'categories';
    const INDEX_STORE_NAME = 'metadata';

    let db = null;

    /**
     * Initialize IndexedDB
     * @returns {Promise<IDBDatabase>}
     */
    async function init() {
        return new Promise((resolve, reject) => {
            // Check if IndexedDB is supported
            if (!window.indexedDB) {
                if (typeof Logger !== 'undefined') {
                    Logger.info('IndexedDB not supported in this browser');
                }
                reject(new Error('IndexedDB not supported'));
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                const error = new Error('Failed to open IndexedDB');
                if (typeof Logger !== 'undefined') {
                    Logger.error('IndexedDB error:', request.error);
                }
                reject(error);
            };

            request.onsuccess = () => {
                db = request.result;
                if (typeof Logger !== 'undefined') {
                    Logger.log('✓ IndexedDB initialized');
                }
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;

                // Create object store for categories
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    const categoryStore = database.createObjectStore(STORE_NAME, { keyPath: 'name' });
                    categoryStore.createIndex('version', 'version', { unique: false });
                    categoryStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Create object store for metadata
                if (!database.objectStoreNames.contains(INDEX_STORE_NAME)) {
                    database.createObjectStore(INDEX_STORE_NAME, { keyPath: 'key' });
                }

                if (typeof Logger !== 'undefined') {
                    Logger.log('✓ IndexedDB schema created');
                }
            };
        });
    }

    /**
     * Store a category in IndexedDB
     * @param {string} categoryName - Name of the category
     * @param {Array} substances - Array of substances
     * @param {string} version - Version of the library
     * @returns {Promise<void>}
     */
    async function storeCategory(categoryName, substances, version) {
        if (!db) {
            throw new Error('IndexedDB not initialized. Call init() first.');
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const data = {
                name: categoryName,
                substances: substances,
                version: version,
                timestamp: Date.now()
            };

            const request = store.put(data);

            request.onsuccess = () => {
                if (typeof Logger !== 'undefined') {
                    Logger.log(`✓ Category '${categoryName}' stored in IndexedDB`);
                }
                resolve();
            };

            request.onerror = () => {
                if (typeof Logger !== 'undefined') {
                    Logger.error(`Failed to store category '${categoryName}':`, request.error);
                }
                reject(request.error);
            };
        });
    }

    /**
     * Get a category from IndexedDB
     * @param {string} categoryName - Name of the category
     * @param {string} expectedVersion - Expected version (optional)
     * @returns {Promise<Array|null>} Array of substances or null if not found/outdated
     */
    async function getCategory(categoryName, expectedVersion = null) {
        if (!db) {
            throw new Error('IndexedDB not initialized. Call init() first.');
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(categoryName);

            request.onsuccess = () => {
                const data = request.result;

                if (!data) {
                    resolve(null);
                    return;
                }

                // Check version if provided
                if (expectedVersion && data.version !== expectedVersion) {
                    if (typeof Logger !== 'undefined') {
                        Logger.log(`Category '${categoryName}' version mismatch (cached: ${data.version}, expected: ${expectedVersion})`);
                    }
                    resolve(null);
                    return;
                }

                if (typeof Logger !== 'undefined') {
                    Logger.log(`✓ Retrieved category '${categoryName}' from IndexedDB (${data.substances.length} substances)`);
                }

                resolve(data.substances);
            };

            request.onerror = () => {
                if (typeof Logger !== 'undefined') {
                    Logger.error(`Failed to retrieve category '${categoryName}':`, request.error);
                }
                reject(request.error);
            };
        });
    }

    /**
     * Store library index metadata
     * @param {Object} indexData - Library index data
     * @returns {Promise<void>}
     */
    async function storeIndex(indexData) {
        if (!db) {
            throw new Error('IndexedDB not initialized. Call init() first.');
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([INDEX_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(INDEX_STORE_NAME);

            const data = {
                key: 'library-index',
                data: indexData,
                timestamp: Date.now()
            };

            const request = store.put(data);

            request.onsuccess = () => {
                if (typeof Logger !== 'undefined') {
                    Logger.log('✓ Library index stored in IndexedDB');
                }
                resolve();
            };

            request.onerror = () => {
                if (typeof Logger !== 'undefined') {
                    Logger.error('Failed to store library index:', request.error);
                }
                reject(request.error);
            };
        });
    }

    /**
     * Get library index from IndexedDB
     * @returns {Promise<Object|null>}
     */
    async function getIndex() {
        if (!db) {
            throw new Error('IndexedDB not initialized. Call init() first.');
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([INDEX_STORE_NAME], 'readonly');
            const store = transaction.objectStore(INDEX_STORE_NAME);
            const request = store.get('library-index');

            request.onsuccess = () => {
                const result = request.result;
                if (result && result.data) {
                    if (typeof Logger !== 'undefined') {
                        Logger.log('✓ Retrieved library index from IndexedDB');
                    }
                    resolve(result.data);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                if (typeof Logger !== 'undefined') {
                    Logger.error('Failed to retrieve library index:', request.error);
                }
                reject(request.error);
            };
        });
    }

    /**
     * Check if a category exists in IndexedDB
     * @param {string} categoryName - Name of the category
     * @returns {Promise<boolean>}
     */
    async function hasCategory(categoryName) {
        if (!db) {
            return false;
        }

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(categoryName);

            request.onsuccess = () => {
                resolve(!!request.result);
            };

            request.onerror = () => {
                resolve(false);
            };
        });
    }

    /**
     * Get all stored category names
     * @returns {Promise<Array<string>>}
     */
    async function getAllCategoryNames() {
        if (!db) {
            throw new Error('IndexedDB not initialized. Call init() first.');
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAllKeys();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Delete a category from IndexedDB
     * @param {string} categoryName - Name of the category
     * @returns {Promise<void>}
     */
    async function deleteCategory(categoryName) {
        if (!db) {
            throw new Error('IndexedDB not initialized. Call init() first.');
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(categoryName);

            request.onsuccess = () => {
                if (typeof Logger !== 'undefined') {
                    Logger.log(`✓ Category '${categoryName}' deleted from IndexedDB`);
                }
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Clear all data from IndexedDB
     * @returns {Promise<void>}
     */
    async function clear() {
        if (!db) {
            throw new Error('IndexedDB not initialized. Call init() first.');
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME, INDEX_STORE_NAME], 'readwrite');

            const categoryStore = transaction.objectStore(STORE_NAME);
            const indexStore = transaction.objectStore(INDEX_STORE_NAME);

            const clearCategories = categoryStore.clear();
            const clearIndex = indexStore.clear();

            transaction.oncomplete = () => {
                if (typeof Logger !== 'undefined') {
                    Logger.log('✓ IndexedDB cleared');
                }
                resolve();
            };

            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }

    /**
     * Get storage usage information
     * @returns {Promise<Object>}
     */
    async function getStorageInfo() {
        if (!db) {
            return { available: false };
        }

        try {
            // Get stored categories
            const categoryNames = await getAllCategoryNames();

            // Try to estimate storage usage (this is an approximation)
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                return {
                    available: true,
                    categoriesStored: categoryNames.length,
                    categories: categoryNames,
                    usage: estimate.usage,
                    quota: estimate.quota,
                    usagePercent: ((estimate.usage / estimate.quota) * 100).toFixed(2)
                };
            }

            return {
                available: true,
                categoriesStored: categoryNames.length,
                categories: categoryNames
            };
        } catch (error) {
            if (typeof Logger !== 'undefined') {
                Logger.error('Failed to get storage info:', error);
            }
            return { available: false, error: error.message };
        }
    }

    /**
     * Check if IndexedDB is supported
     * @returns {boolean}
     */
    function isSupported() {
        return !!window.indexedDB;
    }

    // Public API
    return {
        init,
        storeCategory,
        getCategory,
        storeIndex,
        getIndex,
        hasCategory,
        getAllCategoryNames,
        deleteCategory,
        clear,
        getStorageInfo,
        isSupported
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.IndexedDBStorage = IndexedDBStorage;
}
