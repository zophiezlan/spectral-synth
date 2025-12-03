/**
 * Performance Monitor Utility
 *
 * Tracks and reports Web Vitals and custom performance metrics
 * Provides insights into real-world application performance
 */

// Performance Monitor Module
// Storage for performance metrics
const metrics = {
    vitals: {},
    custom: {},
    marks: new Map(),
    measures: new Map()
};

// Configuration
const config = {
    enabled: true,
    reportToConsole: true,
    reportToAnalytics: false,
    analyticsEndpoint: null
};

/**
     * Initialize performance monitoring
     * @param {Object} options - Configuration options
     */
function init(options = {}) {
    Object.assign(config, options);

    if (!config.enabled) {
        return;
    }

    // Monitor Web Vitals if PerformanceObserver is supported
    if ('PerformanceObserver' in window) {
        observeLargestContentfulPaint();
        observeFirstInputDelay();
        observeCumulativeLayoutShift();
    }

    // Monitor page load metrics
    if ('performance' in window && 'timing' in window.performance) {
        measurePageLoad();
    }

    console.info('[PerformanceMonitor] Initialized');
}

/**
     * Observe Largest Contentful Paint (LCP)
     * Good: < 2.5s, Needs improvement: 2.5-4s, Poor: > 4s
     */
function observeLargestContentfulPaint() {
    try {
        const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];

            metrics.vitals.LCP = {
                value: lastEntry.renderTime || lastEntry.loadTime,
                rating: getRating(lastEntry.renderTime || lastEntry.loadTime, 2500, 4000),
                timestamp: Date.now()
            };

            reportMetric('LCP', metrics.vitals.LCP);
        });

        observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (error) {
        console.warn('[PerformanceMonitor] LCP observation failed:', error);
    }
}

/**
     * Observe First Input Delay (FID)
     * Good: < 100ms, Needs improvement: 100-300ms, Poor: > 300ms
     */
function observeFirstInputDelay() {
    try {
        const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();

            entries.forEach((entry) => {
                const delay = entry.processingStart - entry.startTime;

                metrics.vitals.FID = {
                    value: delay,
                    rating: getRating(delay, 100, 300),
                    timestamp: Date.now()
                };

                reportMetric('FID', metrics.vitals.FID);
            });
        });

        observer.observe({ entryTypes: ['first-input'] });
    } catch (error) {
        console.warn('[PerformanceMonitor] FID observation failed:', error);
    }
}

/**
     * Observe Cumulative Layout Shift (CLS)
     * Good: < 0.1, Needs improvement: 0.1-0.25, Poor: > 0.25
     */
function observeCumulativeLayoutShift() {
    try {
        let clsValue = 0;
        let sessionValue = 0;
        let sessionEntries = [];

        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                // Only count layout shifts without recent user input
                if (!entry.hadRecentInput) {
                    const firstSessionEntry = sessionEntries[0];
                    const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

                    // If the entry occurred less than 1 second after the previous entry and
                    // less than 5 seconds after the first entry in the session, include the entry in the current session
                    if (sessionValue &&
                            entry.startTime - lastSessionEntry.startTime < 1000 &&
                            entry.startTime - firstSessionEntry.startTime < 5000) {
                        sessionValue += entry.value;
                        sessionEntries.push(entry);
                    } else {
                        sessionValue = entry.value;
                        sessionEntries = [entry];
                    }

                    // If the current session value is larger than the current CLS value, update CLS
                    if (sessionValue > clsValue) {
                        clsValue = sessionValue;

                        metrics.vitals.CLS = {
                            value: clsValue,
                            rating: getRating(clsValue, 0.1, 0.25),
                            timestamp: Date.now()
                        };

                        reportMetric('CLS', metrics.vitals.CLS);
                    }
                }
            }
        });

        observer.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
        console.warn('[PerformanceMonitor] CLS observation failed:', error);
    }
}

/**
     * Measure page load metrics
     */
function measurePageLoad() {
    window.addEventListener('load', () => {
        setTimeout(() => {
            const timing = performance.timing;
            const navigation = performance.getEntriesByType('navigation')[0];

            // Calculate key metrics
            const metrics_calc = {
                // Time to First Byte
                TTFB: timing.responseStart - timing.requestStart,

                // DOM Content Loaded
                DOMContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,

                // Page Load Time
                loadTime: timing.loadEventEnd - timing.navigationStart,

                // DOM Interactive
                domInteractive: timing.domInteractive - timing.navigationStart,

                // Resource timing
                dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
                tcpConnection: timing.connectEnd - timing.connectStart,
                serverResponse: timing.responseEnd - timing.requestStart
            };

            Object.entries(metrics_calc).forEach(([name, value]) => {
                metrics.custom[name] = {
                    value,
                    timestamp: Date.now()
                };
            });

            reportMetric('PageLoad', metrics.custom);
        }, 0);
    });
}

/**
     * Get rating for a metric value
     * @param {number} value - Metric value
     * @param {number} goodThreshold - Threshold for "good" rating
     * @param {number} poorThreshold - Threshold for "poor" rating
     * @returns {string} Rating (good, needs-improvement, poor)
     */
function getRating(value, goodThreshold, poorThreshold) {
    if (value <= goodThreshold) {
        return 'good';
    }
    if (value <= poorThreshold) {
        return 'needs-improvement';
    }
    return 'poor';
}

/**
     * Report metric to console and/or analytics
     * @param {string} name - Metric name
     * @param {Object} data - Metric data
     */
function reportMetric(name, data) {
    if (config.reportToConsole) {
        const emoji = data.rating === 'good' ? '✅' :
            data.rating === 'needs-improvement' ? '⚠️' : '❌';

        if (typeof data.value === 'number') {
            console.log(`${emoji} [Performance] ${name}: ${Math.round(data.value)}ms (${data.rating || 'n/a'})`);
        } else {
            console.log(`${emoji} [Performance] ${name}:`, data);
        }
    }

    if (config.reportToAnalytics && config.analyticsEndpoint) {
        sendToAnalytics(name, data);
    }
}

/**
     * Send metric to analytics endpoint
     * @param {string} name - Metric name
     * @param {Object} data - Metric data
     */
function sendToAnalytics(name, data) {
    if (!config.analyticsEndpoint) {
        return;
    }

    try {
        navigator.sendBeacon(config.analyticsEndpoint, JSON.stringify({
            metric: name,
            data,
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: Date.now()
        }));
    } catch (error) {
        console.warn('[PerformanceMonitor] Failed to send analytics:', error);
    }
}

/**
     * Mark a custom performance point
     * @param {string} name - Mark name
     */
function mark(name) {
    if (!config.enabled) {
        return;
    }

    try {
        performance.mark(name);
        metrics.marks.set(name, performance.now());
    } catch (error) {
        console.warn('[PerformanceMonitor] Mark failed:', error);
    }
}

/**
     * Measure time between two marks
     * @param {string} name - Measure name
     * @param {string} startMark - Start mark name
     * @param {string} endMark - End mark name (optional, defaults to now)
     * @returns {number} Duration in milliseconds
     */
function measure(name, startMark, endMark = null) {
    if (!config.enabled) {
        return 0;
    }

    try {
        if (endMark) {
            performance.measure(name, startMark, endMark);
        } else {
            performance.measure(name, startMark);
        }

        const measure = performance.getEntriesByName(name, 'measure')[0];
        const duration = measure.duration;

        metrics.measures.set(name, duration);
        reportMetric(`Measure: ${name}`, { value: duration });

        return duration;
    } catch (error) {
        console.warn('[PerformanceMonitor] Measure failed:', error);
        return 0;
    }
}

/**
     * Get all collected metrics
     * @returns {Object} All metrics
     */
function getMetrics() {
    return {
        vitals: { ...metrics.vitals },
        custom: { ...metrics.custom },
        marks: Object.fromEntries(metrics.marks),
        measures: Object.fromEntries(metrics.measures)
    };
}

/**
     * Clear all metrics
     */
function clearMetrics() {
    metrics.vitals = {};
    metrics.custom = {};
    metrics.marks.clear();
    metrics.measures.clear();

    if ('performance' in window) {
        performance.clearMarks();
        performance.clearMeasures();
    }
}

/**
     * Get summary of Web Vitals
     * @returns {string} Summary text
     */
function getSummary() {
    const vitals = metrics.vitals;
    const lines = ['=== Web Vitals Summary ==='];

    if (vitals.LCP) {
        lines.push(`LCP: ${Math.round(vitals.LCP.value)}ms (${vitals.LCP.rating})`);
    }
    if (vitals.FID) {
        lines.push(`FID: ${Math.round(vitals.FID.value)}ms (${vitals.FID.rating})`);
    }
    if (vitals.CLS) {
        lines.push(`CLS: ${vitals.CLS.value.toFixed(3)} (${vitals.CLS.rating})`);
    }

    if (Object.keys(metrics.custom).length > 0) {
        lines.push('');
        lines.push('=== Custom Metrics ===');
        Object.entries(metrics.custom).forEach(([name, data]) => {
            lines.push(`${name}: ${Math.round(data.value)}ms`);
        });
    }

    return lines.join('\n');
}

// Export public API
export const PerformanceMonitor = {
    init,
    mark,
    measure,
    getMetrics,
    clearMetrics,
    getSummary,
    config
};
