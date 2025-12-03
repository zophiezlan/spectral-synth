/**
 * UI Utilities Module
 * 
 * Provides common UI utilities for the Spectral Synthesizer application:
 * - Loading overlay management
 * - Toast notifications
 * - Screen reader announcements
 * - Error handling
 */

// Utility: Loading overlay
export const LoadingOverlay = {
    show(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = overlay.querySelector('.loading-text');
        text.textContent = message;
        overlay.style.display = 'flex';
    },
    hide() {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = 'none';
    }
};

// Utility: Toast notifications (replaces alerts)
export const Toast = {
    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    error(message, duration = 5000) {
        this.show(message, 'error', duration);
    },

    success(message, duration = 3000) {
        this.show(message, 'success', duration);
    },

    warning(message, duration = 4000) {
        this.show(message, 'warning', duration);
    },

    info(message, duration = 3000) {
        this.show(message, 'info', duration);
    }
};

// Utility: Screen reader announcements
export const ScreenReader = {
    announce(message) {
        const status = document.getElementById('playback-status');
        if (status) {
            status.textContent = message;
            // Clear after 1 second to allow re-announcement
            setTimeout(() => status.textContent = '', 1000);
        }
    }
};

// Utility: Error handler
export const ErrorHandler = {
    handle(error, userMessage, options = {}) {
        console.error('Error:', error);

        const severity = options.severity || 'error';
        const showToast = options.showToast !== false;

        if (showToast) {
            Toast[severity](userMessage);
        }

        // Optionally rethrow
        if (options.rethrow) {
            throw error;
        }
    }
};

// Utility: iOS Safari audio context helper
const iOSAudioHelper = {
    isIOS() {
        return /iPhone|iPad|iPod/.test(navigator.userAgent);
    },

    async ensureAudioContext(audioEngine) {
        if (!audioEngine || !audioEngine.audioContext) {
            return;
        }

        if (audioEngine.audioContext.state === 'suspended') {
            try {
                await audioEngine.audioContext.resume();
                console.log('✓ Audio context resumed');
            } catch (error) {
                console.error('Failed to resume audio context:', error);
                throw error;
            }
        }
    }
};

// Utility: Browser compatibility checker
export const BrowserCompatibility = {
    check() {
        const required = {
            'Web Audio API': ('AudioContext' in window) || ('webkitAudioContext' in window),
            'Canvas API': !!document.createElement('canvas').getContext,
            'Fetch API': 'fetch' in window,
            'ES6 Classes': typeof (class {}) === 'function',
            'Async/Await': (async () => {}).constructor.name === 'AsyncFunction',
        };

        const unsupported = Object.entries(required)
            .filter(([name, supported]) => !supported)
            .map(([name]) => name);

        if (unsupported.length > 0) {
            return {
                compatible: false,
                unsupported: unsupported
            };
        }

        return { compatible: true, unsupported: [] };
    },

    showWarning(unsupportedFeatures) {
        const message = `Your browser is missing required features:\n\n${unsupportedFeatures.join('\n')}\n\nPlease use a modern browser (Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+).`;
        Toast.error(message, 10000); // Show for 10 seconds
        console.error('Unsupported features:', unsupportedFeatures);
    }
};

// Utility: Enhanced micro-interactions
export const MicroInteractions = {
    /**
     * Add pulse animation to element
     * @param {HTMLElement} element - Element to animate
     * @param {number} duration - Duration in milliseconds
     */
    pulse(element, duration = 2000) {
        element.classList.add('pulsing');
        setTimeout(() => {
            element.classList.remove('pulsing');
        }, duration);
    },

    /**
     * Add success celebration effect
     * @param {string} message - Success message
     */
    celebrate(message) {
        // Check if this is first time for this action
        const key = `celebration_${message.replace(/\s/g, '_')}`;

        if (!localStorage.getItem(key)) {
            Toast.success(`🎉 ${message}`, 4000);
            localStorage.setItem(key, 'true');
        } else {
            Toast.success(message, 3000);
        }
    },

    /**
     * Add ripple effect to button click
     * @param {MouseEvent} event - Click event
     */
    ripple(event) {
        const button = event.currentTarget;
        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();

        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple-effect');

        button.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    }
};

// Utility: Format time with dynamic units
export const TimeFormatter = {
    format(ms) {
        if (ms < 1000) {
            return `${Math.round(ms)} ms`;
        } else {
            return `${(ms / 1000).toFixed(2)} s`;
        }
    }
};
