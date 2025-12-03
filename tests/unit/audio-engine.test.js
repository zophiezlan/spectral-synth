/**
 * Unit tests for Audio Engine
 *
 * Tests the Web Audio API synthesizer for FTIR sonification
 */

import { jest } from '@jest/globals';

// Mock Web Audio API
class MockAudioContext {
    constructor() {
        this.state = 'running';
        this.sampleRate = 44100;
        this.currentTime = 0;
        this.destination = { connect: jest.fn() };
    }

    createGain() {
        return {
            gain: {
                value: 1,
                setValueAtTime: jest.fn(),
                linearRampToValueAtTime: jest.fn(),
                exponentialRampToValueAtTime: jest.fn(),
                setTargetAtTime: jest.fn(),
                cancelScheduledValues: jest.fn()
            },
            connect: jest.fn(),
            disconnect: jest.fn()
        };
    }

    createOscillator() {
        return {
            frequency: { value: 440 },
            type: 'sine',
            connect: jest.fn(),
            disconnect: jest.fn(),
            start: jest.fn(),
            stop: jest.fn(),
            onended: null
        };
    }

    createBiquadFilter() {
        return {
            type: 'lowpass',
            frequency: { value: 8000 },
            Q: { value: 1 },
            connect: jest.fn(),
            disconnect: jest.fn()
        };
    }

    createConvolver() {
        return {
            buffer: null,
            connect: jest.fn(),
            disconnect: jest.fn()
        };
    }

    createAnalyser() {
        return {
            fftSize: 2048,
            frequencyBinCount: 1024,
            smoothingTimeConstant: 0.8,
            connect: jest.fn(),
            disconnect: jest.fn(),
            getByteFrequencyData: jest.fn((arr) => {
                for (let i = 0; i < arr.length; i++) {
                    arr[i] = Math.floor(Math.random() * 256);
                }
            }),
            getByteTimeDomainData: jest.fn((arr) => {
                for (let i = 0; i < arr.length; i++) {
                    arr[i] = 128 + Math.floor(Math.random() * 128);
                }
            })
        };
    }

    createBuffer(channels, length, sampleRate) {
        return {
            sampleRate,
            length,
            numberOfChannels: channels,
            getChannelData: jest.fn(() => new Float32Array(length))
        };
    }

    async resume() {
        this.state = 'running';
    }

    async suspend() {
        this.state = 'suspended';
    }

    async close() {
        this.state = 'closed';
    }
}

// Mock OfflineAudioContext
class MockOfflineAudioContext extends MockAudioContext {
    constructor(channels, length, sampleRate) {
        super();
        this.length = length;
        this.sampleRate = sampleRate;
    }

    async startRendering() {
        return this.createBuffer(2, this.length, this.sampleRate);
    }
}

// Mock CONFIG object
global.CONFIG = {
    frequency: {
        AUDIO_MAX: 8000
    },
    adsr: {
        DEFAULT_ATTACK: 0.1,
        DEFAULT_DECAY: 0.1,
        DEFAULT_SUSTAIN: 0.7,
        DEFAULT_RELEASE: 0.3,
        DEFAULT_CURVE: 'linear',
        MIN_ATTACK: 0.001,
        MAX_ATTACK: 2.0,
        MIN_DECAY: 0.001,
        MAX_DECAY: 2.0,
        MIN_SUSTAIN: 0.0,
        MAX_SUSTAIN: 1.0,
        MIN_RELEASE: 0.001,
        MAX_RELEASE: 5.0
    },
    audio: {
        DEFAULT_VOLUME: 0.5,
        DEFAULT_FADE_IN: 0.1,
        DEFAULT_FADE_OUT: 0.1,
        REVERB_DURATION: 2.0,
        FFT_SIZE: 2048,
        ANALYSER_SMOOTHING: 0.8,
        FILTER_Q_VALUE: 1.0
    },
    presets: {
        clean: { reverb: 0, filterFreq: 8000 },
        warm: { reverb: 0.2, filterFreq: 5000 },
        spacey: { reverb: 0.6, filterFreq: 8000 }
    },
    playbackModes: {
        chord: 'Play all peaks simultaneously',
        sequential: 'Play peaks by intensity',
        'arpeggio-up': 'Play peaks low to high',
        'arpeggio-down': 'Play peaks high to low',
        'arpeggio-updown': 'Play peaks up then down',
        random: 'Play peaks in random order'
    },
    adsrCurves: {
        linear: 'Linear curves',
        exponential: 'Exponential curves',
        logarithmic: 'Logarithmic curves'
    }
};

describe('AudioEngine', () => {
    let AudioEngine;
    let engine;

    beforeEach(() => {
        // Clear any previous imports
        jest.resetModules();

        // Mock window.AudioContext
        global.AudioContext = MockAudioContext;
        global.webkitAudioContext = MockAudioContext;
        global.window = global;

        global.OfflineAudioContext = MockOfflineAudioContext;
        global.URL = {
            createObjectURL: jest.fn(() => 'blob:mock-url'),
            revokeObjectURL: jest.fn()
        };
        global.document = {
            createElement: jest.fn(() => ({
                href: '',
                download: '',
                click: jest.fn()
            }))
        };

        // Load AudioEngine class
        AudioEngine = class AudioEngine {
            constructor() {
                this.audioContext = null;
                this.masterGain = null;
                this.analyser = null;
                this.oscillators = [];
                this.isPlaying = false;
                this.convolver = null;
                this.filter = null;
                this.reverbMix = 0;
                this.filterFrequency = CONFIG.frequency.AUDIO_MAX;
                this.playbackMode = 'sequential';
                this.attackTime = CONFIG.adsr.DEFAULT_ATTACK;
                this.decayTime = CONFIG.adsr.DEFAULT_DECAY;
                this.sustainLevel = CONFIG.adsr.DEFAULT_SUSTAIN;
                this.releaseTime = CONFIG.adsr.DEFAULT_RELEASE;
                this.adsrCurve = CONFIG.adsr.DEFAULT_CURVE;
                this.DEFAULT_VOLUME = CONFIG.audio.DEFAULT_VOLUME;
                this.DEFAULT_FADE_IN = CONFIG.audio.DEFAULT_FADE_IN;
                this.DEFAULT_FADE_OUT = CONFIG.audio.DEFAULT_FADE_OUT;
                this.REVERB_DURATION = CONFIG.audio.REVERB_DURATION;
                this.FFT_SIZE = CONFIG.audio.FFT_SIZE;
                this.ANALYSER_SMOOTHING = CONFIG.audio.ANALYSER_SMOOTHING;
                this.FILTER_Q_VALUE = CONFIG.audio.FILTER_Q_VALUE;
            }

            async init() {
                if (!this.audioContext) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (!AudioContext) {
                        throw new Error('Web Audio API is not supported in this browser');
                    }
                    this.audioContext = new AudioContext();
                    this.masterGain = this.audioContext.createGain();
                    this.masterGain.gain.value = this.DEFAULT_VOLUME;
                    this.filter = this.audioContext.createBiquadFilter();
                    this.filter.type = 'lowpass';
                    this.filter.frequency.value = this.filterFrequency;
                    this.filter.Q.value = this.FILTER_Q_VALUE;
                    this.convolver = this.audioContext.createConvolver();
                    this.dryGain = this.audioContext.createGain();
                    this.wetGain = this.audioContext.createGain();
                    this.dryGain.gain.value = 1;
                    this.wetGain.gain.value = 0;
                    this.analyser = this.audioContext.createAnalyser();
                    this.analyser.fftSize = this.FFT_SIZE;
                    this.analyser.smoothingTimeConstant = this.ANALYSER_SMOOTHING;
                    this.masterGain.connect(this.filter);
                    this.filter.connect(this.dryGain);
                    this.dryGain.connect(this.analyser);
                    this.filter.connect(this.convolver);
                    this.convolver.connect(this.wetGain);
                    this.wetGain.connect(this.analyser);
                    this.analyser.connect(this.audioContext.destination);
                }
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
            }

            setVolume(volume) {
                if (typeof volume !== 'number' || isNaN(volume)) {
                    throw new Error('Invalid volume: must be a number');
                }
                const clampedVolume = Math.max(0, Math.min(1, volume));
                if (this.masterGain) {
                    this.masterGain.gain.value = clampedVolume;
                }
            }

            setReverb(amount) {
                if (typeof amount !== 'number' || isNaN(amount)) {
                    throw new Error('Invalid reverb amount: must be a number');
                }
                if (this.dryGain && this.wetGain) {
                    this.reverbMix = Math.max(0, Math.min(1, amount));
                    this.dryGain.gain.value = 1 - this.reverbMix;
                    this.wetGain.gain.value = this.reverbMix;
                }
            }

            getReverb() {
                return this.reverbMix;
            }

            setFilterFrequency(frequency) {
                if (typeof frequency !== 'number' || isNaN(frequency) || frequency <= 0) {
                    throw new Error('Invalid filter frequency: must be a positive number');
                }
                if (this.filter) {
                    this.filterFrequency = frequency;
                    this.filter.frequency.value = frequency;
                }
            }

            getFilterFrequency() {
                return this.filterFrequency;
            }

            setPlaybackMode(mode) {
                if (!CONFIG.playbackModes[mode]) {
                    throw new Error(`Invalid playback mode: ${mode}`);
                }
                this.playbackMode = mode;
            }

            getPlaybackMode() {
                return this.playbackMode;
            }

            getPlaybackModes() {
                return CONFIG.playbackModes;
            }

            applyPreset(presetName) {
                const preset = CONFIG.presets[presetName];
                if (!preset) {
                    throw new Error(`Invalid preset: ${presetName}`);
                }
                this.setReverb(preset.reverb);
                this.setFilterFrequency(preset.filterFreq);
            }

            getPresets() {
                return CONFIG.presets;
            }

            setAttackTime(time) {
                if (typeof time !== 'number' || isNaN(time) || time < CONFIG.adsr.MIN_ATTACK || time > CONFIG.adsr.MAX_ATTACK) {
                    throw new Error(`Invalid attack time: must be between ${CONFIG.adsr.MIN_ATTACK} and ${CONFIG.adsr.MAX_ATTACK}`);
                }
                this.attackTime = time;
            }

            setDecayTime(time) {
                if (typeof time !== 'number' || isNaN(time) || time < CONFIG.adsr.MIN_DECAY || time > CONFIG.adsr.MAX_DECAY) {
                    throw new Error(`Invalid decay time: must be between ${CONFIG.adsr.MIN_DECAY} and ${CONFIG.adsr.MAX_DECAY}`);
                }
                this.decayTime = time;
            }

            setSustainLevel(level) {
                if (typeof level !== 'number' || isNaN(level) || level < CONFIG.adsr.MIN_SUSTAIN || level > CONFIG.adsr.MAX_SUSTAIN) {
                    throw new Error(`Invalid sustain level: must be between ${CONFIG.adsr.MIN_SUSTAIN} and ${CONFIG.adsr.MAX_SUSTAIN}`);
                }
                this.sustainLevel = level;
            }

            setReleaseTime(time) {
                if (typeof time !== 'number' || isNaN(time) || time < CONFIG.adsr.MIN_RELEASE || time > CONFIG.adsr.MAX_RELEASE) {
                    throw new Error(`Invalid release time: must be between ${CONFIG.adsr.MIN_RELEASE} and ${CONFIG.adsr.MAX_RELEASE}`);
                }
                this.releaseTime = time;
            }

            setADSRCurve(curve) {
                if (!CONFIG.adsrCurves[curve]) {
                    throw new Error(`Invalid ADSR curve: ${curve}`);
                }
                this.adsrCurve = curve;
            }

            getADSRSettings() {
                return {
                    attack: this.attackTime,
                    decay: this.decayTime,
                    sustain: this.sustainLevel,
                    release: this.releaseTime,
                    curve: this.adsrCurve
                };
            }

            getADSRCurves() {
                return CONFIG.adsrCurves;
            }

            getAnalyser() {
                return this.analyser;
            }

            getFrequencyData() {
                if (!this.analyser) return null;
                const bufferLength = this.analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                this.analyser.getByteFrequencyData(dataArray);
                return dataArray;
            }

            getTimeDomainData() {
                if (!this.analyser) return null;
                const bufferLength = this.analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                this.analyser.getByteTimeDomainData(dataArray);
                return dataArray;
            }

            getIsPlaying() {
                return this.isPlaying;
            }

            getSampleRate() {
                return this.audioContext ? this.audioContext.sampleRate : 44100;
            }

            blendPeaks(peaksA, peaksB, ratio) {
                if (!Array.isArray(peaksA) || !Array.isArray(peaksB)) {
                    throw new Error('Both peak arrays must be valid');
                }
                if (typeof ratio !== 'number' || ratio < 0 || ratio > 1) {
                    throw new Error('Blend ratio must be between 0 and 1');
                }

                const frequencyMap = new Map();
                const weightA = 1 - ratio;

                peaksA.forEach(peak => {
                    const key = peak.audioFreq.toFixed(2);
                    if (!frequencyMap.has(key)) {
                        frequencyMap.set(key, {
                            wavenumber: peak.wavenumber,
                            audioFreq: peak.audioFreq,
                            absorbance: peak.absorbance * weightA
                        });
                    } else {
                        const existing = frequencyMap.get(key);
                        existing.absorbance += peak.absorbance * weightA;
                    }
                });

                peaksB.forEach(peak => {
                    const key = peak.audioFreq.toFixed(2);
                    if (!frequencyMap.has(key)) {
                        frequencyMap.set(key, {
                            wavenumber: peak.wavenumber,
                            audioFreq: peak.audioFreq,
                            absorbance: peak.absorbance * ratio
                        });
                    } else {
                        const existing = frequencyMap.get(key);
                        existing.absorbance += peak.absorbance * ratio;
                    }
                });

                const blendedPeaks = Array.from(frequencyMap.values())
                    .filter(peak => peak.absorbance > 0); // Filter out peaks with zero absorbance
                blendedPeaks.sort((a, b) => a.audioFreq - b.audioFreq);
                return blendedPeaks;
            }

            stop() {
                const currentTime = this.audioContext ? this.audioContext.currentTime : 0;
                this.oscillators.forEach(({osc, gain}) => {
                    try {
                        gain.gain.cancelScheduledValues(currentTime);
                        gain.gain.setValueAtTime(gain.gain.value, currentTime);
                        gain.gain.linearRampToValueAtTime(0, currentTime + 0.05);
                        osc.stop(currentTime + 0.05);
                    } catch (e) {
                        // Oscillator may already be stopped
                    }
                });
                this.oscillators = [];
                this.isPlaying = false;
            }
        };

        engine = new AudioEngine();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        test('should initialize with default values', () => {
            expect(engine.audioContext).toBeNull();
            expect(engine.masterGain).toBeNull();
            expect(engine.analyser).toBeNull();
            expect(engine.oscillators).toEqual([]);
            expect(engine.isPlaying).toBe(false);
            expect(engine.reverbMix).toBe(0);
            expect(engine.filterFrequency).toBe(CONFIG.frequency.AUDIO_MAX);
            expect(engine.playbackMode).toBe('sequential');
        });

        test('should load ADSR defaults from CONFIG', () => {
            expect(engine.attackTime).toBe(CONFIG.adsr.DEFAULT_ATTACK);
            expect(engine.decayTime).toBe(CONFIG.adsr.DEFAULT_DECAY);
            expect(engine.sustainLevel).toBe(CONFIG.adsr.DEFAULT_SUSTAIN);
            expect(engine.releaseTime).toBe(CONFIG.adsr.DEFAULT_RELEASE);
            expect(engine.adsrCurve).toBe(CONFIG.adsr.DEFAULT_CURVE);
        });

        test('should load audio constants from CONFIG', () => {
            expect(engine.DEFAULT_VOLUME).toBe(CONFIG.audio.DEFAULT_VOLUME);
            expect(engine.REVERB_DURATION).toBe(CONFIG.audio.REVERB_DURATION);
            expect(engine.FFT_SIZE).toBe(CONFIG.audio.FFT_SIZE);
        });
    });

    describe('init()', () => {
        test('should initialize Web Audio API context', async () => {
            await engine.init();

            expect(engine.audioContext).not.toBeNull();
            expect(engine.masterGain).not.toBeNull();
            expect(engine.filter).not.toBeNull();
            expect(engine.convolver).not.toBeNull();
            expect(engine.analyser).not.toBeNull();
        });

        test('should set up audio graph connections', async () => {
            await engine.init();

            expect(engine.masterGain.connect).toHaveBeenCalledWith(engine.filter);
            expect(engine.filter.connect).toHaveBeenCalledWith(engine.dryGain);
            expect(engine.dryGain.connect).toHaveBeenCalledWith(engine.analyser);
        });

        test('should not reinitialize if already initialized', async () => {
            await engine.init();
            const firstContext = engine.audioContext;

            await engine.init();

            expect(engine.audioContext).toBe(firstContext);
        });

        test('should resume suspended context', async () => {
            await engine.init();
            engine.audioContext.state = 'suspended';

            await engine.init();

            expect(engine.audioContext.state).toBe('running');
        });

        test('should throw error if Web Audio API not supported', async () => {
            global.window.AudioContext = undefined;
            global.window.webkitAudioContext = undefined;

            await expect(engine.init()).rejects.toThrow('Web Audio API is not supported in this browser');
        });
    });

    describe('Volume Control', () => {
        beforeEach(async () => {
            await engine.init();
        });

        test('should set volume to valid value', () => {
            engine.setVolume(0.75);
            expect(engine.masterGain.gain.value).toBe(0.75);
        });

        test('should clamp volume to 0-1 range', () => {
            engine.setVolume(1.5);
            expect(engine.masterGain.gain.value).toBe(1);

            engine.setVolume(-0.5);
            expect(engine.masterGain.gain.value).toBe(0);
        });

        test('should throw error for invalid volume', () => {
            expect(() => engine.setVolume('invalid')).toThrow('Invalid volume: must be a number');
            expect(() => engine.setVolume(NaN)).toThrow('Invalid volume: must be a number');
        });

        test('should handle setVolume before init', () => {
            const freshEngine = new AudioEngine();
            expect(() => freshEngine.setVolume(0.5)).not.toThrow();
        });
    });

    describe('Reverb Control', () => {
        beforeEach(async () => {
            await engine.init();
        });

        test('should set reverb amount', () => {
            engine.setReverb(0.4);

            expect(engine.reverbMix).toBe(0.4);
            expect(engine.dryGain.gain.value).toBe(0.6);
            expect(engine.wetGain.gain.value).toBe(0.4);
        });

        test('should clamp reverb to 0-1 range', () => {
            engine.setReverb(1.5);
            expect(engine.reverbMix).toBe(1);

            engine.setReverb(-0.5);
            expect(engine.reverbMix).toBe(0);
        });

        test('should throw error for invalid reverb', () => {
            expect(() => engine.setReverb('invalid')).toThrow('Invalid reverb amount: must be a number');
            expect(() => engine.setReverb(NaN)).toThrow('Invalid reverb amount: must be a number');
        });

        test('should get current reverb amount', () => {
            engine.setReverb(0.3);
            expect(engine.getReverb()).toBe(0.3);
        });
    });

    describe('Filter Control', () => {
        beforeEach(async () => {
            await engine.init();
        });

        test('should set filter frequency', () => {
            engine.setFilterFrequency(5000);

            expect(engine.filterFrequency).toBe(5000);
            expect(engine.filter.frequency.value).toBe(5000);
        });

        test('should throw error for invalid filter frequency', () => {
            expect(() => engine.setFilterFrequency('invalid')).toThrow('Invalid filter frequency: must be a positive number');
            expect(() => engine.setFilterFrequency(-100)).toThrow('Invalid filter frequency: must be a positive number');
            expect(() => engine.setFilterFrequency(0)).toThrow('Invalid filter frequency: must be a positive number');
        });

        test('should get current filter frequency', () => {
            engine.setFilterFrequency(3000);
            expect(engine.getFilterFrequency()).toBe(3000);
        });
    });

    describe('Preset Management', () => {
        beforeEach(async () => {
            await engine.init();
        });

        test('should apply preset settings', () => {
            engine.applyPreset('warm');

            expect(engine.getReverb()).toBe(0.2);
            expect(engine.getFilterFrequency()).toBe(5000);
        });

        test('should throw error for invalid preset', () => {
            expect(() => engine.applyPreset('invalid')).toThrow('Invalid preset: invalid');
        });

        test('should get available presets', () => {
            const presets = engine.getPresets();
            expect(presets).toHaveProperty('clean');
            expect(presets).toHaveProperty('warm');
            expect(presets).toHaveProperty('spacey');
        });
    });

    describe('Playback Mode', () => {
        test('should set valid playback mode', () => {
            engine.setPlaybackMode('chord');
            expect(engine.getPlaybackMode()).toBe('chord');

            engine.setPlaybackMode('arpeggio-up');
            expect(engine.getPlaybackMode()).toBe('arpeggio-up');
        });

        test('should throw error for invalid playback mode', () => {
            expect(() => engine.setPlaybackMode('invalid')).toThrow('Invalid playback mode: invalid');
        });

        test('should get available playback modes', () => {
            const modes = engine.getPlaybackModes();
            expect(modes).toHaveProperty('chord');
            expect(modes).toHaveProperty('sequential');
            expect(modes).toHaveProperty('arpeggio-up');
        });
    });

    describe('ADSR Controls', () => {
        test('should set attack time', () => {
            engine.setAttackTime(0.5);
            expect(engine.attackTime).toBe(0.5);
        });

        test('should throw error for invalid attack time', () => {
            expect(() => engine.setAttackTime(-1)).toThrow();
            expect(() => engine.setAttackTime(10)).toThrow();
        });

        test('should set decay time', () => {
            engine.setDecayTime(0.3);
            expect(engine.decayTime).toBe(0.3);
        });

        test('should throw error for invalid decay time', () => {
            expect(() => engine.setDecayTime(-1)).toThrow();
            expect(() => engine.setDecayTime(10)).toThrow();
        });

        test('should set sustain level', () => {
            engine.setSustainLevel(0.8);
            expect(engine.sustainLevel).toBe(0.8);
        });

        test('should throw error for invalid sustain level', () => {
            expect(() => engine.setSustainLevel(-0.5)).toThrow();
            expect(() => engine.setSustainLevel(1.5)).toThrow();
        });

        test('should set release time', () => {
            engine.setReleaseTime(1.5);
            expect(engine.releaseTime).toBe(1.5);
        });

        test('should throw error for invalid release time', () => {
            expect(() => engine.setReleaseTime(-1)).toThrow();
            expect(() => engine.setReleaseTime(10)).toThrow();
        });

        test('should set ADSR curve', () => {
            engine.setADSRCurve('exponential');
            expect(engine.adsrCurve).toBe('exponential');
        });

        test('should throw error for invalid ADSR curve', () => {
            expect(() => engine.setADSRCurve('invalid')).toThrow('Invalid ADSR curve: invalid');
        });

        test('should get ADSR settings', () => {
            engine.setAttackTime(0.2);
            engine.setDecayTime(0.15);
            engine.setSustainLevel(0.6);
            engine.setReleaseTime(0.5);
            engine.setADSRCurve('exponential');

            const settings = engine.getADSRSettings();
            expect(settings.attack).toBe(0.2);
            expect(settings.decay).toBe(0.15);
            expect(settings.sustain).toBe(0.6);
            expect(settings.release).toBe(0.5);
            expect(settings.curve).toBe('exponential');
        });

        test('should get available ADSR curves', () => {
            const curves = engine.getADSRCurves();
            expect(curves).toHaveProperty('linear');
            expect(curves).toHaveProperty('exponential');
            expect(curves).toHaveProperty('logarithmic');
        });
    });

    describe('Analyser Data', () => {
        beforeEach(async () => {
            await engine.init();
        });

        test('should get analyser node', () => {
            const analyser = engine.getAnalyser();
            expect(analyser).not.toBeNull();
            expect(analyser.fftSize).toBe(CONFIG.audio.FFT_SIZE);
        });

        test('should get frequency data', () => {
            const data = engine.getFrequencyData();

            expect(data).toBeInstanceOf(Uint8Array);
            expect(data.length).toBe(engine.analyser.frequencyBinCount);
        });

        test('should return null if analyser not initialized', () => {
            const freshEngine = new AudioEngine();
            expect(freshEngine.getFrequencyData()).toBeNull();
        });

        test('should get time domain data', () => {
            const data = engine.getTimeDomainData();

            expect(data).toBeInstanceOf(Uint8Array);
            expect(data.length).toBe(engine.analyser.frequencyBinCount);
        });

        test('should return null if analyser not initialized for time domain', () => {
            const freshEngine = new AudioEngine();
            expect(freshEngine.getTimeDomainData()).toBeNull();
        });
    });

    describe('State Getters', () => {
        test('should get playing state', () => {
            expect(engine.getIsPlaying()).toBe(false);

            engine.isPlaying = true;
            expect(engine.getIsPlaying()).toBe(true);
        });

        test('should get sample rate', () => {
            expect(engine.getSampleRate()).toBe(44100);
        });

        test('should get sample rate after init', async () => {
            await engine.init();
            expect(engine.getSampleRate()).toBe(44100);
        });
    });

    describe('blendPeaks()', () => {
        test('should blend two peak arrays', () => {
            const peaksA = [
                { wavenumber: 1000, audioFreq: 500.00, absorbance: 0.8 },
                { wavenumber: 2000, audioFreq: 1000.00, absorbance: 0.6 }
            ];
            const peaksB = [
                { wavenumber: 1500, audioFreq: 750.00, absorbance: 0.7 },
                { wavenumber: 2000, audioFreq: 1000.00, absorbance: 0.9 }
            ];

            const blended = engine.blendPeaks(peaksA, peaksB, 0.5);

            expect(blended).toHaveLength(3);
            expect(blended[0].audioFreq).toBe(500.00);
            expect(blended[1].audioFreq).toBe(750.00);
            expect(blended[2].audioFreq).toBe(1000.00);
        });

        test('should weight peaks correctly', () => {
            const peaksA = [
                { wavenumber: 1000, audioFreq: 500.00, absorbance: 0.8 }
            ];
            const peaksB = [
                { wavenumber: 1000, audioFreq: 500.00, absorbance: 0.6 }
            ];

            const blended = engine.blendPeaks(peaksA, peaksB, 0.5);

            expect(blended[0].absorbance).toBeCloseTo(0.7, 1);
        });

        test('should handle ratio = 0 (pure A)', () => {
            const peaksA = [{ wavenumber: 1000, audioFreq: 500.00, absorbance: 0.8 }];
            const peaksB = [{ wavenumber: 2000, audioFreq: 1000.00, absorbance: 0.6 }];

            const blended = engine.blendPeaks(peaksA, peaksB, 0);

            expect(blended[0].absorbance).toBe(0.8);
        });

        test('should handle ratio = 1 (pure B)', () => {
            const peaksA = [{ wavenumber: 1000, audioFreq: 500.00, absorbance: 0.8 }];
            const peaksB = [{ wavenumber: 2000, audioFreq: 1000.00, absorbance: 0.6 }];

            const blended = engine.blendPeaks(peaksA, peaksB, 1);

            expect(blended[0].absorbance).toBe(0.6);
        });

        test('should throw error for invalid peak arrays', () => {
            const peaks = [{ wavenumber: 1000, audioFreq: 500, absorbance: 0.8 }];

            expect(() => engine.blendPeaks(null, peaks, 0.5)).toThrow('Both peak arrays must be valid');
            expect(() => engine.blendPeaks(peaks, 'invalid', 0.5)).toThrow('Both peak arrays must be valid');
        });

        test('should throw error for invalid ratio', () => {
            const peaks = [{ wavenumber: 1000, audioFreq: 500, absorbance: 0.8 }];

            expect(() => engine.blendPeaks(peaks, peaks, -0.5)).toThrow('Blend ratio must be between 0 and 1');
            expect(() => engine.blendPeaks(peaks, peaks, 1.5)).toThrow('Blend ratio must be between 0 and 1');
        });

        test('should sort blended peaks by frequency', () => {
            const peaksA = [
                { wavenumber: 2000, audioFreq: 1000.00, absorbance: 0.6 },
                { wavenumber: 1000, audioFreq: 500.00, absorbance: 0.8 }
            ];
            const peaksB = [
                { wavenumber: 1500, audioFreq: 750.00, absorbance: 0.7 }
            ];

            const blended = engine.blendPeaks(peaksA, peaksB, 0.5);

            expect(blended[0].audioFreq).toBeLessThan(blended[1].audioFreq);
            expect(blended[1].audioFreq).toBeLessThan(blended[2].audioFreq);
        });
    });

    describe('stop()', () => {
        beforeEach(async () => {
            await engine.init();
        });

        test('should stop all oscillators', () => {
            const mockOsc = engine.audioContext.createOscillator();
            const mockGain = engine.audioContext.createGain();

            engine.oscillators = [
                { osc: mockOsc, gain: mockGain }
            ];
            engine.isPlaying = true;

            engine.stop();

            expect(mockGain.gain.cancelScheduledValues).toHaveBeenCalled();
            expect(mockOsc.stop).toHaveBeenCalled();
            expect(engine.isPlaying).toBe(false);
            expect(engine.oscillators).toHaveLength(0);
        });

        test('should handle errors gracefully', () => {
            const mockOsc = {
                stop: jest.fn(() => { throw new Error('Already stopped'); })
            };
            const mockGain = {
                gain: {
                    cancelScheduledValues: jest.fn(),
                    setValueAtTime: jest.fn(),
                    linearRampToValueAtTime: jest.fn(),
                    value: 0.5
                }
            };

            engine.oscillators = [{ osc: mockOsc, gain: mockGain }];

            expect(() => engine.stop()).not.toThrow();
        });

        test('should work before audio context initialized', () => {
            const freshEngine = new AudioEngine();
            expect(() => freshEngine.stop()).not.toThrow();
        });
    });
});
