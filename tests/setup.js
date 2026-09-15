/**
 * Jest Test Setup
 *
 * Web Audio / File / URL mocks for the jsdom environment. Runs as native ESM
 * (see the --experimental-vm-modules flag in package.json).
 */

import { jest } from '@jest/globals';

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
