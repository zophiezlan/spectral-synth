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
        this.filterFrequency = 8000;  // Hz
    }

    /**
     * Initialize Web Audio API context
     */
    async init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create master gain node for volume control
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.3; // Default volume

            // Create filter (low-pass)
            this.filter = this.audioContext.createBiquadFilter();
            this.filter.type = 'lowpass';
            this.filter.frequency.value = this.filterFrequency;
            this.filter.Q.value = 1;

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
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;

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
     */
    async createReverbImpulse() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 2; // 2 second reverb
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
     * @param {Array} peaks - Array of {wavenumber, absorbance, audioFreq} objects
     * @param {number} duration - Duration in seconds
     */
    async play(peaks, duration = 2.0) {
        if (this.isPlaying) {
            this.stop();
        }

        await this.init();

        const currentTime = this.audioContext.currentTime;
        const fadeIn = 0.05;  // 50ms fade in
        const fadeOut = 0.1;  // 100ms fade out

        this.isPlaying = true;
        this.oscillators = [];

        // Create oscillators for each peak
        peaks.forEach((peak, idx) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            // Set frequency from mapped audio frequency
            osc.frequency.value = peak.audioFreq;

            // Use different waveforms for variety and richness
            const waveforms = ['sine', 'triangle', 'square'];
            // Weight towards sine and triangle for more musical tones
            const waveformIndex = idx % 3 === 2 ? 2 : (idx % 2);
            osc.type = waveforms[waveformIndex];

            // Set amplitude based on absorption intensity
            // Scale to prevent clipping and create balance
            const baseGain = (peak.absorbance * 0.8) / peaks.length;

            // Apply frequency-dependent amplitude correction
            // Higher frequencies perceived as louder, so reduce their amplitude
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
     * @param {number} volume - Volume from 0 to 1
     */
    setVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = volume;
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
     * @param {number} amount - Reverb mix 0-1 (0 = dry, 1 = wet)
     */
    setReverb(amount) {
        if (this.dryGain && this.wetGain) {
            this.reverbMix = Math.max(0, Math.min(1, amount));
            this.dryGain.gain.value = 1 - this.reverbMix;
            this.wetGain.gain.value = this.reverbMix;
        }
    }

    /**
     * Set filter frequency
     * @param {number} frequency - Cutoff frequency in Hz
     */
    setFilterFrequency(frequency) {
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
