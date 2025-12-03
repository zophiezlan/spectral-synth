/**
 * Jest Test Setup
 *
 * Global setup for all tests
 */

// Mock Web Audio API
global.AudioContext = class AudioContext {
    constructor() {
        this.destination = {};
        this.currentTime = 0;
    }

    createOscillator() {
        return {
            frequency: { value: 440, setValueAtTime: () => {} },
            type: 'sine',
            connect: () => {},
            start: () => {},
            stop: () => {},
            disconnect: () => {}
        };
    }

    createGain() {
        return {
            gain: { value: 1, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
            connect: () => {},
            disconnect: () => {}
        };
    }

    createAnalyser() {
        return {
            fftSize: 2048,
            frequencyBinCount: 1024,
            smoothingTimeConstant: 0.8,
            connect: () => {},
            disconnect: () => {},
            getByteFrequencyData: () => {}
        };
    }

    createConvolver() {
        return {
            buffer: null,
            connect: () => {},
            disconnect: () => {}
        };
    }

    createBiquadFilter() {
        return {
            type: 'lowpass',
            frequency: { value: 1000, setValueAtTime: () => {} },
            Q: { value: 1 },
            connect: () => {},
            disconnect: () => {}
        };
    }

    createDynamicsCompressor() {
        return {
            threshold: { value: -24 },
            knee: { value: 30 },
            ratio: { value: 12 },
            attack: { value: 0.003 },
            release: { value: 0.25 },
            connect: () => {},
            disconnect: () => {}
        };
    }

    createBuffer(channels, length, sampleRate) {
        return {
            length,
            sampleRate,
            numberOfChannels: channels,
            getChannelData: () => new Float32Array(length)
        };
    }

    close() {
        return Promise.resolve();
    }
};

// Mock Canvas API
HTMLCanvasElement.prototype.getContext = function() {
    return {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: '',
        textBaseline: '',
        clearRect: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        arc: () => {},
        fillText: () => {},
        strokeText: () => {},
        measureText: () => ({ width: 0 }),
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        setLineDash: () => {},
        getLineDash: () => []
    };
};

// Mock localStorage
const localStorageMock = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
};
global.localStorage = localStorageMock;

// Suppress console warnings in tests
const originalWarn = console.warn;
const originalError = console.error;
global.console = {
    ...console,
    warn: (...args) => {}, // Suppress warnings
    error: (...args) => {} // Suppress errors
};
