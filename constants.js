/**
 * Application Constants Module
 *
 * Purpose: Centralized constants for the Spectral Synthesizer application
 *
 * Dependencies:
 * - None
 *
 * Exports:
 * - CONSTANTS object (frozen) containing all application constants
 *
 * Usage:
 * ```javascript
 * const maxDuration = CONSTANTS.AUDIO.MAX_DURATION;
 * const toastTime = CONSTANTS.TIMING.TOAST_DEFAULT;
 * ```
 *
 * Categories:
 * - TIMING: Debounce delays, toast durations, animations
 * - UI: Breakpoints, canvas sizes, touch targets
 * - FILE_LIMITS: Max file sizes for imports
 * - VALIDATION: Data validation ranges
 * - AUDIO: Audio parameters and limits
 * - MIDI: MIDI note and velocity ranges
 * - PERFORMANCE: RAF throttling, cache sizes
 * - CATEGORIES: Substance category identifiers
 * - STORAGE_KEYS: LocalStorage key names
 * - ERRORS: Standard error messages
 * - FEATURES: Feature flags
 *
 * Note: All values are frozen to prevent accidental modification.
 * This object reduces magic numbers and improves maintainability.
 */

const CONSTANTS = Object.freeze({
    // Timing constants (milliseconds)
    TIMING: {
        SEARCH_DEBOUNCE: 300,
        TOAST_DEFAULT: 3000,
        TOAST_SUCCESS: 3000,
        TOAST_WARNING: 4000,
        TOAST_ERROR: 5000,
        ANIMATION_FADE: 300,
        BUTTON_DISABLE_BUFFER: 100,
        PULSE_DURATION: 2000,
        RIPPLE_DURATION: 600,
        // Playback timing
        PLAYBACK_END_BUFFER: 100,     // Buffer after audio playback ends (ms)
        // Onboarding/Tutorial timing
        ONBOARDING_DELAY: 500,        // Delay before showing onboarding UI
        TUTORIAL_START_DELAY: 500,    // Delay before starting tutorial
        PEAK_HINT_DELAY: 2000,        // Delay before showing peak selection hint
        PEAK_HINT_DURATION: 3000,     // Duration of peak hint animation
        // UI animation delays
        SIDEBAR_CLOSE_DELAY: 300,     // Delay for sidebar close animation
        SCROLL_DELAY: 300,            // Delay before auto-scrolling to element
        MODAL_OPEN_DELAY: 100,        // Delay before modal opens after trigger
    },
    
    // UI constants
    UI: {
        MIN_TOUCH_TARGET: 44, // px - WCAG AA minimum
        MOBILE_BREAKPOINT: 768, // px
        TABLET_BREAKPOINT: 1024, // px
        // Canvas dimensions
        CANVAS_ASPECT_RATIO: 2, // width:height
        DEFAULT_CANVAS_WIDTH: 600, // px - default FTIR canvas width
        DEFAULT_CANVAS_HEIGHT: 300, // px - default FTIR canvas height
        MAX_CANVAS_WIDTH: 600, // px - maximum canvas width
        MOBILE_CANVAS_HEIGHT: 250, // px - mobile canvas height
        AUDIO_CANVAS_HEIGHT: 150, // px - audio visualization canvas height
    },
    
    // File size limits (bytes)
    FILE_LIMITS: {
        CSV_MAX: 5 * 1024 * 1024, // 5MB
        JCAMP_MAX: 10 * 1024 * 1024, // 10MB
        LIBRARY_MAX: 20 * 1024 * 1024, // 20MB
    },
    
    // Data validation
    VALIDATION: {
        MIN_SPECTRUM_POINTS: 10,
        MAX_SPECTRUM_POINTS: 10000,
        MIN_WAVENUMBER: 200,
        MAX_WAVENUMBER: 5000,
        MIN_TRANSMITTANCE: 0,
        MAX_TRANSMITTANCE: 100,
    },
    
    // Audio constants
    AUDIO: {
        MIN_FREQUENCY: 20, // Hz
        MAX_FREQUENCY: 20000, // Hz
        SAMPLE_RATE: 44100, // Hz
        MIN_DURATION: 0.1, // seconds
        MAX_DURATION: 10, // seconds
        DEFAULT_DURATION: 2, // seconds
        FADE_IN_TIME: 0.05, // seconds
        FADE_OUT_TIME: 0.1, // seconds
    },
    
    // MIDI constants
    MIDI: {
        MIN_NOTE: 0,
        MAX_NOTE: 127,
        MIN_VELOCITY: 0,
        MAX_VELOCITY: 127,
        DEFAULT_VELOCITY: 100,
        DEFAULT_TEMPO: 120, // BPM
        NOTE_DURATION: 500, // ms
    },
    
    // Performance constants
    PERFORMANCE: {
        RAF_THROTTLE: 16, // ~60fps
        RESIZE_DEBOUNCE: 250, // ms
        SCROLL_THROTTLE: 100, // ms
        MAX_CACHE_SIZE: 50, // items
    },
    
    // Categories for substance filtering
    CATEGORIES: {
        ALL: 'all',
        OPIOIDS: 'opioids',
        STIMULANTS: 'stimulants',
        BENZODIAZEPINES: 'benzodiazepines',
        PSYCHEDELICS: 'psychedelics',
        CANNABINOIDS: 'cannabinoids',
        STEROIDS: 'steroids',
        OTHER: 'other',
    },
    
    // Comparison mode
    COMPARISON: {
        BLEND_MIN: 0,
        BLEND_MAX: 100,
        BLEND_DEFAULT: 50,
    },
    
    // Storage keys
    STORAGE_KEYS: {
        FAVORITES: 'spectral-synth-favorites',
        THEME: 'spectral-synth-theme',
        TUTORIAL_COMPLETED: 'tutorial-completed',
        TUTORIAL_PROGRESS: 'tutorial-progress',
        ONBOARDING_COMPLETED: 'onboarding-completed',
    },
    
    // Error messages
    ERRORS: {
        BROWSER_INCOMPATIBLE: 'Your browser does not support required features',
        LIBRARY_LOAD_FAILED: 'Failed to load FTIR library',
        AUDIO_INIT_FAILED: 'Failed to initialize audio engine',
        MIDI_NOT_SUPPORTED: 'MIDI not supported in this browser',
        NO_SUBSTANCE_SELECTED: 'Please select a substance first',
        FILE_TOO_LARGE: 'File is too large',
        INVALID_FILE_FORMAT: 'Invalid file format',
        EXPORT_FAILED: 'Failed to export file',
    },
    
    // Feature flags
    FEATURES: {
        ENABLE_TUTORIAL: true,
        ENABLE_MIDI: true,
        ENABLE_ANALYTICS: false,
        ENABLE_SERVICE_WORKER: true,
        ENABLE_FAVORITES: true,
        ENABLE_COMPARISON_MODE: true,
    },
});

// Make constants globally available but immutable
if (typeof window !== 'undefined') {
    window.CONSTANTS = CONSTANTS;
}
