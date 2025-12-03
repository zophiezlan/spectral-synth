/**
 * Unit tests for Performance Utilities
 */

describe('PerformanceUtilities', () => {
    describe('debounce', () => {
        let debounce;

        beforeEach(() => {
            debounce = function(func, wait, immediate = false) {
                let timeout;

                return function executedFunction(...args) {
                    const context = this;

                    const later = function() {
                        timeout = null;
                        if (!immediate) {
                            func.apply(context, args);
                        }
                    };

                    const callNow = immediate && !timeout;

                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);

                    if (callNow) {
                        func.apply(context, args);
                    }
                };
            };

            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should debounce function calls', () => {
            const func = jest.fn();
            const debouncedFunc = debounce(func, 100);

            debouncedFunc();
            debouncedFunc();
            debouncedFunc();

            expect(func).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);

            expect(func).toHaveBeenCalledTimes(1);
        });

        test('should call function after wait period', () => {
            const func = jest.fn();
            const debouncedFunc = debounce(func, 500);

            debouncedFunc();

            jest.advanceTimersByTime(499);
            expect(func).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1);
            expect(func).toHaveBeenCalledTimes(1);
        });

        test('should reset timer on subsequent calls', () => {
            const func = jest.fn();
            const debouncedFunc = debounce(func, 100);

            debouncedFunc();
            jest.advanceTimersByTime(50);
            debouncedFunc();
            jest.advanceTimersByTime(50);
            debouncedFunc();
            jest.advanceTimersByTime(50);

            expect(func).not.toHaveBeenCalled();

            jest.advanceTimersByTime(50);
            expect(func).toHaveBeenCalledTimes(1);
        });

        test('should pass arguments correctly', () => {
            const func = jest.fn();
            const debouncedFunc = debounce(func, 100);

            debouncedFunc('arg1', 'arg2', 123);

            jest.advanceTimersByTime(100);

            expect(func).toHaveBeenCalledWith('arg1', 'arg2', 123);
        });

        test('should handle immediate=true (leading edge)', () => {
            const func = jest.fn();
            const debouncedFunc = debounce(func, 100, true);

            debouncedFunc();
            expect(func).toHaveBeenCalledTimes(1);

            debouncedFunc();
            expect(func).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(100);

            debouncedFunc();
            expect(func).toHaveBeenCalledTimes(2);
        });
    });

    describe('throttle', () => {
        let throttle;

        beforeEach(() => {
            throttle = function(func, limit) {
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
            };

            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should throttle function calls', () => {
            const func = jest.fn();
            const throttledFunc = throttle(func, 100);

            throttledFunc();
            throttledFunc();
            throttledFunc();

            expect(func).toHaveBeenCalledTimes(1);
        });

        test('should allow call after limit period', () => {
            const func = jest.fn();
            const throttledFunc = throttle(func, 100);

            throttledFunc();
            expect(func).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(100);

            throttledFunc();
            expect(func).toHaveBeenCalledTimes(2);
        });

        test('should pass arguments correctly', () => {
            const func = jest.fn();
            const throttledFunc = throttle(func, 100);

            throttledFunc('test', 123);

            expect(func).toHaveBeenCalledWith('test', 123);
        });

        test('should return last result during throttle period', () => {
            const func = jest.fn(() => 'result');
            const throttledFunc = throttle(func, 100);

            const result1 = throttledFunc();
            const result2 = throttledFunc();

            expect(result1).toBe('result');
            expect(result2).toBe('result');
            expect(func).toHaveBeenCalledTimes(1);
        });
    });

    describe('RAFManager', () => {
        let RAFManager;

        beforeEach(() => {
            RAFManager = {
                activeRAFs: new Map(),

                start(id, callback) {
                    this.stop(id);

                    const loop = () => {
                        callback();
                        const rafId = requestAnimationFrame(loop);
                        this.activeRAFs.set(id, rafId);
                    };

                    loop();
                },

                stop(id) {
                    const rafId = this.activeRAFs.get(id);
                    if (rafId !== undefined) {
                        cancelAnimationFrame(rafId);
                        this.activeRAFs.delete(id);
                    }
                },

                stopAll() {
                    this.activeRAFs.forEach(rafId => cancelAnimationFrame(rafId));
                    this.activeRAFs.clear();
                }
            };

            global.requestAnimationFrame = jest.fn((cb) => {
                return setTimeout(cb, 16);
            });

            global.cancelAnimationFrame = jest.fn((id) => {
                clearTimeout(id);
            });
        });

        test('should start RAF loop', () => {
            const callback = jest.fn();
            RAFManager.start('test', callback);

            expect(callback).toHaveBeenCalled();
            expect(RAFManager.activeRAFs.has('test')).toBe(true);
        });

        test('should stop RAF loop', () => {
            const callback = jest.fn();
            RAFManager.start('test', callback);

            RAFManager.stop('test');

            expect(cancelAnimationFrame).toHaveBeenCalled();
            expect(RAFManager.activeRAFs.has('test')).toBe(false);
        });

        test('should stop existing RAF when starting with same ID', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            RAFManager.start('test', callback1);
            const firstRafId = RAFManager.activeRAFs.get('test');

            RAFManager.start('test', callback2);

            expect(cancelAnimationFrame).toHaveBeenCalledWith(firstRafId);
        });

        test('should stop all active RAFs', () => {
            RAFManager.start('test1', jest.fn());
            RAFManager.start('test2', jest.fn());
            RAFManager.start('test3', jest.fn());

            expect(RAFManager.activeRAFs.size).toBe(3);

            RAFManager.stopAll();

            expect(RAFManager.activeRAFs.size).toBe(0);
            expect(cancelAnimationFrame).toHaveBeenCalledTimes(3);
        });
    });

    describe('MemoryManager', () => {
        let MemoryManager;

        beforeEach(() => {
            MemoryManager = {
                clearObject(obj, keys = null) {
                    if (!obj) {
                        return;
                    }

                    const keysToClean = keys || Object.keys(obj);
                    keysToClean.forEach(key => {
                        if (obj[key] instanceof Array) {
                            obj[key].length = 0;
                        } else {
                            obj[key] = null;
                        }
                    });
                },

                revokeObjectURLs(urls) {
                    const urlArray = Array.isArray(urls) ? urls : [urls];
                    urlArray.forEach(url => {
                        if (url && typeof url === 'string') {
                            URL.revokeObjectURL(url);
                        }
                    });
                }
            };

            global.URL.revokeObjectURL = jest.fn();
        });

        describe('clearObject', () => {
            test('should clear all object properties', () => {
                const obj = {
                    a: 1,
                    b: 'test',
                    c: { nested: true }
                };

                MemoryManager.clearObject(obj);

                expect(obj.a).toBeNull();
                expect(obj.b).toBeNull();
                expect(obj.c).toBeNull();
            });

            test('should clear only specified keys', () => {
                const obj = {
                    a: 1,
                    b: 2,
                    c: 3
                };

                MemoryManager.clearObject(obj, ['a', 'c']);

                expect(obj.a).toBeNull();
                expect(obj.b).toBe(2);
                expect(obj.c).toBeNull();
            });

            test('should empty arrays instead of nulling them', () => {
                const obj = {
                    arr: [1, 2, 3, 4]
                };

                MemoryManager.clearObject(obj);

                expect(obj.arr).toEqual([]);
                expect(obj.arr.length).toBe(0);
            });

            test('should handle null object gracefully', () => {
                expect(() => {
                    MemoryManager.clearObject(null);
                }).not.toThrow();
            });

            test('should handle undefined object gracefully', () => {
                expect(() => {
                    MemoryManager.clearObject(undefined);
                }).not.toThrow();
            });
        });

        describe('revokeObjectURLs', () => {
            test('should revoke single URL', () => {
                MemoryManager.revokeObjectURLs('blob:http://example.com/123');

                expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://example.com/123');
            });

            test('should revoke multiple URLs', () => {
                const urls = [
                    'blob:http://example.com/123',
                    'blob:http://example.com/456'
                ];

                MemoryManager.revokeObjectURLs(urls);

                expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
            });

            test('should handle empty array', () => {
                expect(() => {
                    MemoryManager.revokeObjectURLs([]);
                }).not.toThrow();
            });

            test('should skip invalid URLs', () => {
                MemoryManager.revokeObjectURLs([null, undefined, 123, 'valid-url']);

                expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
                expect(URL.revokeObjectURL).toHaveBeenCalledWith('valid-url');
            });
        });
    });

    describe('LazyLoader', () => {
        let LazyLoader;

        beforeEach(() => {
            LazyLoader = {
                cache: new Map(),

                async load(key, loader) {
                    if (this.cache.has(key)) {
                        return this.cache.get(key);
                    }

                    const result = await loader();
                    this.cache.set(key, result);
                    return result;
                },

                clear(key) {
                    this.cache.delete(key);
                },

                clearAll() {
                    this.cache.clear();
                }
            };
        });

        test('should load and cache result', async () => {
            const loader = jest.fn(() => Promise.resolve('result'));

            const result = await LazyLoader.load('test', loader);

            expect(result).toBe('result');
            expect(loader).toHaveBeenCalledTimes(1);
            expect(LazyLoader.cache.has('test')).toBe(true);
        });

        test('should return cached result on subsequent calls', async () => {
            const loader = jest.fn(() => Promise.resolve('result'));

            await LazyLoader.load('test', loader);
            const result2 = await LazyLoader.load('test', loader);

            expect(result2).toBe('result');
            expect(loader).toHaveBeenCalledTimes(1); // Only called once
        });

        test('should clear specific cache entry', async () => {
            await LazyLoader.load('test1', () => Promise.resolve('result1'));
            await LazyLoader.load('test2', () => Promise.resolve('result2'));

            LazyLoader.clear('test1');

            expect(LazyLoader.cache.has('test1')).toBe(false);
            expect(LazyLoader.cache.has('test2')).toBe(true);
        });

        test('should clear all cache', async () => {
            await LazyLoader.load('test1', () => Promise.resolve('result1'));
            await LazyLoader.load('test2', () => Promise.resolve('result2'));

            LazyLoader.clearAll();

            expect(LazyLoader.cache.size).toBe(0);
        });
    });
});
