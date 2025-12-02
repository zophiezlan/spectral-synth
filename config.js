/**
 * Configuration - Centralized application settings
 * 
 * This file contains all configurable parameters for the Spectral Synthesizer.
 * Adjust these values to customize the application behavior.
 */

const CONFIG = {
    // Frequency mapping parameters
    frequency: {
        // FTIR wavenumber range (cm⁻¹)
        IR_MIN: 400,
        IR_MAX: 4000,
        
        // Audio frequency range (Hz)
        AUDIO_MIN: 100,  // Start at 100Hz for better musicality
        AUDIO_MAX: 8000, // Cap at 8kHz for pleasant sounds
    },
    
    // Peak detection parameters
    peakDetection: {
        DEFAULT_THRESHOLD: 0.15,  // Minimum absorption intensity (0-1)
        DEFAULT_MAX_PEAKS: 20,    // Maximum number of peaks to extract
    },
    
    // Audio synthesis parameters
    audio: {
        DEFAULT_VOLUME: 0.3,         // Default master volume (0-1)
        DEFAULT_FADE_IN: 0.05,       // Fade in duration in seconds
        DEFAULT_FADE_OUT: 0.1,       // Fade out duration in seconds
        REVERB_DURATION: 2,          // Reverb impulse duration in seconds
        FFT_SIZE: 2048,              // FFT size for analyser
        ANALYSER_SMOOTHING: 0.8,     // Analyser smoothing time constant
        FILTER_Q_VALUE: 1,           // Filter Q value (resonance)
        DEFAULT_DURATION: 2.0,       // Default playback duration in seconds
        MIN_DURATION: 0.5,           // Minimum playback duration
        MAX_DURATION: 5.0,           // Maximum playback duration
    },
    
    // Visualization parameters
    visualization: {
        CLICK_RADIUS: 20,         // Pixels - radius for peak click detection
        PEAK_MARKER_SIZE: 8,      // Pixels - size of peak marker circles
        GRID_COLOR: '#333',       // Color for grid lines
        SPECTRUM_COLOR: '#8b5cf6', // Color for FTIR spectrum line
        PEAK_COLOR: '#ec4899',    // Color for peak markers
        SELECTED_PEAK_COLOR: '#10b981', // Color for selected peaks
    },
    
    // UI parameters
    ui: {
        DEBOUNCE_DELAY: 300,      // ms - delay for search input debouncing
        ANIMATION_BUFFER: 100,    // ms - extra time after audio stops for cleanup
    },
    
    // Library parameters
    library: {
        LIBRARY_FILE: 'ftir-library.json',  // Path to FTIR library JSON file
    },
    
    // Effect presets
    presets: {
        'clean': {
            name: 'Clean',
            description: 'No effects, pure synthesis',
            reverb: 0,
            filterFreq: 8000,
        },
        'ambient': {
            name: 'Ambient',
            description: 'Large reverb space',
            reverb: 0.7,
            filterFreq: 6000,
        },
        'warm': {
            name: 'Warm',
            description: 'Low-pass filter for warmth',
            reverb: 0.2,
            filterFreq: 2000,
        },
        'bright': {
            name: 'Bright',
            description: 'Full spectrum, light reverb',
            reverb: 0.15,
            filterFreq: 8000,
        },
        'underwater': {
            name: 'Underwater',
            description: 'Heavy filtering and reverb',
            reverb: 0.8,
            filterFreq: 800,
        },
        'cathedral': {
            name: 'Cathedral',
            description: 'Massive reverb space',
            reverb: 0.9,
            filterFreq: 5000,
        },
    },
    
    // Playback modes
    playbackModes: {
        'chord': {
            name: 'Chord',
            description: 'All peaks play simultaneously',
        },
        'arpeggio-up': {
            name: 'Arpeggio (Up)',
            description: 'Play peaks from low to high frequency',
        },
        'arpeggio-down': {
            name: 'Arpeggio (Down)',
            description: 'Play peaks from high to low frequency',
        },
        'arpeggio-updown': {
            name: 'Arpeggio (Up-Down)',
            description: 'Play peaks up then down',
        },
        'sequential': {
            name: 'Sequential',
            description: 'Play peaks in order of intensity',
        },
        'random': {
            name: 'Random',
            description: 'Play peaks in random order',
        },
    },
};

// Freeze config to prevent accidental modification
Object.freeze(CONFIG);
Object.freeze(CONFIG.frequency);
Object.freeze(CONFIG.peakDetection);
Object.freeze(CONFIG.audio);
Object.freeze(CONFIG.visualization);
Object.freeze(CONFIG.ui);
Object.freeze(CONFIG.library);
Object.freeze(CONFIG.presets);
Object.keys(CONFIG.presets).forEach(key => Object.freeze(CONFIG.presets[key]));
Object.freeze(CONFIG.playbackModes);
Object.keys(CONFIG.playbackModes).forEach(key => Object.freeze(CONFIG.playbackModes[key]));
