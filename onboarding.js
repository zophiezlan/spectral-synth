/**
 * Onboarding Module
 *
 * Purpose: Manages first-time user experience (Quick Start, Onboarding, Tutorial)
 *
 * Dependencies:
 * - ModalManager (for modal management)
 * - TutorialManager (for guided tour)
 * - localStorage (for persistence)
 *
 * Exports:
 * - Onboarding singleton
 *
 * This module extracts onboarding-related functionality from app.js:
 * - Quick Start panel
 * - First-time user detection
 * - Onboarding modal
 * - Tutorial path selection
 * - Peak selection hints
 *
 * Usage:
 * ```javascript
 * // Initialize onboarding (call during app init)
 * Onboarding.init();
 *
 * // Check and show appropriate first-time experience
 * Onboarding.checkAndShow();
 *
 * // Start guided tour
 * Onboarding.startTour();
 *
 * // Show hints
 * Onboarding.showPeakSelectionHint();
 * ```
 */

const Onboarding = (function() {
    'use strict';

    // Storage keys
    const STORAGE_KEYS = {
        QUICK_START_COMPLETED: 'quick-start-completed',
        ONBOARDING_COMPLETED: 'onboarding-completed',
        PEAK_SELECTION_HINT_SEEN: 'peak-selection-hint-seen',
    };

    // Timing constants
    const TIMING = {
        INITIAL_DELAY: 500,       // ms before showing first-time UI
        HINT_DELAY: 2000,         // ms before showing peak hint
        HINT_DURATION: 3000,      // ms for hint pulse animation
        SCROLL_DELAY: 300,        // ms before scrolling
        TOUR_START_DELAY: 500,    // ms before starting tour
    };

    // DOM element references
    let elements = null;

    /**
     * Cache DOM element references
     * @private
     */
    function cacheElements() {
        elements = {
            quickStartPanel: document.getElementById('quick-start-panel'),
            hideQuickStartBtn: document.getElementById('hide-quick-start'),
            tryCaffeineBtn: document.getElementById('try-caffeine'),
            startTourFromQuickstartBtn: document.getElementById('start-tour-from-quickstart'),
            onboardingModal: document.getElementById('onboarding-modal'),
            onboardingCloseBtn: document.getElementById('onboarding-close'),
            startTourBtn: document.getElementById('start-tour'),
            skipTourBtn: document.getElementById('skip-tour'),
            dontShowCheckbox: document.getElementById('dont-show-again'),
            tutorialPathModal: document.getElementById('tutorial-path-modal'),
            tutorialPathCloseBtn: document.getElementById('tutorial-path-close'),
            ftirCanvas: document.getElementById('ftir-canvas'),
            substanceSelect: document.getElementById('substance'),
            suggestionPills: document.querySelectorAll('.suggestion-pill'),
            pathCards: null, // Set dynamically
        };
    }

    /**
     * Check if user has seen quick start
     * @returns {boolean}
     */
    function hasSeenQuickStart() {
        return localStorage.getItem(STORAGE_KEYS.QUICK_START_COMPLETED) === 'true';
    }

    /**
     * Check if user has seen onboarding
     * @returns {boolean}
     */
    function hasSeenOnboarding() {
        return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED) === 'true';
    }

    /**
     * Check if user has seen peak selection hint
     * @returns {boolean}
     */
    function hasSeenPeakHint() {
        return localStorage.getItem(STORAGE_KEYS.PEAK_SELECTION_HINT_SEEN) === 'true';
    }

    /**
     * Mark quick start as completed
     */
    function markQuickStartComplete() {
        localStorage.setItem(STORAGE_KEYS.QUICK_START_COMPLETED, 'true');
    }

    /**
     * Mark onboarding as completed
     */
    function markOnboardingComplete() {
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
    }

    /**
     * Mark peak hint as seen
     */
    function markPeakHintSeen() {
        localStorage.setItem(STORAGE_KEYS.PEAK_SELECTION_HINT_SEEN, 'true');
    }

    /**
     * Show the quick start panel
     * @private
     */
    function showQuickStart() {
        if (elements.quickStartPanel) {
            elements.quickStartPanel.classList.remove('hidden');
        }
    }

    /**
     * Hide the quick start panel
     * @private
     */
    function hideQuickStart() {
        if (elements.quickStartPanel) {
            elements.quickStartPanel.classList.add('hidden');
        }
        markQuickStartComplete();
    }

    /**
     * Show the onboarding modal
     * @private
     */
    function showOnboardingModal() {
        if (typeof ModalManager !== 'undefined') {
            ModalManager.open('onboarding');
        } else if (elements.onboardingModal) {
            elements.onboardingModal.style.display = 'flex';
        }
    }

    /**
     * Hide the onboarding modal
     * @private
     */
    function hideOnboardingModal() {
        if (elements.dontShowCheckbox && elements.dontShowCheckbox.checked) {
            markOnboardingComplete();
        }

        if (typeof ModalManager !== 'undefined') {
            ModalManager.close('onboarding');
        } else if (elements.onboardingModal) {
            elements.onboardingModal.style.display = 'none';
        }
    }

    /**
     * Select substance by name (partial match)
     * @param {string} searchTerm - Substance name to search for
     */
    function selectSubstanceByName(searchTerm) {
        const libraryData = typeof AppState !== 'undefined'
            ? AppState.getLibraryData()
            : (typeof window.libraryData !== 'undefined' ? window.libraryData : null);

        if (!libraryData) return;

        const substance = libraryData.find(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (substance && elements.substanceSelect) {
            elements.substanceSelect.value = substance.id;
            // Trigger change handler
            if (typeof handleSubstanceChange === 'function') {
                handleSubstanceChange();
            }
            // Scroll to substance selector
            elements.substanceSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * Start the guided tour
     */
    function startGuidedTour() {
        // Show tutorial path selection modal
        if (typeof ModalManager !== 'undefined') {
            ModalManager.open('tutorial-path');
        } else if (elements.tutorialPathModal) {
            elements.tutorialPathModal.classList.remove('hidden');
            elements.tutorialPathModal.style.display = 'flex';
        }
    }

    /**
     * Setup tutorial path card handlers
     * @private
     */
    function setupPathCardHandlers() {
        if (!elements.tutorialPathModal) return;

        const pathCards = elements.tutorialPathModal.querySelectorAll('.tutorial-path-card');

        pathCards.forEach(card => {
            card.addEventListener('click', () => {
                const path = card.getAttribute('data-path');

                // Close path selection modal
                if (typeof ModalManager !== 'undefined') {
                    ModalManager.close('tutorial-path');
                } else {
                    elements.tutorialPathModal.classList.add('hidden');
                    elements.tutorialPathModal.style.display = 'none';
                }

                // Auto-select first substance for tour
                selectSubstanceByName('mdma');

                // Start tutorial with selected path
                setTimeout(() => {
                    if (typeof TutorialManager !== 'undefined') {
                        TutorialManager.start(path);
                    }
                }, TIMING.TOUR_START_DELAY);
            });
        });
    }

    /**
     * Set up event handlers for onboarding UI
     * @private
     */
    function setupEventHandlers() {
        // Quick Start panel
        if (elements.hideQuickStartBtn) {
            elements.hideQuickStartBtn.addEventListener('click', hideQuickStart);
        }

        if (elements.tryCaffeineBtn) {
            elements.tryCaffeineBtn.addEventListener('click', () => {
                hideQuickStart();
                selectSubstanceByName('caffeine');
                setTimeout(() => {
                    if (elements.substanceSelect) {
                        elements.substanceSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, TIMING.SCROLL_DELAY);
            });
        }

        if (elements.startTourFromQuickstartBtn) {
            elements.startTourFromQuickstartBtn.addEventListener('click', () => {
                hideQuickStart();
                startGuidedTour();
            });
        }

        // Onboarding modal
        if (elements.onboardingCloseBtn) {
            elements.onboardingCloseBtn.addEventListener('click', hideOnboardingModal);
        }

        if (elements.skipTourBtn) {
            elements.skipTourBtn.addEventListener('click', hideOnboardingModal);
        }

        if (elements.startTourBtn) {
            elements.startTourBtn.addEventListener('click', () => {
                hideOnboardingModal();
                startGuidedTour();
            });
        }

        // Suggestion pills in onboarding
        if (elements.suggestionPills) {
            elements.suggestionPills.forEach(pill => {
                pill.addEventListener('click', () => {
                    const substanceId = pill.getAttribute('data-substance-id');
                    hideOnboardingModal();
                    selectSubstanceByName(substanceId);
                });
            });
        }

        // Tutorial path modal close
        if (elements.tutorialPathCloseBtn) {
            elements.tutorialPathCloseBtn.addEventListener('click', () => {
                if (typeof ModalManager !== 'undefined') {
                    ModalManager.close('tutorial-path');
                } else if (elements.tutorialPathModal) {
                    elements.tutorialPathModal.classList.add('hidden');
                    elements.tutorialPathModal.style.display = 'none';
                }
            });
        }

        // Setup path card handlers
        setupPathCardHandlers();
    }

    return {
        /**
         * Initialize the onboarding module
         */
        init() {
            cacheElements();
            setupEventHandlers();
        },

        /**
         * Check and show appropriate first-time user experience
         */
        checkAndShow() {
            if (!hasSeenQuickStart() && !hasSeenOnboarding()) {
                // Show Quick Start for first-time users
                setTimeout(showQuickStart, TIMING.INITIAL_DELAY);
            } else if (!hasSeenOnboarding()) {
                // If they've seen Quick Start but not onboarding, show onboarding
                setTimeout(showOnboardingModal, TIMING.INITIAL_DELAY);
            }
        },

        /**
         * Show peak selection hint for first-time users
         */
        showPeakSelectionHint() {
            if (hasSeenPeakHint()) return;

            setTimeout(() => {
                // Add pulse animation to FTIR canvas
                if (elements.ftirCanvas) {
                    elements.ftirCanvas.classList.add('peak-hint-pulse');

                    // Remove pulse after duration
                    setTimeout(() => {
                        elements.ftirCanvas.classList.remove('peak-hint-pulse');
                    }, TIMING.HINT_DURATION);
                }

                // Show informative toast
                if (typeof Toast !== 'undefined') {
                    Toast.info('Tip: Click on peaks in the FTIR spectrum to select specific frequencies!', 5000);
                }

                // Mark as seen
                markPeakHintSeen();
            }, TIMING.HINT_DELAY);
        },

        /**
         * Start the guided tour
         */
        startTour: startGuidedTour,

        /**
         * Select substance by name
         * @param {string} name - Substance name
         */
        selectSubstance: selectSubstanceByName,

        /**
         * Reset onboarding state (for testing)
         */
        reset() {
            localStorage.removeItem(STORAGE_KEYS.QUICK_START_COMPLETED);
            localStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
            localStorage.removeItem(STORAGE_KEYS.PEAK_SELECTION_HINT_SEEN);
        },

        /**
         * Check if user is a first-time user
         * @returns {boolean}
         */
        isFirstTimeUser() {
            return !hasSeenQuickStart() && !hasSeenOnboarding();
        },
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.Onboarding = Onboarding;
}
