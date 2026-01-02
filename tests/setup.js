/**
 * Jest Test Setup
 *
 * Sets up global mocks and configuration required for testing
 * the Spectral Synthesizer modules.
 */

const fs = require('fs');
const path = require('path');

// Helper to load a module file
global.loadModule = (filename) => {
    const code = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
    eval(code);
};

// Mock CONFIG object (mimics config.js)
global.CONFIG = {
    frequency: {
        IR_MIN: 400,
        IR_MAX: 4000,
        AUDIO_MIN: 100,
        AUDIO_MAX: 8000,
    },
    peakDetection: {
        DEFAULT_THRESHOLD: 0.15,
        DEFAULT_MAX_PEAKS: 20,
    },
    audio: {
        DEFAULT_VOLUME: 0.3,
        DEFAULT_FADE_IN: 0.05,
        DEFAULT_FADE_OUT: 0.1,
        REVERB_DURATION: 2,
        FFT_SIZE: 2048,
        ANALYSER_SMOOTHING: 0.8,
        FILTER_Q_VALUE: 1,
        DEFAULT_DURATION: 2.0,
        MIN_DURATION: 0.5,
        MAX_DURATION: 5.0,
    },
    adsr: {
        DEFAULT_ATTACK: 0.05,
        DEFAULT_DECAY: 0.1,
        DEFAULT_SUSTAIN: 0.7,
        DEFAULT_RELEASE: 0.1,
        MIN_ATTACK: 0.001,
        MAX_ATTACK: 2.0,
        MIN_DECAY: 0.001,
        MAX_DECAY: 2.0,
        MIN_SUSTAIN: 0.0,
        MAX_SUSTAIN: 1.0,
        MIN_RELEASE: 0.001,
        MAX_RELEASE: 3.0,
        DEFAULT_CURVE: 'exponential',
    },
    adsrCurves: {
        'linear': { name: 'Linear', description: 'Straight line transition' },
        'exponential': { name: 'Exponential', description: 'Natural exponential curve' },
        'logarithmic': { name: 'Logarithmic', description: 'Smooth exponential curve' },
    },
    visualization: {
        CLICK_RADIUS: 20,
        PEAK_MARKER_SIZE: 8,
        GRID_COLOR: '#333',
        SPECTRUM_COLOR: '#8b5cf6',
        PEAK_COLOR: '#ec4899',
        SELECTED_PEAK_COLOR: '#10b981',
    },
    ui: {
        DEBOUNCE_DELAY: 300,
        ANIMATION_BUFFER: 100,
    },
    library: {
        LIBRARY_FILE: 'ftir-library.json',
    },
    presets: {
        'clean': { name: 'Clean', description: 'No effects', reverb: 0, filterFreq: 8000 },
        'ambient': { name: 'Ambient', description: 'Large reverb', reverb: 0.7, filterFreq: 6000 },
        'warm': { name: 'Warm', description: 'Low-pass filter', reverb: 0.2, filterFreq: 2000 },
    },
    playbackModes: {
        'chord': { name: 'Chord', description: 'All peaks play simultaneously' },
        'arpeggio-up': { name: 'Arpeggio (Up)', description: 'Low to high' },
        'sequential': { name: 'Sequential', description: 'By intensity' },
        'random': { name: 'Random', description: 'Random order' },
    },
    looping: {
        DEFAULT_LOOP_ENABLED: true,
    },
};

// Freeze CONFIG like in production
Object.freeze(global.CONFIG);
Object.keys(global.CONFIG).forEach(key => {
    if (typeof global.CONFIG[key] === 'object') {
        Object.freeze(global.CONFIG[key]);
    }
});

// Mock Logger object
global.Logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
};

// Mock Web Audio API
class MockAudioContext {
    constructor() {
        this.sampleRate = 44100;
        this.state = 'running';
        this.currentTime = 0;
    }

    createOscillator() {
        return {
            type: 'sine',
            frequency: { value: 440, setValueAtTime: jest.fn() },
            connect: jest.fn(),
            start: jest.fn(),
            stop: jest.fn(),
            disconnect: jest.fn(),
            onended: null,
        };
    }

    createGain() {
        return {
            gain: {
                value: 1,
                setValueAtTime: jest.fn(),
                linearRampToValueAtTime: jest.fn(),
                exponentialRampToValueAtTime: jest.fn(),
                setTargetAtTime: jest.fn(),
                cancelScheduledValues: jest.fn(),
            },
            connect: jest.fn(),
            disconnect: jest.fn(),
        };
    }

    createBiquadFilter() {
        return {
            type: 'lowpass',
            frequency: { value: 8000 },
            Q: { value: 1 },
            connect: jest.fn(),
            disconnect: jest.fn(),
        };
    }

    createConvolver() {
        return {
            buffer: null,
            connect: jest.fn(),
            disconnect: jest.fn(),
        };
    }

    createBuffer(channels, length, sampleRate) {
        return {
            numberOfChannels: channels,
            length,
            sampleRate,
            getChannelData: () => new Float32Array(length),
        };
    }

    createAnalyser() {
        return {
            fftSize: 2048,
            frequencyBinCount: 1024,
            smoothingTimeConstant: 0.8,
            getByteFrequencyData: jest.fn(arr => arr.fill(128)),
            getByteTimeDomainData: jest.fn(arr => arr.fill(128)),
            connect: jest.fn(),
            disconnect: jest.fn(),
        };
    }

    resume() {
        this.state = 'running';
        return Promise.resolve();
    }

    close() {
        this.state = 'closed';
        return Promise.resolve();
    }
}

class MockOfflineAudioContext extends MockAudioContext {
    constructor(channels, length, sampleRate) {
        super();
        this.channels = channels;
        this.length = length;
        this.sampleRate = sampleRate;
    }

    startRendering() {
        return Promise.resolve({
            numberOfChannels: this.channels,
            length: this.length,
            sampleRate: this.sampleRate,
            getChannelData: () => new Float32Array(this.length),
        });
    }
}

global.AudioContext = MockAudioContext;
global.webkitAudioContext = MockAudioContext;
global.OfflineAudioContext = MockOfflineAudioContext;

// Mock URL API
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock File API
global.File = class MockFile {
    constructor(parts, name, options = {}) {
        this.parts = parts;
        this.name = name;
        this.type = options.type || '';
        this.size = parts.reduce((acc, part) => acc + part.length, 0);
    }

    text() {
        return Promise.resolve(this.parts.join(''));
    }
};

// Reset mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
});
