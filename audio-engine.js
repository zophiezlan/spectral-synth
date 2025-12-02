/**
 * Audio Engine - Web Audio API synthesizer for FTIR sonification
 *
 * Creates audio from FTIR peaks using additive synthesis:
 * Each absorption peak becomes an oscillator at the mapped audio frequency
 */

class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.analyser = null;
        this.oscillators = [];
        this.isPlaying = false;

        // Audio effects
        this.convolver = null;  // Reverb
        this.filter = null;     // Low-pass filter
        this.reverbMix = 0;     // 0-1
        this.filterFrequency = CONFIG.frequency.AUDIO_MAX;  // Hz
        
        // Load audio constants from global CONFIG object
        this.DEFAULT_VOLUME = CONFIG.audio.DEFAULT_VOLUME;
        this.DEFAULT_FADE_IN = CONFIG.audio.DEFAULT_FADE_IN;
        this.DEFAULT_FADE_OUT = CONFIG.audio.DEFAULT_FADE_OUT;
        this.REVERB_DURATION = CONFIG.audio.REVERB_DURATION;
        this.FFT_SIZE = CONFIG.audio.FFT_SIZE;
        this.ANALYSER_SMOOTHING = CONFIG.audio.ANALYSER_SMOOTHING;
        this.FILTER_Q_VALUE = CONFIG.audio.FILTER_Q_VALUE;
    }

    /**
     * Initialize Web Audio API context
     * 
     * Sets up the audio graph with master gain, filter, reverb, and analyser nodes.
     * Safe to call multiple times - will only initialize once.
     * 
     * @throws {Error} If Web Audio API is not supported
     */
    async init() {
        if (!this.audioContext) {
            // Check for Web Audio API support
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                throw new Error('Web Audio API is not supported in this browser');
            }
            
            this.audioContext = new AudioContext();

            // Create master gain node for volume control
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = this.DEFAULT_VOLUME;

            // Create filter (low-pass)
            this.filter = this.audioContext.createBiquadFilter();
            this.filter.type = 'lowpass';
            this.filter.frequency.value = this.filterFrequency;
            this.filter.Q.value = this.FILTER_Q_VALUE;

            // Create convolver for reverb
            this.convolver = this.audioContext.createConvolver();
            await this.createReverbImpulse();

            // Create dry/wet mixing for reverb
            this.dryGain = this.audioContext.createGain();
            this.wetGain = this.audioContext.createGain();
            this.dryGain.gain.value = 1;
            this.wetGain.gain.value = 0;

            // Create analyser node for FFT visualization
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.FFT_SIZE;
            this.analyser.smoothingTimeConstant = this.ANALYSER_SMOOTHING;

            // Connect audio graph:
            // oscillators -> masterGain -> filter -> [dry path, wet path] -> analyser -> destination
            this.masterGain.connect(this.filter);

            // Dry path (no reverb)
            this.filter.connect(this.dryGain);
            this.dryGain.connect(this.analyser);

            // Wet path (with reverb)
            this.filter.connect(this.convolver);
            this.convolver.connect(this.wetGain);
            this.wetGain.connect(this.analyser);

            // Output
            this.analyser.connect(this.audioContext.destination);
        }

        // Resume context if suspended (required by browser autoplay policies)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    /**
     * Create impulse response for reverb
     * 
     * Generates an exponentially decaying noise impulse for natural-sounding reverb.
     */
    async createReverbImpulse() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = this.REVERB_DURATION;
        const length = sampleRate * duration;
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                // Exponentially decaying noise
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }

        this.convolver.buffer = impulse;
    }

    /**
     * Synthesize sound from FTIR peaks
     * 
     * Creates one oscillator per peak using additive synthesis. Each oscillator's
     * frequency and amplitude are derived from the peak's IR wavenumber and intensity.
     * 
     * @param {Array} peaks - Array of {wavenumber, absorbance, audioFreq} objects
     * @param {number} [duration=2.0] - Duration in seconds
     * @throws {Error} If peaks array is invalid or duration is not positive
     */
    async play(peaks, duration = 2.0) {
        if (!Array.isArray(peaks) || peaks.length === 0) {
            throw new Error('Invalid peaks: must be a non-empty array');
        }
        
        if (typeof duration !== 'number' || duration <= 0) {
            throw new Error('Invalid duration: must be a positive number');
        }
        if (this.isPlaying) {
            this.stop();
        }

        await this.init();

        const currentTime = this.audioContext.currentTime;
        const fadeIn = this.DEFAULT_FADE_IN;
        const fadeOut = this.DEFAULT_FADE_OUT;

        this.isPlaying = true;
        this.oscillators = [];

        // Create oscillators for each peak using additive synthesis
        // Each FTIR peak becomes one oscillator in the audio output
        peaks.forEach((peak, idx) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            // Set frequency from mapped audio frequency
            osc.frequency.value = peak.audioFreq;

            // Use different waveforms for variety and richness
            // Alternates between sine, triangle, and square for harmonic variety
            const waveforms = ['sine', 'triangle', 'square'];
            // Weight towards sine and triangle (more musical) by using square only every 3rd peak
            const waveformIndex = idx % 3 === 2 ? 2 : (idx % 2);
            osc.type = waveforms[waveformIndex];

            // Set amplitude based on absorption intensity
            // Scale by 0.8 and divide by peak count to prevent clipping when many peaks play
            const baseGain = (peak.absorbance * 0.8) / peaks.length;

            // Apply frequency-dependent amplitude correction (equal loudness contour)
            // Higher frequencies are perceived as louder, so we attenuate them
            // freqCorrection ranges from 0.125 (at 8000 Hz) to 1.0 (at ≤1000 Hz)
            const freqCorrection = Math.min(1.0, 1000 / peak.audioFreq);
            const finalGain = baseGain * freqCorrection;

            // Envelope: fade in, sustain, fade out
            gain.gain.setValueAtTime(0, currentTime);
            gain.gain.linearRampToValueAtTime(finalGain, currentTime + fadeIn);
            gain.gain.setValueAtTime(finalGain, currentTime + duration - fadeOut);
            gain.gain.linearRampToValueAtTime(0, currentTime + duration);

            // Connect: oscillator -> gain -> masterGain
            osc.connect(gain);
            gain.connect(this.masterGain);

            // Schedule start and stop
            osc.start(currentTime);
            osc.stop(currentTime + duration);

            this.oscillators.push({osc, gain});

            // Clean up when finished
            osc.onended = () => {
                osc.disconnect();
                gain.disconnect();
            };
        });

        // Set flag to false after duration
        setTimeout(() => {
            this.isPlaying = false;
        }, duration * 1000);
    }

    /**
     * Stop all currently playing oscillators
     */
    stop() {
        const currentTime = this.audioContext ? this.audioContext.currentTime : 0;

        this.oscillators.forEach(({osc, gain}) => {
            try {
                // Quick fade out
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

    /**
     * Set master volume
     * 
     * @param {number} volume - Volume from 0 to 1
     * @throws {Error} If volume is not a number or out of range
     */
    setVolume(volume) {
        if (typeof volume !== 'number' || isNaN(volume)) {
            throw new Error('Invalid volume: must be a number');
        }
        
        // Clamp volume to valid range
        const clampedVolume = Math.max(0, Math.min(1, volume));
        
        if (this.masterGain) {
            this.masterGain.gain.value = clampedVolume;
        }
    }

    /**
     * Get analyser node for visualization
     * @returns {AnalyserNode} Web Audio API AnalyserNode
     */
    getAnalyser() {
        return this.analyser;
    }

    /**
     * Get frequency data for FFT visualization
     * @returns {Uint8Array} Frequency domain data
     */
    getFrequencyData() {
        if (!this.analyser) return null;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        return dataArray;
    }

    /**
     * Get time domain data for waveform visualization
     * @returns {Uint8Array} Time domain data
     */
    getTimeDomainData() {
        if (!this.analyser) return null;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(dataArray);

        return dataArray;
    }

    /**
     * Check if currently playing
     * @returns {boolean} Playing state
     */
    getIsPlaying() {
        return this.isPlaying;
    }

    /**
     * Get sample rate
     * @returns {number} Sample rate in Hz
     */
    getSampleRate() {
        return this.audioContext ? this.audioContext.sampleRate : 44100;
    }

    /**
     * Set reverb amount
     * 
     * @param {number} amount - Reverb mix 0-1 (0 = dry, 1 = wet)
     * @throws {Error} If amount is not a number
     */
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

    /**
     * Set filter frequency
     * 
     * @param {number} frequency - Cutoff frequency in Hz
     * @throws {Error} If frequency is not a positive number
     */
    setFilterFrequency(frequency) {
        if (typeof frequency !== 'number' || isNaN(frequency) || frequency <= 0) {
            throw new Error('Invalid filter frequency: must be a positive number');
        }
        
        if (this.filter) {
            this.filterFrequency = frequency;
            this.filter.frequency.value = frequency;
        }
    }

    /**
     * Get current reverb amount
     * @returns {number} Reverb mix 0-1
     */
    getReverb() {
        return this.reverbMix;
    }

    /**
     * Get current filter frequency
     * @returns {number} Filter frequency in Hz
     */
    getFilterFrequency() {
        return this.filterFrequency;
    }
}
