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

            // Create analyser node for FFT visualization
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;

            // Connect: oscillators -> masterGain -> analyser -> destination
            this.masterGain.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
        }

        // Resume context if suspended (required by browser autoplay policies)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
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
}
