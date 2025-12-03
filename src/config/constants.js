/**
 * Application Constants
 * 
 * Centralized constants for the Spectral Synthesizer application.
 * Reduces magic numbers and improves maintainability.
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
    },
    
    // UI constants
    UI: {
        MIN_TOUCH_TARGET: 44, // px - WCAG AA minimum
        MOBILE_BREAKPOINT: 768, // px
        TABLET_BREAKPOINT: 1024, // px
        CANVAS_ASPECT_RATIO: 2, // width:height
        MAX_CANVAS_WIDTH: 600, // px
        MOBILE_CANVAS_HEIGHT: 250, // px
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
