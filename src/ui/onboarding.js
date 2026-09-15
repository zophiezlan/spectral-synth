/**
 * Onboarding
 *
 * First-visit quick-start banner, the welcome modal, and the guided-tour
 * path chooser that hands off to TutorialManager.
 */

import { ctx } from '../core/context.js';
import { Logger } from '../core/logger.js';
import { dom } from './dom.js';
import { TutorialManager } from './tutorial-manager.js';
import { selectSubstanceByName } from './substance-selection.js';

/**
 * Check if we should show Quick Start panel
 */
export function checkAndShowQuickStart() {
    const hasSeenQuickStart = localStorage.getItem('quick-start-completed');
    const hasSeenOnboarding = localStorage.getItem('onboarding-completed');

    // Show Quick Start if user hasn't seen it and hasn't seen onboarding
    if (!hasSeenQuickStart && !hasSeenOnboarding) {
        setTimeout(() => {
            const quickStartPanel = document.getElementById('quick-start-panel');
            if (quickStartPanel) {
                quickStartPanel.classList.remove('hidden');
            }
        }, 500);
    } else if (!hasSeenOnboarding) {
        // If they've seen Quick Start but not onboarding, show onboarding
        checkAndShowOnboarding();
    }

    setupQuickStartHandlers();
}

/**
 * Set up Quick Start panel event handlers
 */
export function setupQuickStartHandlers() {
    const hideButton = document.getElementById('hide-quick-start');
    const tryCaffeineButton = document.getElementById('try-caffeine');
    const startTourButton = document.getElementById('start-tour-from-quickstart');
    const quickStartPanel = document.getElementById('quick-start-panel');

    if (hideButton && quickStartPanel) {
        hideButton.addEventListener('click', () => {
            quickStartPanel.classList.add('hidden');
            localStorage.setItem('quick-start-completed', 'true');
        });
    }

    if (tryCaffeineButton) {
        tryCaffeineButton.addEventListener('click', () => {
            // Hide Quick Start panel
            if (quickStartPanel) {
                quickStartPanel.classList.add('hidden');
                localStorage.setItem('quick-start-completed', 'true');
            }

            // Select caffeine
            selectSubstanceByName('caffeine');

            // Scroll to substance selector
            setTimeout(() => {
                dom.substanceSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        });
    }

    if (startTourButton) {
        startTourButton.addEventListener('click', () => {
            // Hide Quick Start panel
            if (quickStartPanel) {
                quickStartPanel.classList.add('hidden');
                localStorage.setItem('quick-start-completed', 'true');
            }

            // Start the guided tour
            startGuidedTour();
        });
    }
}

/**
 * Check if we should show onboarding
 */
export function checkAndShowOnboarding() {
    const hasSeenOnboarding = localStorage.getItem('onboarding-completed');
    if (!hasSeenOnboarding) {
        setTimeout(() => {
            document.getElementById('onboarding-modal')?.classList.remove('hidden');
        }, 500);
    }
}

/**
 * Set up onboarding modal
 */
export function setupOnboarding() {
    const onboardingModal = document.getElementById('onboarding-modal');
    const closeButton = document.getElementById('onboarding-close');
    const startTourButton = document.getElementById('start-tour');
    const skipTourButton = document.getElementById('skip-tour');

    if (!onboardingModal || !closeButton || !startTourButton || !skipTourButton) {
        return;
    }

    // Close modal handlers
    const closeModal = () => {
        localStorage.setItem('onboarding-completed', 'true');
        onboardingModal.classList.add('hidden');
    };

    closeButton.addEventListener('click', closeModal);
    skipTourButton.addEventListener('click', closeModal);

    // Close on overlay click
    onboardingModal.addEventListener('click', (e) => {
        if (e.target === onboardingModal) {
            closeModal();
        }
    });

    // Start tour button
    startTourButton.addEventListener('click', () => {
        closeModal();
        startGuidedTour();
    });

    // Suggestion pill handlers
    const suggestionPills = document.querySelectorAll('.suggestion-pill');
    suggestionPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const substanceId = pill.getAttribute('data-substance-id');
            closeModal();
            selectSubstanceByName(substanceId);
        });
    });
}

/**
 * Start guided tour - shows path selection modal
 */
export function startGuidedTour() {
    const modal = document.getElementById('tutorial-path-modal');
    if (!modal) {
        Logger.error('Tutorial path modal not found');
        return;
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // Setup path selection handlers (only once)
    if (!modal.dataset.initialized) {
        const closeButton = document.getElementById('tutorial-path-close');
        const pathCards = modal.querySelectorAll('.tutorial-path-card');

        closeButton.addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }
        });

        pathCards.forEach(card => {
            card.addEventListener('click', () => {
                const path = card.getAttribute('data-path');
                modal.classList.add('hidden');
                modal.style.display = 'none';

                // Auto-select first substance for tour
                if (ctx.libraryData && ctx.libraryData.length > 0) {
                    selectSubstanceByName('mdma');
                }

                // Start tutorial with selected path
                setTimeout(() => {
                    TutorialManager.start(path);
                }, 500);
            });
        });

        modal.dataset.initialized = 'true';
    }
}
