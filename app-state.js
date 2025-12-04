/**
 * Application State Manager Module
 *
 * Purpose: Centralized state management with pub/sub pattern
 *
 * Dependencies:
 * - None
 *
 * Exports:
 * - AppState singleton object
 *
 * This module solves the global state sprawl issue by providing:
 * 1. A single source of truth for application state
 * 2. Pub/sub pattern for reactive updates
 * 3. Type-safe state access and mutation
 * 4. Easy debugging with state change logging
 *
 * Usage:
 * ```javascript
 * // Subscribe to state changes
 * AppState.subscribe('spectrum', (newValue, oldValue) => {
 *     console.log('Spectrum changed:', newValue);
 * });
 *
 * // Update state (triggers subscribers)
 * AppState.set('spectrum', mySpectrumData);
 *
 * // Get current state
 * const spectrum = AppState.get('spectrum');
 *
 * // Batch updates (single notification)
 * AppState.batch(() => {
 *     AppState.set('spectrum', data);
 *     AppState.set('peaks', peaks);
 * });
 * ```
 */

const AppState = (function() {
    'use strict';

    // Private state container
    const state = {
        // Core module instances
        audioEngine: null,
        visualizer: null,
        frequencyMapper: null,
        midiOutput: null,

        // Current data
        currentSpectrum: null,
        currentPeaks: null,
        libraryData: null,

        // Filter state
        searchTerm: '',
        category: 'all',
        showFavoritesOnly: false,

        // UI state
        isPlaying: false,
        isInitialized: false,
        currentSubstanceId: null,
    };

    // Subscriber registry: { key: [callbacks] }
    const subscribers = {};

    // Wildcard subscribers (notified on any change)
    const wildcardSubscribers = [];

    // Batch update flag
    let isBatching = false;
    const pendingNotifications = new Set();

    /**
     * Notify subscribers of a state change
     * @param {string} key - State key that changed
     * @param {*} newValue - New value
     * @param {*} oldValue - Previous value
     */
    function notifySubscribers(key, newValue, oldValue) {
        if (isBatching) {
            pendingNotifications.add({ key, newValue, oldValue });
            return;
        }

        // Notify key-specific subscribers
        if (subscribers[key]) {
            subscribers[key].forEach(callback => {
                try {
                    callback(newValue, oldValue, key);
                } catch (error) {
                    console.error(`AppState subscriber error for "${key}":`, error);
                }
            });
        }

        // Notify wildcard subscribers
        wildcardSubscribers.forEach(callback => {
            try {
                callback(key, newValue, oldValue);
            } catch (error) {
                console.error('AppState wildcard subscriber error:', error);
            }
        });
    }

    /**
     * Flush pending notifications after batch
     */
    function flushPendingNotifications() {
        const notifications = Array.from(pendingNotifications);
        pendingNotifications.clear();

        notifications.forEach(({ key, newValue, oldValue }) => {
            notifySubscribers(key, newValue, oldValue);
        });
    }

    return {
        /**
         * Get a state value
         * @param {string} key - State key
         * @returns {*} State value
         */
        get(key) {
            if (!(key in state)) {
                console.warn(`AppState: Unknown state key "${key}"`);
                return undefined;
            }
            return state[key];
        },

        /**
         * Set a state value
         * @param {string} key - State key
         * @param {*} value - New value
         * @returns {boolean} Whether the value changed
         */
        set(key, value) {
            if (!(key in state)) {
                console.warn(`AppState: Unknown state key "${key}". Adding dynamically.`);
            }

            const oldValue = state[key];

            // Skip if value hasn't changed (shallow comparison)
            if (oldValue === value) {
                return false;
            }

            state[key] = value;
            notifySubscribers(key, value, oldValue);

            // Debug logging (can be disabled in production)
            if (typeof Logger !== 'undefined' && Logger.log) {
                Logger.log(`AppState: "${key}" changed`, { old: oldValue, new: value });
            }

            return true;
        },

        /**
         * Subscribe to state changes for a specific key
         * @param {string} key - State key to watch (use '*' for all changes)
         * @param {Function} callback - Function(newValue, oldValue, key)
         * @returns {Function} Unsubscribe function
         */
        subscribe(key, callback) {
            if (typeof callback !== 'function') {
                throw new Error('AppState.subscribe: callback must be a function');
            }

            if (key === '*') {
                wildcardSubscribers.push(callback);
                return () => {
                    const index = wildcardSubscribers.indexOf(callback);
                    if (index > -1) {
                        wildcardSubscribers.splice(index, 1);
                    }
                };
            }

            if (!subscribers[key]) {
                subscribers[key] = [];
            }
            subscribers[key].push(callback);

            // Return unsubscribe function
            return () => {
                const index = subscribers[key].indexOf(callback);
                if (index > -1) {
                    subscribers[key].splice(index, 1);
                }
            };
        },

        /**
         * Emit a custom event (not tied to state)
         * @param {string} event - Event name
         * @param {*} data - Event data
         */
        emit(event, data) {
            const eventKey = `event:${event}`;
            if (subscribers[eventKey]) {
                subscribers[eventKey].forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`AppState event error "${event}":`, error);
                    }
                });
            }
        },

        /**
         * Subscribe to a custom event
         * @param {string} event - Event name
         * @param {Function} callback - Event handler
         * @returns {Function} Unsubscribe function
         */
        on(event, callback) {
            return this.subscribe(`event:${event}`, callback);
        },

        /**
         * Batch multiple state updates into a single notification
         * @param {Function} updateFn - Function containing state updates
         */
        batch(updateFn) {
            isBatching = true;
            try {
                updateFn();
            } finally {
                isBatching = false;
                flushPendingNotifications();
            }
        },

        /**
         * Get all current state (for debugging)
         * @returns {Object} Copy of current state
         */
        getAll() {
            return { ...state };
        },

        /**
         * Reset state to initial values
         */
        reset() {
            this.batch(() => {
                this.set('currentSpectrum', null);
                this.set('currentPeaks', null);
                this.set('searchTerm', '');
                this.set('category', 'all');
                this.set('showFavoritesOnly', false);
                this.set('isPlaying', false);
                this.set('currentSubstanceId', null);
            });
        },

        /**
         * Initialize state with module instances
         * @param {Object} modules - { audioEngine, visualizer, frequencyMapper, midiOutput }
         */
        initModules(modules) {
            this.batch(() => {
                if (modules.audioEngine) this.set('audioEngine', modules.audioEngine);
                if (modules.visualizer) this.set('visualizer', modules.visualizer);
                if (modules.frequencyMapper) this.set('frequencyMapper', modules.frequencyMapper);
                if (modules.midiOutput) this.set('midiOutput', modules.midiOutput);
                this.set('isInitialized', true);
            });
        },

        /**
         * Convenience getters for common state
         */
        getAudioEngine() { return state.audioEngine; },
        getVisualizer() { return state.visualizer; },
        getFrequencyMapper() { return state.frequencyMapper; },
        getMidiOutput() { return state.midiOutput; },
        getCurrentSpectrum() { return state.currentSpectrum; },
        getCurrentPeaks() { return state.currentPeaks; },
        getLibraryData() { return state.libraryData; },
        isInitialized() { return state.isInitialized; },
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.AppState = AppState;
}
