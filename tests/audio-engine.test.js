/**
 * Unit Tests for AudioEngine Module
 *
 * Tests the Web Audio API-based synthesizer for FTIR spectral sonification.
 * Uses mocked Web Audio API from setup.js.
 */

const { loadBrowserModule } = require('./test-helpers');
const { AudioEngine } = loadBrowserModule('audio-engine.js', {
    window: {
        AudioContext: global.AudioContext,
        webkitAudioContext: global.webkitAudioContext,
    },
    AudioContext: global.AudioContext,
    webkitAudioContext: global.webkitAudioContext,
    OfflineAudioContext: global.OfflineAudioContext,
    URL: global.URL,
    document: {
        createElement: (tag) => ({
            click: jest.fn(),
            href: '',
            download: '',
        }),
    },
});

describe('AudioEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new AudioEngine();
    });

    afterEach(() => {
        if (engine.audioContext) {
            engine.stop();
        }
    });

    // Sample peaks for testing
    const samplePeaks = [
        { wavenumber: 1700, absorbance: 0.8, audioFreq: 2000 },
        { wavenumber: 2950, absorbance: 0.6, audioFreq: 4500 },
        { wavenumber: 3500, absorbance: 0.4, audioFreq: 6000 },
    ];

    describe('constructor', () => {
        it('should initialize with default values from CONFIG', () => {
            expect(engine.audioContext).toBeNull();
            expect(engine.isPlaying).toBe(false);
            expect(engine.playbackMode).toBe('sequential');
            expect(engine.reverbMix).toBe(0);
            expect(engine.filterFrequency).toBe(CONFIG.frequency.AUDIO_MAX);
        });

        it('should set ADSR defaults from CONFIG', () => {
            expect(engine.attackTime).toBe(CONFIG.adsr.DEFAULT_ATTACK);
            expect(engine.decayTime).toBe(CONFIG.adsr.DEFAULT_DECAY);
            expect(engine.sustainLevel).toBe(CONFIG.adsr.DEFAULT_SUSTAIN);
            expect(engine.releaseTime).toBe(CONFIG.adsr.DEFAULT_RELEASE);
            expect(engine.adsrCurve).toBe(CONFIG.adsr.DEFAULT_CURVE);
        });

        it('should set audio constants from CONFIG', () => {
            expect(engine.DEFAULT_VOLUME).toBe(CONFIG.audio.DEFAULT_VOLUME);
            expect(engine.REVERB_DURATION).toBe(CONFIG.audio.REVERB_DURATION);
            expect(engine.FFT_SIZE).toBe(CONFIG.audio.FFT_SIZE);
        });
    });

    describe('init', () => {
        it('should create audio context on first call', async () => {
            await engine.init();

            expect(engine.audioContext).not.toBeNull();
            expect(engine.masterGain).not.toBeNull();
            expect(engine.analyser).not.toBeNull();
            expect(engine.filter).not.toBeNull();
            expect(engine.convolver).not.toBeNull();
        });

        it('should be idempotent (safe to call multiple times)', async () => {
            await engine.init();
            const firstContext = engine.audioContext;

            await engine.init();
            expect(engine.audioContext).toBe(firstContext);
        });

        it('should resume suspended audio context', async () => {
            await engine.init();
            engine.audioContext.state = 'suspended';

            await engine.init();
            expect(engine.audioContext.state).toBe('running');
        });
    });

    describe('play', () => {
        it('should throw error for empty peaks array', async () => {
            await expect(engine.play([])).rejects.toThrow('Invalid peaks');
        });

        it('should throw error for non-array peaks', async () => {
            await expect(engine.play(null)).rejects.toThrow('Invalid peaks');
            await expect(engine.play('invalid')).rejects.toThrow('Invalid peaks');
        });

        it('should throw error for invalid duration', async () => {
            await expect(engine.play(samplePeaks, 0)).rejects.toThrow('Invalid duration');
            await expect(engine.play(samplePeaks, -1)).rejects.toThrow('Invalid duration');
            await expect(engine.play(samplePeaks, 'invalid')).rejects.toThrow('Invalid duration');
        });

        it('should set isPlaying to true when playing', async () => {
            await engine.play(samplePeaks, 1);
            expect(engine.isPlaying).toBe(true);
        });

        it('should stop previous playback before starting new', async () => {
            await engine.play(samplePeaks, 1);
            const stopSpy = jest.spyOn(engine, 'stop');

            await engine.play(samplePeaks, 1);
            expect(stopSpy).toHaveBeenCalled();
        });

        it('should use chord mode when playbackMode is chord', async () => {
            engine.playbackMode = 'chord';
            const chordSpy = jest.spyOn(engine, 'playChord');

            await engine.play(samplePeaks, 1);
            expect(chordSpy).toHaveBeenCalled();
        });

        it('should use arpeggio mode for non-chord modes', async () => {
            engine.playbackMode = 'arpeggio-up';
            const arpeggioSpy = jest.spyOn(engine, 'playArpeggio');

            await engine.play(samplePeaks, 1);
            expect(arpeggioSpy).toHaveBeenCalled();
        });
    });

    describe('stop', () => {
        it('should set isPlaying to false', async () => {
            await engine.play(samplePeaks, 1);
            engine.stop();

            expect(engine.isPlaying).toBe(false);
        });

        it('should clear oscillators array', async () => {
            await engine.play(samplePeaks, 1);
            engine.stop();

            expect(engine.oscillators).toHaveLength(0);
        });

        it('should be safe to call when not playing', () => {
            expect(() => engine.stop()).not.toThrow();
        });
    });

    describe('setVolume', () => {
        it('should set volume on master gain', async () => {
            await engine.init();
            engine.setVolume(0.5);

            expect(engine.masterGain.gain.value).toBe(0.5);
        });

        it('should clamp volume to valid range', async () => {
            await engine.init();

            engine.setVolume(2);
            expect(engine.masterGain.gain.value).toBe(1);

            engine.setVolume(-1);
            expect(engine.masterGain.gain.value).toBe(0);
        });

        it('should throw error for non-numeric input', () => {
            expect(() => engine.setVolume('loud')).toThrow('Invalid volume');
            expect(() => engine.setVolume(NaN)).toThrow('Invalid volume');
        });
    });

    describe('setReverb', () => {
        it('should set reverb mix', async () => {
            await engine.init();
            engine.setReverb(0.5);

            expect(engine.reverbMix).toBe(0.5);
            expect(engine.dryGain.gain.value).toBe(0.5);
            expect(engine.wetGain.gain.value).toBe(0.5);
        });

        it('should clamp reverb to valid range', async () => {
            await engine.init();

            engine.setReverb(2);
            expect(engine.reverbMix).toBe(1);

            engine.setReverb(-0.5);
            expect(engine.reverbMix).toBe(0);
        });

        it('should throw error for non-numeric input', () => {
            expect(() => engine.setReverb('wet')).toThrow('Invalid reverb');
        });
    });

    describe('getReverb', () => {
        it('should return current reverb mix', async () => {
            await engine.init();
            engine.setReverb(0.7);

            expect(engine.getReverb()).toBe(0.7);
        });
    });

    describe('setFilterFrequency', () => {
        it('should set filter frequency', async () => {
            await engine.init();
            engine.setFilterFrequency(4000);

            expect(engine.filterFrequency).toBe(4000);
            expect(engine.filter.frequency.value).toBe(4000);
        });

        it('should throw error for non-positive values', () => {
            expect(() => engine.setFilterFrequency(0)).toThrow('Invalid filter frequency');
            expect(() => engine.setFilterFrequency(-100)).toThrow('Invalid filter frequency');
        });

        it('should throw error for non-numeric input', () => {
            expect(() => engine.setFilterFrequency('high')).toThrow('Invalid filter frequency');
        });
    });

    describe('getFilterFrequency', () => {
        it('should return current filter frequency', () => {
            engine.filterFrequency = 5000;
            expect(engine.getFilterFrequency()).toBe(5000);
        });
    });

    describe('ADSR controls', () => {
        describe('setAttackTime', () => {
            it('should set attack time', () => {
                engine.setAttackTime(0.1);
                expect(engine.attackTime).toBe(0.1);
            });

            it('should throw for values outside valid range', () => {
                expect(() => engine.setAttackTime(-1)).toThrow('Invalid attack time');
                expect(() => engine.setAttackTime(5)).toThrow('Invalid attack time');
            });

            it('should throw for non-numeric input', () => {
                expect(() => engine.setAttackTime('fast')).toThrow('Invalid attack time');
            });
        });

        describe('setDecayTime', () => {
            it('should set decay time', () => {
                engine.setDecayTime(0.2);
                expect(engine.decayTime).toBe(0.2);
            });

            it('should throw for values outside valid range', () => {
                expect(() => engine.setDecayTime(-1)).toThrow('Invalid decay time');
                expect(() => engine.setDecayTime(5)).toThrow('Invalid decay time');
            });
        });

        describe('setSustainLevel', () => {
            it('should set sustain level', () => {
                engine.setSustainLevel(0.5);
                expect(engine.sustainLevel).toBe(0.5);
            });

            it('should throw for values outside valid range', () => {
                expect(() => engine.setSustainLevel(-0.5)).toThrow('Invalid sustain level');
                expect(() => engine.setSustainLevel(1.5)).toThrow('Invalid sustain level');
            });
        });

        describe('setReleaseTime', () => {
            it('should set release time', () => {
                engine.setReleaseTime(0.3);
                expect(engine.releaseTime).toBe(0.3);
            });

            it('should throw for values outside valid range', () => {
                expect(() => engine.setReleaseTime(-1)).toThrow('Invalid release time');
                expect(() => engine.setReleaseTime(5)).toThrow('Invalid release time');
            });
        });

        describe('setADSRCurve', () => {
            it('should set curve type', () => {
                engine.setADSRCurve('linear');
                expect(engine.adsrCurve).toBe('linear');
            });

            it('should throw for invalid curve type', () => {
                expect(() => engine.setADSRCurve('invalid')).toThrow('Invalid ADSR curve');
            });
        });

        describe('getADSRSettings', () => {
            it('should return current ADSR settings', () => {
                engine.setAttackTime(0.1);
                engine.setDecayTime(0.2);
                engine.setSustainLevel(0.5);
                engine.setReleaseTime(0.3);
                engine.setADSRCurve('linear');

                const settings = engine.getADSRSettings();

                expect(settings.attack).toBe(0.1);
                expect(settings.decay).toBe(0.2);
                expect(settings.sustain).toBe(0.5);
                expect(settings.release).toBe(0.3);
                expect(settings.curve).toBe('linear');
            });
        });

        describe('getADSRCurves', () => {
            it('should return available curves from CONFIG', () => {
                const curves = engine.getADSRCurves();
                expect(curves).toBe(CONFIG.adsrCurves);
            });
        });
    });

    describe('presets', () => {
        describe('applyPreset', () => {
            it('should apply preset values', async () => {
                await engine.init();
                engine.applyPreset('ambient');

                expect(engine.reverbMix).toBe(CONFIG.presets.ambient.reverb);
                expect(engine.filterFrequency).toBe(CONFIG.presets.ambient.filterFreq);
            });

            it('should throw for invalid preset name', () => {
                expect(() => engine.applyPreset('invalid')).toThrow('Invalid preset');
            });
        });

        describe('getPresets', () => {
            it('should return available presets from CONFIG', () => {
                const presets = engine.getPresets();
                expect(presets).toBe(CONFIG.presets);
            });
        });
    });

    describe('playback modes', () => {
        describe('setPlaybackMode', () => {
            it('should set playback mode', () => {
                engine.setPlaybackMode('chord');
                expect(engine.playbackMode).toBe('chord');

                engine.setPlaybackMode('arpeggio-up');
                expect(engine.playbackMode).toBe('arpeggio-up');
            });

            it('should throw for invalid mode', () => {
                expect(() => engine.setPlaybackMode('invalid')).toThrow('Invalid playback mode');
            });
        });

        describe('getPlaybackMode', () => {
            it('should return current playback mode', () => {
                engine.playbackMode = 'random';
                expect(engine.getPlaybackMode()).toBe('random');
            });
        });

        describe('getPlaybackModes', () => {
            it('should return available modes from CONFIG', () => {
                const modes = engine.getPlaybackModes();
                expect(modes).toBe(CONFIG.playbackModes);
            });
        });
    });

    describe('blendPeaks', () => {
        const peaksA = [
            { wavenumber: 1000, absorbance: 0.8, audioFreq: 1000 },
            { wavenumber: 2000, absorbance: 0.6, audioFreq: 2000 },
        ];

        const peaksB = [
            { wavenumber: 1500, absorbance: 0.7, audioFreq: 1500 },
            { wavenumber: 2500, absorbance: 0.5, audioFreq: 2500 },
        ];

        it('should blend peaks with given ratio', () => {
            const blended = engine.blendPeaks(peaksA, peaksB, 0.5);

            expect(blended.length).toBe(4);  // All unique frequencies
        });

        it('should weight peaks based on ratio', () => {
            // ratio = 0 means pure A
            const pureA = engine.blendPeaks(peaksA, peaksB, 0);
            const peakA = pureA.find(p => p.audioFreq === 1000);
            expect(peakA.absorbance).toBe(0.8);

            // ratio = 1 means pure B
            const pureB = engine.blendPeaks(peaksA, peaksB, 1);
            const peakB = pureB.find(p => p.audioFreq === 1500);
            expect(peakB.absorbance).toBe(0.7);
        });

        it('should throw for invalid peak arrays', () => {
            expect(() => engine.blendPeaks(null, peaksB, 0.5)).toThrow('Both peak arrays must be valid');
            expect(() => engine.blendPeaks(peaksA, 'invalid', 0.5)).toThrow('Both peak arrays must be valid');
        });

        it('should throw for invalid ratio', () => {
            expect(() => engine.blendPeaks(peaksA, peaksB, -0.5)).toThrow('Blend ratio must be between');
            expect(() => engine.blendPeaks(peaksA, peaksB, 1.5)).toThrow('Blend ratio must be between');
            expect(() => engine.blendPeaks(peaksA, peaksB, 'half')).toThrow('Blend ratio must be between');
        });

        it('should sort blended peaks by frequency', () => {
            const blended = engine.blendPeaks(peaksA, peaksB, 0.5);

            for (let i = 1; i < blended.length; i++) {
                expect(blended[i].audioFreq).toBeGreaterThanOrEqual(blended[i - 1].audioFreq);
            }
        });

        it('should combine peaks at similar frequencies', () => {
            const overlapping = [
                { wavenumber: 1000, absorbance: 0.5, audioFreq: 1000 },
            ];
            const same = [
                { wavenumber: 1000, absorbance: 0.5, audioFreq: 1000 },
            ];

            const blended = engine.blendPeaks(overlapping, same, 0.5);

            // Should combine into single peak
            expect(blended.length).toBe(1);
            expect(blended[0].absorbance).toBeCloseTo(0.5);  // 0.5*0.5 + 0.5*0.5
        });
    });

    describe('getAnalyser', () => {
        it('should return analyser node after init', async () => {
            await engine.init();
            expect(engine.getAnalyser()).toBe(engine.analyser);
        });

        it('should return null before init', () => {
            expect(engine.getAnalyser()).toBeNull();
        });
    });

    describe('getFrequencyData', () => {
        it('should return frequency data array after init', async () => {
            await engine.init();
            const data = engine.getFrequencyData();

            expect(data).toBeInstanceOf(Uint8Array);
            expect(data.length).toBe(engine.analyser.frequencyBinCount);
        });

        it('should return null before init', () => {
            expect(engine.getFrequencyData()).toBeNull();
        });
    });

    describe('getTimeDomainData', () => {
        it('should return time domain data array after init', async () => {
            await engine.init();
            const data = engine.getTimeDomainData();

            expect(data).toBeInstanceOf(Uint8Array);
            expect(data.length).toBe(engine.analyser.frequencyBinCount);
        });

        it('should return null before init', () => {
            expect(engine.getTimeDomainData()).toBeNull();
        });
    });

    describe('getIsPlaying', () => {
        it('should return false initially', () => {
            expect(engine.getIsPlaying()).toBe(false);
        });

        it('should return true when playing', async () => {
            await engine.play(samplePeaks, 1);
            expect(engine.getIsPlaying()).toBe(true);
        });
    });

    describe('getSampleRate', () => {
        it('should return sample rate from audio context', async () => {
            await engine.init();
            expect(engine.getSampleRate()).toBe(44100);  // Mock default
        });

        it('should return default when not initialized', () => {
            expect(engine.getSampleRate()).toBe(44100);
        });
    });

    describe('exportWAV', () => {
        it('should throw error for empty peaks', async () => {
            await expect(engine.exportWAV([])).rejects.toThrow('Invalid peaks');
        });

        it('should throw error for invalid duration', async () => {
            await expect(engine.exportWAV(samplePeaks, 0)).rejects.toThrow('Invalid duration');
        });

        it('should generate WAV blob for valid peaks', async () => {
            // Test the export functionality without checking download behavior
            // since document.createElement is in a different context
            await engine.init();

            // Verify we can create WAV data from peaks
            // (actual download behavior depends on browser environment)
            await expect(engine.exportWAV(samplePeaks, 1, 'test.wav')).resolves.not.toThrow();
        });
    });

    describe('bufferToWave', () => {
        it('should create valid WAV blob', async () => {
            await engine.init();

            // Create a simple audio buffer
            const buffer = engine.audioContext.createBuffer(2, 44100, 44100);

            const blob = engine.bufferToWave(buffer);

            expect(blob).toBeInstanceOf(Blob);
            expect(blob.type).toBe('audio/wav');
        });
    });

    describe('applyADSREnvelope', () => {
        it('should apply envelope to gain node', async () => {
            await engine.init();
            const gainNode = engine.audioContext.createGain();

            // Should not throw
            expect(() => {
                engine.applyADSREnvelope(gainNode, 0, 2.0, 0.8, 0.5);
            }).not.toThrow();
        });

        it('should handle different curve types', async () => {
            await engine.init();
            const gainNode = engine.audioContext.createGain();

            // Linear curve
            engine.setADSRCurve('linear');
            expect(() => {
                engine.applyADSREnvelope(gainNode, 0, 2.0, 0.8, 0.5);
            }).not.toThrow();

            // Exponential curve
            engine.setADSRCurve('exponential');
            expect(() => {
                engine.applyADSREnvelope(gainNode, 0, 2.0, 0.8, 0.5);
            }).not.toThrow();

            // Logarithmic curve
            engine.setADSRCurve('logarithmic');
            expect(() => {
                engine.applyADSREnvelope(gainNode, 0, 2.0, 0.8, 0.5);
            }).not.toThrow();
        });

        it('should scale envelope to fit within duration', async () => {
            await engine.init();
            const gainNode = engine.audioContext.createGain();

            // Set very long ADSR times
            engine.setAttackTime(1.0);
            engine.setDecayTime(1.0);
            engine.setReleaseTime(1.0);

            // Short duration should still work
            expect(() => {
                engine.applyADSREnvelope(gainNode, 0, 0.5, 0.8, 0.5);
            }).not.toThrow();
        });
    });

    describe('playChord', () => {
        it('should create oscillators for each peak', async () => {
            await engine.init();
            await engine.playChord(samplePeaks, 1);

            expect(engine.oscillators.length).toBe(samplePeaks.length);
        });

        it('should set isPlaying to true', async () => {
            await engine.init();
            await engine.playChord(samplePeaks, 1);

            expect(engine.isPlaying).toBe(true);
        });
    });

    describe('playArpeggio', () => {
        it('should create oscillators for each peak', async () => {
            await engine.init();
            engine.playbackMode = 'arpeggio-up';
            await engine.playArpeggio(samplePeaks, 1);

            expect(engine.oscillators.length).toBe(samplePeaks.length);
        });

        it('should handle arpeggio-updown mode (creates 2n-1 notes)', async () => {
            await engine.init();
            engine.playbackMode = 'arpeggio-updown';
            await engine.playArpeggio(samplePeaks, 2);

            // For 3 peaks: up (3) + down without last (2) = 5
            expect(engine.oscillators.length).toBe(samplePeaks.length * 2 - 1);
        });
    });
});
