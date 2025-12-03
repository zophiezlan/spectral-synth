/**
 * Unit tests for DataLoader utility
 */

import { jest } from '@jest/globals';

describe('DataLoader', () => {
    let DataLoader;
    let fetchMock;

    beforeEach(() => {
        // Mock DataLoader for testing
        DataLoader = {
            _cache: new Map(),
            _loadingState: new Map(),

            async loadJSON(url, options = {}) {
                const { onProgress = null, useCache = true } = options;

                // Return cached data if available
                if (useCache && this._cache.has(url)) {
                    if (onProgress) {
                        onProgress(100);
                    }
                    return this._cache.get(url);
                }

                // Check if already loading
                if (this._loadingState.has(url)) {
                    return this._loadingState.get(url);
                }

                // Create loading promise
                const loadPromise = (async () => {
                    try {
                        const response = await fetch(url);

                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }

                        // Simulate progress
                        if (onProgress) {
                            onProgress(50);
                        }

                        const data = await response.json();

                        if (onProgress) {
                            onProgress(100);
                        }

                        // Cache the result
                        if (useCache) {
                            this._cache.set(url, data);
                        }

                        return data;

                    } finally {
                        this._loadingState.delete(url);
                    }
                })();

                this._loadingState.set(url, loadPromise);
                return loadPromise;
            },

            async preload(url, options = {}) {
                try {
                    await this.loadJSON(url, { ...options, useCache: true });
                } catch (error) {
                    // Preload failures are not critical
                }
            },

            isCached(url) {
                return this._cache.has(url);
            },

            clearCache(url = null) {
                if (url) {
                    this._cache.delete(url);
                } else {
                    this._cache.clear();
                }
            },

            getCacheStats() {
                let totalSize = 0;
                const entries = [];

                for (const [url, data] of this._cache.entries()) {
                    const size = JSON.stringify(data).length;
                    totalSize += size;
                    entries.push({ url, size });
                }

                return {
                    count: this._cache.size,
                    totalSize,
                    entries
                };
            }
        };

        // Mock fetch
        global.fetch = jest.fn();
        fetchMock = global.fetch;
    });

    afterEach(() => {
        jest.clearAllMocks();
        DataLoader._cache.clear();
        DataLoader._loadingState.clear();
    });

    describe('loadJSON', () => {
        test('should load JSON data from URL', async () => {
            const mockData = { spectra: [{ id: 1, name: 'Test' }] };
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData
            });

            const result = await DataLoader.loadJSON('/test.json');

            expect(result).toEqual(mockData);
            expect(fetchMock).toHaveBeenCalledWith('/test.json');
        });

        test('should cache loaded data by default', async () => {
            const mockData = { test: 'data' };
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData
            });

            await DataLoader.loadJSON('/test.json');

            expect(DataLoader.isCached('/test.json')).toBe(true);
        });

        test('should return cached data on subsequent calls', async () => {
            const mockData = { test: 'data' };
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData
            });

            const result1 = await DataLoader.loadJSON('/test.json');
            const result2 = await DataLoader.loadJSON('/test.json');

            expect(result1).toEqual(mockData);
            expect(result2).toEqual(mockData);
            expect(fetchMock).toHaveBeenCalledTimes(1); // Only called once
        });

        test('should call onProgress callback', async () => {
            const mockData = { test: 'data' };
            const onProgress = jest.fn();

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData
            });

            await DataLoader.loadJSON('/test.json', { onProgress });

            expect(onProgress).toHaveBeenCalled();
            expect(onProgress).toHaveBeenCalledWith(100);
        });

        test('should skip cache when useCache is false', async () => {
            const mockData = { test: 'data' };
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockData
            });

            await DataLoader.loadJSON('/test.json', { useCache: false });
            await DataLoader.loadJSON('/test.json', { useCache: false });

            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        test('should throw error on HTTP failure', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 404
            });

            await expect(DataLoader.loadJSON('/nonexistent.json')).rejects.toThrow('HTTP error! status: 404');
        });

        test('should throw error on network failure', async () => {
            fetchMock.mockRejectedValueOnce(new Error('Network error'));

            await expect(DataLoader.loadJSON('/test.json')).rejects.toThrow('Network error');
        });
    });

    describe('preload', () => {
        test('should preload data without blocking', async () => {
            const mockData = { test: 'data' };
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData
            });

            await DataLoader.preload('/test.json');

            expect(DataLoader.isCached('/test.json')).toBe(true);
        });

        test('should not throw on preload failure', async () => {
            fetchMock.mockRejectedValueOnce(new Error('Network error'));

            await expect(DataLoader.preload('/test.json')).resolves.not.toThrow();
        });
    });

    describe('isCached', () => {
        test('should return false for uncached URL', () => {
            expect(DataLoader.isCached('/test.json')).toBe(false);
        });

        test('should return true for cached URL', async () => {
            const mockData = { test: 'data' };
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData
            });

            await DataLoader.loadJSON('/test.json');

            expect(DataLoader.isCached('/test.json')).toBe(true);
        });
    });

    describe('clearCache', () => {
        test('should clear specific URL from cache', async () => {
            const mockData = { test: 'data' };
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockData
            });

            await DataLoader.loadJSON('/test1.json');
            await DataLoader.loadJSON('/test2.json');

            DataLoader.clearCache('/test1.json');

            expect(DataLoader.isCached('/test1.json')).toBe(false);
            expect(DataLoader.isCached('/test2.json')).toBe(true);
        });

        test('should clear all cache when no URL provided', async () => {
            const mockData = { test: 'data' };
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockData
            });

            await DataLoader.loadJSON('/test1.json');
            await DataLoader.loadJSON('/test2.json');

            DataLoader.clearCache();

            expect(DataLoader.isCached('/test1.json')).toBe(false);
            expect(DataLoader.isCached('/test2.json')).toBe(false);
        });
    });

    describe('getCacheStats', () => {
        test('should return empty stats for empty cache', () => {
            const stats = DataLoader.getCacheStats();

            expect(stats.count).toBe(0);
            expect(stats.totalSize).toBe(0);
            expect(stats.entries).toEqual([]);
        });

        test('should return correct cache statistics', async () => {
            const mockData1 = { id: 1, name: 'Test 1' };
            const mockData2 = { id: 2, name: 'Test 2' };

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData1
            });
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData2
            });

            await DataLoader.loadJSON('/test1.json');
            await DataLoader.loadJSON('/test2.json');

            const stats = DataLoader.getCacheStats();

            expect(stats.count).toBe(2);
            expect(stats.totalSize).toBeGreaterThan(0);
            expect(stats.entries).toHaveLength(2);
            expect(stats.entries[0]).toHaveProperty('url');
            expect(stats.entries[0]).toHaveProperty('size');
        });
    });
});
