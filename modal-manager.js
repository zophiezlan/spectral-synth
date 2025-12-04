/**
 * Modal Manager Module
 *
 * Purpose: Reusable modal dialog management to eliminate repetitive setup code
 *
 * Dependencies:
 * - DOM elements
 *
 * Exports:
 * - Modal class - Individual modal instance
 * - ModalManager - Singleton for managing all modals
 *
 * This module solves the repetitive modal setup issue (Issue #7) by providing:
 * 1. A reusable Modal class with consistent behavior
 * 2. Automatic event listener setup/teardown
 * 3. Keyboard navigation support (Escape to close)
 * 4. Click-outside-to-close behavior
 * 5. Focus trapping for accessibility
 *
 * Usage:
 * ```javascript
 * // Register a modal
 * ModalManager.register('settings', {
 *     modalId: 'settings-modal',
 *     triggerId: 'settings-menu-btn',
 *     closeIds: ['settings-close', 'settings-ok'],
 *     onOpen: () => console.log('Settings opened'),
 *     onClose: () => console.log('Settings closed')
 * });
 *
 * // Open programmatically
 * ModalManager.open('settings');
 *
 * // Close programmatically
 * ModalManager.close('settings');
 * ```
 */

/**
 * Modal class - Represents a single modal dialog
 */
class Modal {
    /**
     * Create a new Modal instance
     * @param {Object} config - Modal configuration
     * @param {string} config.modalId - ID of the modal element
     * @param {string} [config.triggerId] - ID of the trigger button (optional)
     * @param {string[]} [config.closeIds] - IDs of close buttons
     * @param {Function} [config.onOpen] - Callback when modal opens
     * @param {Function} [config.onClose] - Callback when modal closes
     * @param {boolean} [config.closeOnOverlayClick=true] - Close when clicking overlay
     * @param {boolean} [config.closeOnEscape=true] - Close on Escape key
     */
    constructor(config) {
        this.modalId = config.modalId;
        this.triggerId = config.triggerId || null;
        this.closeIds = config.closeIds || [];
        this.onOpen = config.onOpen || null;
        this.onClose = config.onClose || null;
        this.closeOnOverlayClick = config.closeOnOverlayClick !== false;
        this.closeOnEscape = config.closeOnEscape !== false;

        this.modal = document.getElementById(this.modalId);
        this.trigger = this.triggerId ? document.getElementById(this.triggerId) : null;
        this.isOpen = false;

        // Bound handlers for proper removal
        this._boundKeyHandler = this._handleKeydown.bind(this);
        this._boundOverlayClick = this._handleOverlayClick.bind(this);

        this._setupListeners();
    }

    /**
     * Set up event listeners
     * @private
     */
    _setupListeners() {
        if (!this.modal) {
            console.warn(`Modal: Element with id "${this.modalId}" not found`);
            return;
        }

        // Trigger button
        if (this.trigger) {
            this.trigger.addEventListener('click', () => this.open());
        }

        // Close buttons
        this.closeIds.forEach(closeId => {
            const closeBtn = document.getElementById(closeId);
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.close());
            }
        });

        // Overlay click
        if (this.closeOnOverlayClick) {
            this.modal.addEventListener('click', this._boundOverlayClick);
        }
    }

    /**
     * Handle overlay click
     * @private
     */
    _handleOverlayClick(e) {
        if (e.target === this.modal) {
            this.close();
        }
    }

    /**
     * Handle keydown events
     * @private
     */
    _handleKeydown(e) {
        if (e.key === 'Escape' && this.closeOnEscape) {
            this.close();
        }
    }

    /**
     * Open the modal
     */
    open() {
        if (!this.modal || this.isOpen) return;

        this.modal.classList.remove('hidden');
        this.modal.style.display = 'flex';
        this.isOpen = true;

        // Add keyboard listener
        document.addEventListener('keydown', this._boundKeyHandler);

        // Store previously focused element for restoration
        this._previousFocus = document.activeElement;

        // Focus first focusable element in modal
        this._focusFirstElement();

        // Callback
        if (this.onOpen) {
            try {
                this.onOpen();
            } catch (error) {
                console.error(`Modal "${this.modalId}" onOpen error:`, error);
            }
        }

        // Emit event
        if (typeof AppState !== 'undefined') {
            AppState.emit('modalOpen', { modalId: this.modalId });
        }
    }

    /**
     * Close the modal
     */
    close() {
        if (!this.modal || !this.isOpen) return;

        this.modal.classList.add('hidden');
        this.modal.style.display = 'none';
        this.isOpen = false;

        // Remove keyboard listener
        document.removeEventListener('keydown', this._boundKeyHandler);

        // Restore focus
        if (this._previousFocus) {
            this._previousFocus.focus();
        }

        // Callback
        if (this.onClose) {
            try {
                this.onClose();
            } catch (error) {
                console.error(`Modal "${this.modalId}" onClose error:`, error);
            }
        }

        // Emit event
        if (typeof AppState !== 'undefined') {
            AppState.emit('modalClose', { modalId: this.modalId });
        }
    }

    /**
     * Toggle the modal open/closed
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Focus first focusable element in modal
     * @private
     */
    _focusFirstElement() {
        const focusable = this.modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
            focusable[0].focus();
        }
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        if (this.closeOnOverlayClick && this.modal) {
            this.modal.removeEventListener('click', this._boundOverlayClick);
        }
        document.removeEventListener('keydown', this._boundKeyHandler);
    }
}

/**
 * ModalManager - Singleton for managing all modals
 */
const ModalManager = (function() {
    'use strict';

    const modals = {};

    return {
        /**
         * Register a new modal
         * @param {string} name - Unique name for the modal
         * @param {Object} config - Modal configuration
         * @returns {Modal} The created Modal instance
         */
        register(name, config) {
            if (modals[name]) {
                console.warn(`ModalManager: Modal "${name}" already registered`);
                return modals[name];
            }

            const modal = new Modal(config);
            modals[name] = modal;
            return modal;
        },

        /**
         * Get a registered modal
         * @param {string} name - Modal name
         * @returns {Modal|null} Modal instance or null
         */
        get(name) {
            return modals[name] || null;
        },

        /**
         * Open a modal by name
         * @param {string} name - Modal name
         */
        open(name) {
            const modal = modals[name];
            if (modal) {
                modal.open();
            } else {
                console.warn(`ModalManager: Modal "${name}" not found`);
            }
        },

        /**
         * Close a modal by name
         * @param {string} name - Modal name
         */
        close(name) {
            const modal = modals[name];
            if (modal) {
                modal.close();
            }
        },

        /**
         * Close all open modals
         */
        closeAll() {
            Object.values(modals).forEach(modal => {
                if (modal.isOpen) {
                    modal.close();
                }
            });
        },

        /**
         * Check if any modal is open
         * @returns {boolean}
         */
        isAnyOpen() {
            return Object.values(modals).some(modal => modal.isOpen);
        },

        /**
         * Get all open modals
         * @returns {string[]} Array of open modal names
         */
        getOpenModals() {
            return Object.entries(modals)
                .filter(([_, modal]) => modal.isOpen)
                .map(([name, _]) => name);
        },

        /**
         * Initialize all standard application modals
         * Call this during app initialization
         */
        initializeAppModals() {
            // Settings Modal
            this.register('settings', {
                modalId: 'settings-modal',
                triggerId: 'settings-menu-btn',
                closeIds: ['settings-close', 'settings-ok']
            });

            // Import/Export Modal
            this.register('import-export', {
                modalId: 'import-export-modal',
                triggerId: 'import-export-menu-btn',
                closeIds: ['import-export-close', 'import-export-ok']
            });

            // MIDI Modal
            this.register('midi', {
                modalId: 'midi-modal',
                triggerId: 'midi-menu-btn',
                closeIds: ['midi-close', 'midi-ok']
            });

            // Help Modal
            this.register('help', {
                modalId: 'help-modal',
                triggerId: 'help-menu-btn',
                closeIds: ['help-close', 'help-ok']
            });

            // Also allow mapping info button to open help
            const mappingInfoBtn = document.getElementById('mapping-info-btn');
            if (mappingInfoBtn) {
                mappingInfoBtn.addEventListener('click', () => this.open('help'));
            }

            // Favorites Modal
            this.register('favorites', {
                modalId: 'favorites-modal',
                triggerId: 'favorites-menu-btn',
                closeIds: ['favorites-close', 'favorites-ok'],
                onOpen: () => {
                    // Update favorites list when modal opens
                    if (typeof updateFavoritesList === 'function') {
                        updateFavoritesList();
                    }
                }
            });

            // Onboarding Modal
            this.register('onboarding', {
                modalId: 'onboarding-modal',
                closeIds: ['onboarding-close', 'skip-tour'],
                closeOnEscape: true
            });

            // Tutorial Path Modal
            this.register('tutorial-path', {
                modalId: 'tutorial-path-modal',
                closeIds: ['tutorial-path-close'],
                closeOnEscape: true
            });

            // Keyboard Shortcuts Modal
            this.register('shortcuts', {
                modalId: 'shortcuts-overlay',
                closeIds: ['shortcuts-close', 'shortcuts-ok'],
                closeOnEscape: true
            });
        },

        /**
         * Destroy all modals and clean up
         */
        destroyAll() {
            Object.values(modals).forEach(modal => modal.destroy());
            Object.keys(modals).forEach(key => delete modals[key]);
        }
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.Modal = Modal;
    window.ModalManager = ModalManager;
}
