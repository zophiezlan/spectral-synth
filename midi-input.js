/**
 * MIDI Input - Play the current substance from a MIDI keyboard
 *
 * Turns the synthesizer into a playable instrument: each key triggers the
 * currently selected substance's spectral peaks, transposed relative to
 * middle C (C4 = the spectrum at its native pitch). Velocity scales the
 * amplitude, and notes sustain until the key is released.
 *
 * Usage:
 * ```javascript
 * const midiInput = new MIDIInput({
 *     audioEngine,                       // AudioEngine instance
 *     getPeaks: () => currentPeaks,      // Peaks of the selected substance
 * });
 * await midiInput.init(midiAccess);      // Reuse MIDIOutput's access object
 * midiInput.selectInput(deviceId);
 * midiInput.setEnabled(true);
 * ```
 */

class MIDIInput {
    constructor({ audioEngine, getPeaks }) {
        this.audioEngine = audioEngine;
        this.getPeaks = getPeaks;

        this.midiAccess = null;
        this.selectedInput = null;
        this.enabled = false;

        // C4 (MIDI 60) plays the spectrum at its native frequencies
        this.referenceNote = 60;

        // Active voices keyed by MIDI note number
        this.voices = new Map();

        // Bound handler so it can be attached/detached from inputs
        this.handleMessage = this.handleMessage.bind(this);

        // Optional UI callback: fired on note on/off with (note, isOn)
        this.onActivity = null;
    }

    /**
     * Initialize with a MIDIAccess object (reuse the one MIDIOutput obtained,
     * or request a fresh one).
     *
     * @param {MIDIAccess} [midiAccess] - Existing access object to reuse
     * @returns {Promise<boolean>}
     */
    async init(midiAccess = null) {
        if (midiAccess) {
            this.midiAccess = midiAccess;
            return true;
        }

        if (!navigator.requestMIDIAccess) {
            throw new Error('Web MIDI API not supported in this browser');
        }

        this.midiAccess = await navigator.requestMIDIAccess();
        return true;
    }

    /**
     * Get list of available MIDI input devices
     *
     * @returns {Array} Array of {id, name, manufacturer}
     */
    getInputDevices() {
        if (!this.midiAccess) {
            return [];
        }

        const inputs = [];
        for (const input of this.midiAccess.inputs.values()) {
            inputs.push({
                id: input.id,
                name: input.name || 'Unknown Device',
                manufacturer: input.manufacturer || 'Unknown'
            });
        }

        return inputs;
    }

    /**
     * Select a MIDI input device to listen to
     *
     * @param {string} deviceId - ID of the input device ('' detaches)
     * @returns {boolean} True if the device was selected
     */
    selectInput(deviceId) {
        // Detach from previous input
        if (this.selectedInput) {
            this.selectedInput.onmidimessage = null;
            this.selectedInput = null;
        }

        this.releaseAll();

        if (!deviceId || !this.midiAccess) {
            return false;
        }

        const input = this.midiAccess.inputs.get(deviceId);
        if (!input) {
            return false;
        }

        this.selectedInput = input;
        this.selectedInput.onmidimessage = this.handleMessage;
        Logger.log(`Listening to MIDI input: ${input.name}`);
        return true;
    }

    /**
     * Enable/disable playing from the selected input
     *
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.enabled = !!enabled;
        if (!this.enabled) {
            this.releaseAll();
        }
    }

    /**
     * Check if a device is selected
     * @returns {boolean}
     */
    hasSelectedDevice() {
        return this.selectedInput !== null;
    }

    /**
     * Handle an incoming MIDI message
     * @param {MIDIMessageEvent} event
     * @private
     */
    handleMessage(event) {
        if (!this.enabled) return;

        const [status, data1, data2] = event.data;
        const command = status & 0xF0;

        if (command === 0x90 && data2 > 0) {
            this.noteOn(data1, data2);
        } else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
            this.noteOff(data1);
        } else if (command === 0xB0 && data1 === 123) {
            // CC 123: All Notes Off
            this.releaseAll();
        }
    }

    /**
     * Start a voice for a MIDI note
     *
     * @param {number} note - MIDI note number
     * @param {number} velocity - MIDI velocity (1-127)
     * @private
     */
    noteOn(note, velocity) {
        const peaks = this.getPeaks();
        if (!peaks || peaks.length === 0) return;

        // Retrigger: release any existing voice on this note
        this.noteOff(note);

        const rate = Math.pow(2, (note - this.referenceNote) / 12);
        const gainScale = velocity / 127;

        const voice = this.audioEngine.startVoice(peaks, { rate, gainScale });
        if (voice) {
            this.voices.set(note, voice);
            if (this.onActivity) this.onActivity(note, true);
        }
    }

    /**
     * Release the voice for a MIDI note
     *
     * @param {number} note - MIDI note number
     * @private
     */
    noteOff(note) {
        const voice = this.voices.get(note);
        if (voice) {
            voice.release();
            this.voices.delete(note);
            if (this.onActivity) this.onActivity(note, false);
        }
    }

    /**
     * Release all active voices
     */
    releaseAll() {
        for (const voice of this.voices.values()) {
            voice.release();
        }
        this.voices.clear();
    }
}

// Also usable from Node for tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MIDIInput };
}
