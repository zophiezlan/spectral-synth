/**
 * TypeScript definitions for DataLoader utility
 *
 * Provides type checking and autocomplete for IDE support
 * without requiring full TypeScript conversion.
 */

export interface LoadOptions {
    /**
     * Progress callback function (receives percentage 0-100)
     */
    onProgress?: (percentage: number) => void;

    /**
     * Whether to cache the result (default: true)
     */
    useCache?: boolean;
}

export interface CacheEntry {
    /**
     * URL of the cached resource
     */
    url: string;

    /**
     * Size of the cached data in bytes
     */
    size: number;
}

export interface CacheStats {
    /**
     * Number of cached entries
     */
    count: number;

    /**
     * Total size of all cached data in bytes
     */
    totalSize: number;

    /**
     * Array of cache entries
     */
    entries: CacheEntry[];
}

export interface DataLoaderAPI {
    /**
     * Load JSON data from a URL with progress tracking
     *
     * @param url - URL to fetch data from
     * @param options - Loading options
     * @returns Promise resolving to the loaded data
     *
     * @example
     * ```javascript
     * const data = await DataLoader.loadJSON('/data.json', {
     *     onProgress: (pct) => console.log(`Loading: ${pct}%`),
     *     useCache: true
     * });
     * ```
     */
    loadJSON<T = any>(url: string, options?: LoadOptions): Promise<T>;

    /**
     * Preload data in the background without blocking
     *
     * @param url - URL to preload
     * @param options - Loading options
     * @returns Promise that resolves when preload is complete
     *
     * @example
     * ```javascript
     * DataLoader.preload('/large-file.json');
     * // Continues execution while loading in background
     * ```
     */
    preload(url: string, options?: LoadOptions): Promise<void>;

    /**
     * Check if data is cached
     *
     * @param url - URL to check
     * @returns True if data is cached, false otherwise
     *
     * @example
     * ```javascript
     * if (DataLoader.isCached('/data.json')) {
     *     console.log('Data is cached!');
     * }
     * ```
     */
    isCached(url: string): boolean;

    /**
     * Clear cached data
     *
     * @param url - URL to clear (if not provided, clears all)
     *
     * @example
     * ```javascript
     * // Clear specific URL
     * DataLoader.clearCache('/data.json');
     *
     * // Clear all cache
     * DataLoader.clearCache();
     * ```
     */
    clearCache(url?: string): void;

    /**
     * Get cache statistics
     *
     * @returns Cache statistics object
     *
     * @example
     * ```javascript
     * const stats = DataLoader.getCacheStats();
     * console.log(`${stats.count} files cached (${stats.totalSize} bytes)`);
     * ```
     */
    getCacheStats(): CacheStats;
}

declare const DataLoader: DataLoaderAPI;

export default DataLoader;
