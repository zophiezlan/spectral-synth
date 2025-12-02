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
        
        // Playback mode
        this.playbackMode = 'chord';  // Default to chord mode
        
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

        // Use appropriate playback method based on mode
        if (this.playbackMode === 'chord') {
            await this.playChord(peaks, duration);
        } else {
            await this.playArpeggio(peaks, duration);
        }
    }

    /**
     * Play all peaks simultaneously as a chord
     * 
     * @param {Array} peaks - Array of peak objects
     * @param {number} duration - Duration in seconds
     * @private
     */
    async playChord(peaks, duration) {
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
     * Play peaks in sequence (arpeggio mode)
     * 
     * @param {Array} peaks - Array of peak objects
     * @param {number} duration - Total duration in seconds
     * @private
     */
    async playArpeggio(peaks, duration) {
        const currentTime = this.audioContext.currentTime;
        this.isPlaying = true;
        this.oscillators = [];

        // Sort and arrange peaks based on playback mode
        let orderedPeaks = [...peaks];
        
        switch (this.playbackMode) {
            case 'arpeggio-up':
                // Sort by frequency (low to high)
                orderedPeaks.sort((a, b) => a.audioFreq - b.audioFreq);
                break;
            case 'arpeggio-down':
                // Sort by frequency (high to low)
                orderedPeaks.sort((a, b) => b.audioFreq - a.audioFreq);
                break;
            case 'arpeggio-updown':
                // Sort by frequency then add reverse (skip last to avoid duplicate)
                orderedPeaks.sort((a, b) => a.audioFreq - b.audioFreq);
                orderedPeaks = [...orderedPeaks, ...orderedPeaks.slice(0, -1).reverse()];
                break;
            case 'sequential':
                // Sort by intensity (strongest first)
                orderedPeaks.sort((a, b) => b.absorbance - a.absorbance);
                break;
            case 'random':
                // Shuffle array
                for (let i = orderedPeaks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [orderedPeaks[i], orderedPeaks[j]] = [orderedPeaks[j], orderedPeaks[i]];
                }
                break;
        }

        // Calculate timing for each note
        const noteCount = orderedPeaks.length;
        const noteDuration = duration / noteCount;
        const noteOverlap = 0.1; // Small overlap for smoother transitions
        const actualNoteDuration = Math.min(noteDuration + noteOverlap, 0.5); // Cap at 0.5s

        // Create oscillators for each note in sequence
        orderedPeaks.forEach((peak, idx) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            const startTime = currentTime + (idx * noteDuration);
            const endTime = startTime + actualNoteDuration;

            // Set frequency
            osc.frequency.value = peak.audioFreq;

            // Waveform selection - cycle through sine, triangle, square
            const waveforms = ['sine', 'triangle', 'square'];
            const waveformIndex = idx % 3;
            osc.type = waveforms[waveformIndex];

            // Calculate gain with frequency correction
            const baseGain = peak.absorbance * 0.5; // Higher volume for individual notes
            const freqCorrection = Math.min(1.0, 1000 / peak.audioFreq);
            const finalGain = baseGain * freqCorrection;

            // Envelope: quick attack, sustain, quick release
            const attackTime = 0.01;
            const releaseTime = 0.05;
            
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(finalGain, startTime + attackTime);
            gain.gain.setValueAtTime(finalGain, endTime - releaseTime);
            gain.gain.linearRampToValueAtTime(0, endTime);

            // Connect
            osc.connect(gain);
            gain.connect(this.masterGain);

            // Schedule
            osc.start(startTime);
            osc.stop(endTime);

            this.oscillators.push({osc, gain});

            // Clean up
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

    /**
     * Apply an effect preset
     * 
     * @param {string} presetName - Name of preset from CONFIG.presets
     * @throws {Error} If preset name is invalid
     */
    applyPreset(presetName) {
        const preset = CONFIG.presets[presetName];
        if (!preset) {
            throw new Error(`Invalid preset: ${presetName}`);
        }
        
        this.setReverb(preset.reverb);
        this.setFilterFrequency(preset.filterFreq);
    }

    /**
     * Get available presets
     * @returns {Object} Presets object from CONFIG
     */
    getPresets() {
        return CONFIG.presets;
    }

    /**
     * Set playback mode
     * 
     * @param {string} mode - Playback mode from CONFIG.playbackModes
     * @throws {Error} If mode is invalid
     */
    setPlaybackMode(mode) {
        if (!CONFIG.playbackModes[mode]) {
            throw new Error(`Invalid playback mode: ${mode}`);
        }
        this.playbackMode = mode;
    }

    /**
     * Get current playback mode
     * @returns {string} Current playback mode
     */
    getPlaybackMode() {
        return this.playbackMode;
    }

    /**
     * Get available playback modes
     * @returns {Object} Playback modes object from CONFIG
     */
    getPlaybackModes() {
        return CONFIG.playbackModes;
    }

    /**
     * Export audio as WAV file
     * 
     * Renders the synthesized audio to a buffer and exports it as a downloadable WAV file.
     * 
     * @param {Array} peaks - Array of {wavenumber, absorbance, audioFreq} objects
     * @param {number} [duration=2.0] - Duration in seconds
     * @param {string} [filename='spectral-synth.wav'] - Output filename
     * @throws {Error} If peaks array is invalid or duration is not positive
     */
    async exportWAV(peaks, duration = 2.0, filename = 'spectral-synth.wav') {
        if (!Array.isArray(peaks) || peaks.length === 0) {
            throw new Error('Invalid peaks: must be a non-empty array');
        }
        
        if (typeof duration !== 'number' || duration <= 0) {
            throw new Error('Invalid duration: must be a positive number');
        }

        await this.init();

        // Create an offline audio context for rendering
        const sampleRate = this.audioContext.sampleRate;
        const offlineContext = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

        // Create master gain
        const masterGain = offlineContext.createGain();
        masterGain.gain.value = this.masterGain.gain.value;

        // Create filter
        const filter = offlineContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = this.filterFrequency;
        filter.Q.value = this.FILTER_Q_VALUE;

        // Create reverb if enabled
        const dryGain = offlineContext.createGain();
        const wetGain = offlineContext.createGain();
        dryGain.gain.value = 1 - this.reverbMix;
        wetGain.gain.value = this.reverbMix;

        // Create reverb impulse
        const convolver = offlineContext.createConvolver();
        const impulseLength = sampleRate * this.REVERB_DURATION;
        const impulse = offlineContext.createBuffer(2, impulseLength, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < impulseLength; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2);
            }
        }
        convolver.buffer = impulse;

        // Connect audio graph
        masterGain.connect(filter);
        filter.connect(dryGain);
        dryGain.connect(offlineContext.destination);
        filter.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(offlineContext.destination);

        // Create oscillators for each peak
        const fadeIn = this.DEFAULT_FADE_IN;
        const fadeOut = this.DEFAULT_FADE_OUT;

        peaks.forEach((peak, idx) => {
            const osc = offlineContext.createOscillator();
            const gain = offlineContext.createGain();

            osc.frequency.value = peak.audioFreq;
            
            const waveforms = ['sine', 'triangle', 'square'];
            const waveformIndex = idx % 3 === 2 ? 2 : (idx % 2);
            osc.type = waveforms[waveformIndex];

            const baseGain = (peak.absorbance * 0.8) / peaks.length;
            const freqCorrection = Math.min(1.0, 1000 / peak.audioFreq);
            const finalGain = baseGain * freqCorrection;

            // Envelope
            gain.gain.setValueAtTime(0, 0);
            gain.gain.linearRampToValueAtTime(finalGain, fadeIn);
            gain.gain.setValueAtTime(finalGain, duration - fadeOut);
            gain.gain.linearRampToValueAtTime(0, duration);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(0);
            osc.stop(duration);
        });

        // Render audio
        const renderedBuffer = await offlineContext.startRendering();

        // Convert to WAV
        const wavBlob = this.bufferToWave(renderedBuffer);
        
        // Download file
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Convert AudioBuffer to WAV blob
     * 
     * @param {AudioBuffer} buffer - Audio buffer to convert
     * @returns {Blob} WAV file as blob
     * @private
     */
    bufferToWave(buffer) {
        const length = buffer.length * buffer.numberOfChannels * 2;
        const arrayBuffer = new ArrayBuffer(44 + length);
        const view = new DataView(arrayBuffer);

        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        const sampleRate = buffer.sampleRate;
        const numChannels = buffer.numberOfChannels;
        const bitsPerSample = 16;

        // RIFF chunk descriptor
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length, true);
        writeString(8, 'WAVE');

        // FMT sub-chunk
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // SubChunk1Size
        view.setUint16(20, 1, true); // AudioFormat (PCM)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true); // ByteRate
        view.setUint16(32, numChannels * bitsPerSample / 8, true); // BlockAlign
        view.setUint16(34, bitsPerSample, true);

        // Data sub-chunk
        writeString(36, 'data');
        view.setUint32(40, length, true);

        // Write audio data
        const offset = 44;
        const channels = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        let pos = 0;
        for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                let sample = channels[channel][i];
                // Clamp to [-1, 1]
                sample = Math.max(-1, Math.min(1, sample));
                // Convert to 16-bit PCM
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset + pos, sample, true);
                pos += 2;
            }
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }
}
