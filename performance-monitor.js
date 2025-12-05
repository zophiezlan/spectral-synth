/**
 * Performance Monitor Module
 *
 * Purpose: Track and report application performance metrics
 *
 * Features:
 * - Track page load time
 * - Monitor library loading performance
 * - Measure category load times
 * - Track resource loading
 * - Report performance metrics
 *
 * Usage:
 * ```javascript
 * // Start tracking
 * PerformanceMonitor.init();
 *
 * // Mark specific events
 * PerformanceMonitor.mark('library-loaded');
 *
 * // Measure between marks
 * PerformanceMonitor.measure('library-load-time', 'library-start', 'library-loaded');
 *
 * // Get metrics
 * const metrics = PerformanceMonitor.getMetrics();
 * ```
 */

const PerformanceMonitor = (function() {
    'use strict';

    // Performance marks and measurements
    const marks = {};
    const measurements = {};
    let isInitialized = false;

    /**
     * Initialize performance monitoring
     */
    function init() {
        if (isInitialized) return;

        // Check if Performance API is supported
        if (!window.performance || !window.performance.mark) {
            if (typeof Logger !== 'undefined') {
                Logger.info('Performance API not supported');
            }
            return;
        }

        isInitialized = true;

        // Mark app start
        mark('app-start');

        // Track page load time
        if (window.performance.timing) {
            window.addEventListener('load', () => {
                const timing = window.performance.timing;
                const loadTime = timing.loadEventEnd - timing.navigationStart;
                const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;

                measurements['page-load-time'] = loadTime;
                measurements['dom-ready-time'] = domReady;

                if (typeof Logger !== 'undefined') {
                    Logger.log(`Page load time: ${loadTime}ms`);
                    Logger.log(`DOM ready time: ${domReady}ms`);
                }
            });
        }

        // Track resource loading if available
        if (window.performance.getEntriesByType) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    trackResourceLoading();
                }, 1000);
            });
        }

        if (typeof Logger !== 'undefined') {
            Logger.log('✓ Performance monitoring initialized');
        }
    }

    /**
     * Create a performance mark
     * @param {string} name - Name of the mark
     */
    function mark(name) {
        if (!isInitialized) return;

        try {
            window.performance.mark(name);
            marks[name] = window.performance.now();
        } catch (error) {
            // Silently fail if performance API not available
        }
    }

    /**
     * Measure time between two marks
     * @param {string} name - Name of the measurement
     * @param {string} startMark - Start mark name
     * @param {string} endMark - End mark name (optional, uses current time if not provided)
     * @returns {number} Duration in milliseconds
     */
    function measure(name, startMark, endMark = null) {
        if (!isInitialized) return 0;

        try {
            if (endMark) {
                window.performance.measure(name, startMark, endMark);
            } else {
                window.performance.measure(name, startMark);
            }

            const measurement = window.performance.getEntriesByName(name, 'measure')[0];
            const duration = measurement ? measurement.duration : 0;
            measurements[name] = duration;

            if (typeof Logger !== 'undefined') {
                Logger.log(`${name}: ${duration.toFixed(2)}ms`);
            }

            return duration;
        } catch (error) {
            // Silently fail if marks don't exist
            return 0;
        }
    }

    /**
     * Track library loading performance
     * @param {string} type - Type of load ('index', 'category', 'monolithic')
     * @param {string} name - Name of the category (if applicable)
     * @param {number} startTime - Start time
     */
    function trackLibraryLoad(type, name, startTime) {
        if (!isInitialized) return;

        const endTime = window.performance.now();
        const duration = endTime - startTime;

        const key = name ? `library-load-${type}-${name}` : `library-load-${type}`;
        measurements[key] = duration;

        if (typeof Logger !== 'undefined') {
            Logger.log(`Library load (${type}${name ? ': ' + name : ''}): ${duration.toFixed(2)}ms`);
        }
    }

    /**
     * Track resource loading times
     * @private
     */
    function trackResourceLoading() {
        if (!window.performance.getEntriesByType) return;

        const resources = window.performance.getEntriesByType('resource');
        const resourceStats = {
            total: resources.length,
            byType: {},
            totalSize: 0,
            totalDuration: 0
        };

        resources.forEach(resource => {
            // Determine resource type
            const type = getResourceType(resource.name);

            if (!resourceStats.byType[type]) {
                resourceStats.byType[type] = { count: 0, duration: 0 };
            }

            resourceStats.byType[type].count++;
            resourceStats.byType[type].duration += resource.duration;
            resourceStats.totalDuration += resource.duration;

            // Track transfer size if available
            if (resource.transferSize) {
                resourceStats.totalSize += resource.transferSize;
            }
        });

        measurements['resource-stats'] = resourceStats;

        if (typeof Logger !== 'undefined') {
            Logger.log(`Loaded ${resourceStats.total} resources in ${resourceStats.totalDuration.toFixed(2)}ms`);
        }
    }

    /**
     * Get resource type from URL
     * @param {string} url - Resource URL
     * @returns {string} Resource type
     * @private
     */
    function getResourceType(url) {
        if (url.endsWith('.js')) return 'script';
        if (url.endsWith('.css')) return 'stylesheet';
        if (url.endsWith('.json')) return 'data';
        if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
        return 'other';
    }

    /**
     * Get all performance metrics
     * @returns {Object} Performance metrics
     */
    function getMetrics() {
        const metrics = {
            marks: { ...marks },
            measurements: { ...measurements }
        };

        // Add navigation timing if available
        if (window.performance.timing) {
            const timing = window.performance.timing;
            metrics.navigation = {
                dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
                tcpConnection: timing.connectEnd - timing.connectStart,
                serverResponse: timing.responseEnd - timing.requestStart,
                domProcessing: timing.domComplete - timing.domLoading,
                pageLoad: timing.loadEventEnd - timing.navigationStart
            };
        }

        // Add memory info if available (Chrome only)
        if (window.performance.memory) {
            metrics.memory = {
                usedJSHeapSize: window.performance.memory.usedJSHeapSize,
                totalJSHeapSize: window.performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
            };
        }

        return metrics;
    }

    /**
     * Report performance metrics to console
     */
    function report() {
        if (!isInitialized) {
            console.log('Performance monitoring not initialized');
            return;
        }

        console.group('📊 Performance Metrics');

        const metrics = getMetrics();

        // Marks
        if (Object.keys(metrics.marks).length > 0) {
            console.group('Marks');
            Object.entries(metrics.marks).forEach(([name, time]) => {
                console.log(`${name}: ${time.toFixed(2)}ms`);
            });
            console.groupEnd();
        }

        // Measurements
        if (Object.keys(metrics.measurements).length > 0) {
            console.group('Measurements');
            Object.entries(metrics.measurements).forEach(([name, value]) => {
                if (typeof value === 'number') {
                    console.log(`${name}: ${value.toFixed(2)}ms`);
                } else if (typeof value === 'object') {
                    console.log(name, value);
                }
            });
            console.groupEnd();
        }

        // Navigation timing
        if (metrics.navigation) {
            console.group('Navigation Timing');
            Object.entries(metrics.navigation).forEach(([name, time]) => {
                console.log(`${name}: ${time}ms`);
            });
            console.groupEnd();
        }

        // Memory (if available)
        if (metrics.memory) {
            console.group('Memory Usage');
            console.log(`Used: ${(metrics.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`Total: ${(metrics.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`Limit: ${(metrics.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`);
            console.groupEnd();
        }

        console.groupEnd();
    }

    /**
     * Clear all performance data
     */
    function clear() {
        if (window.performance.clearMarks) {
            window.performance.clearMarks();
        }
        if (window.performance.clearMeasures) {
            window.performance.clearMeasures();
        }
        Object.keys(marks).forEach(key => delete marks[key]);
        Object.keys(measurements).forEach(key => delete measurements[key]);
    }

    /**
     * Check if performance monitoring is supported
     * @returns {boolean}
     */
    function isSupported() {
        return !!(window.performance && window.performance.mark);
    }

    // Public API
    return {
        init,
        mark,
        measure,
        trackLibraryLoad,
        getMetrics,
        report,
        clear,
        isSupported
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.PerformanceMonitor = PerformanceMonitor;
}
