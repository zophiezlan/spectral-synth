/**
 * Keyboard Shortcuts Module
 *
 * Purpose: Centralized keyboard shortcut handling for the Spectral Synthesizer
 *
 * Dependencies:
 * - ModalManager (for shortcuts overlay)
 * - AppState (for state access)
 * - DOM elements (playButton, selectAllButton, etc.)
 *
 * Exports:
 * - KeyboardShortcuts singleton
 *
 * This module extracts keyboard shortcut functionality from app.js:
 * - Keyboard event handling
 * - Shortcut definitions and configuration
 * - Navigation shortcuts (arrow keys)
 * - Action shortcuts (space, a, c, etc.)
 * - Help overlay (? key)
 *
 * Usage:
 * ```javascript
 * // Initialize with action handlers
 * KeyboardShortcuts.init({
 *     onPlay: () => handlePlay(),
 *     onStop: () => handleStop(),
 *     onSelectAll: () => handleSelectAll(),
 *     onClearSelection: () => handleClearSelection(),
 *     onNavigate: (direction) => navigateSubstance(direction),
 *     onClearFilters: () => clearFilters()
 * });
 *
 * // Enable/disable shortcuts
 * KeyboardShortcuts.enable();
 * KeyboardShortcuts.disable();
 *
 * // Show help overlay
 * KeyboardShortcuts.showHelp();
 * ```
 */

const KeyboardShortcuts = (function() {
    'use strict';

    // Private state
    let isEnabled = false;
    let handlers = {};
    let boundKeyHandler = null;

    // Shortcut definitions
    const SHORTCUTS = {
        PLAY_STOP: ' ',           // Spacebar
        NAVIGATE_UP: 'ArrowUp',
        NAVIGATE_DOWN: 'ArrowDown',
        SELECT_ALL: 'a',
        CLEAR_SELECTION: 'c',
        CLEAR_FILTERS: 'Escape',
        SHOW_HELP: '?'
    };

    // Keys that should have default behavior prevented
    const PREVENT_DEFAULT_KEYS = [' ', 'ArrowUp', 'ArrowDown', 'Escape', 'a', 'c'];

    /**
     * Check if element is an input field
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} True if element is an input field
     * @private
     */
    function isInputField(element) {
        const tagName = element.tagName;
        return tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA';
    }

    /**
     * Handle keyboard events
     * @param {KeyboardEvent} e - Keyboard event
     * @private
     */
    function handleKeydown(e) {
        // Don't trigger shortcuts when typing in input fields
        if (isInputField(e.target)) {
            return;
        }

        // Show keyboard shortcuts help
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            e.preventDefault();
            showHelp();
            return;
        }

        // Prevent default for shortcuts we handle
        if (PREVENT_DEFAULT_KEYS.includes(e.key)) {
            e.preventDefault();
        }

        // Handle shortcuts
        switch (e.key) {
            case SHORTCUTS.PLAY_STOP:
                handlePlayStop();
                break;

            case SHORTCUTS.NAVIGATE_UP:
                if (handlers.onNavigate) {
                    handlers.onNavigate(-1);
                }
                break;

            case SHORTCUTS.NAVIGATE_DOWN:
                if (handlers.onNavigate) {
                    handlers.onNavigate(1);
                }
                break;

            case SHORTCUTS.SELECT_ALL:
                handleSelectAll();
                break;

            case SHORTCUTS.CLEAR_SELECTION:
                handleClearSelection();
                break;

            case SHORTCUTS.CLEAR_FILTERS:
                if (handlers.onClearFilters) {
                    handlers.onClearFilters();
                }
                break;
        }
    }

    /**
     * Handle play/stop shortcut
     * @private
     */
    function handlePlayStop() {
        const playButton = document.getElementById('play');
        if (playButton && !playButton.disabled) {
            // Check if currently playing via AppState or audioEngine
            const audioEngine = typeof AppState !== 'undefined'
                ? AppState.getAudioEngine()
                : window.audioEngine;

            if (audioEngine && audioEngine.getIsPlaying()) {
                if (handlers.onStop) handlers.onStop();
            } else {
                if (handlers.onPlay) handlers.onPlay();
            }
        }
    }

    /**
     * Handle select all shortcut
     * @private
     */
    function handleSelectAll() {
        const selectAllButton = document.getElementById('select-all');
        if (selectAllButton && !selectAllButton.disabled && handlers.onSelectAll) {
            handlers.onSelectAll();
        }
    }

    /**
     * Handle clear selection shortcut
     * @private
     */
    function handleClearSelection() {
        const clearSelectionButton = document.getElementById('clear-selection');
        if (clearSelectionButton && !clearSelectionButton.disabled && handlers.onClearSelection) {
            handlers.onClearSelection();
        }
    }

    /**
     * Show keyboard shortcuts help overlay
     */
    function showHelp() {
        // Use ModalManager if available
        if (typeof ModalManager !== 'undefined') {
            ModalManager.open('shortcuts');
        } else {
            // Fallback to direct DOM manipulation
            const shortcutsOverlay = document.getElementById('shortcuts-overlay');
            if (shortcutsOverlay) {
                shortcutsOverlay.style.display = 'flex';
            }
        }
    }

    /**
     * Hide keyboard shortcuts help overlay
     */
    function hideHelp() {
        if (typeof ModalManager !== 'undefined') {
            ModalManager.close('shortcuts');
        } else {
            const shortcutsOverlay = document.getElementById('shortcuts-overlay');
            if (shortcutsOverlay) {
                shortcutsOverlay.style.display = 'none';
            }
        }
    }

    return {
        /**
         * Initialize keyboard shortcuts
         * @param {Object} config - Handler configuration
         * @param {Function} [config.onPlay] - Play handler
         * @param {Function} [config.onStop] - Stop handler
         * @param {Function} [config.onSelectAll] - Select all handler
         * @param {Function} [config.onClearSelection] - Clear selection handler
         * @param {Function} [config.onNavigate] - Navigate handler (receives direction: -1 or 1)
         * @param {Function} [config.onClearFilters] - Clear filters handler
         */
        init(config = {}) {
            handlers = {
                onPlay: config.onPlay || null,
                onStop: config.onStop || null,
                onSelectAll: config.onSelectAll || null,
                onClearSelection: config.onClearSelection || null,
                onNavigate: config.onNavigate || null,
                onClearFilters: config.onClearFilters || null
            };

            // Create bound handler for cleanup
            boundKeyHandler = handleKeydown.bind(this);

            // Auto-enable
            this.enable();
        },

        /**
         * Enable keyboard shortcuts
         */
        enable() {
            if (isEnabled) return;

            document.addEventListener('keydown', boundKeyHandler);
            isEnabled = true;
        },

        /**
         * Disable keyboard shortcuts
         */
        disable() {
            if (!isEnabled) return;

            document.removeEventListener('keydown', boundKeyHandler);
            isEnabled = false;
        },

        /**
         * Check if shortcuts are enabled
         * @returns {boolean}
         */
        isEnabled() {
            return isEnabled;
        },

        /**
         * Show keyboard shortcuts help overlay
         */
        showHelp,

        /**
         * Hide keyboard shortcuts help overlay
         */
        hideHelp,

        /**
         * Update handlers
         * @param {Object} newHandlers - New handlers to merge
         */
        updateHandlers(newHandlers) {
            handlers = { ...handlers, ...newHandlers };
        },

        /**
         * Get shortcut definitions (for documentation/UI)
         * @returns {Object} Shortcut definitions
         */
        getShortcuts() {
            return {
                'Space': 'Play/Stop',
                '↑': 'Previous substance',
                '↓': 'Next substance',
                'A': 'Select all peaks',
                'C': 'Clear selection',
                'Esc': 'Clear filters',
                '?': 'Show this help'
            };
        },

        /**
         * Clean up event listeners
         */
        destroy() {
            this.disable();
            handlers = {};
            boundKeyHandler = null;
        }
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.KeyboardShortcuts = KeyboardShortcuts;
}
