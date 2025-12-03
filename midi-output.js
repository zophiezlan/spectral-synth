/**
 * MIDI Output - Send spectral peaks as MIDI notes to external synthesizers
 * 
 * Uses the Web MIDI API to communicate with hardware and software MIDI devices.
 * Maps audio frequencies from spectral peaks to MIDI note numbers.
 */

class MIDIOutput {
    constructor() {
        this.midiAccess = null;
        this.selectedOutput = null;
        this.midiSupported = false;
        
        // Default MIDI parameters
        this.velocity = 80; // 0-127
        this.noteDuration = 500; // milliseconds
        this.channel = 0; // MIDI channel 1 (0-indexed)
    }

    /**
     * Initialize MIDI access
     * 
     * Requests MIDI access from the browser and detects available output devices.
     * 
     * @returns {Promise<boolean>} True if MIDI is supported and initialized
     * @throws {Error} If MIDI access is denied or not supported
     */
    async init() {
        if (!navigator.requestMIDIAccess) {
            this.midiSupported = false;
            throw new Error('Web MIDI API not supported in this browser');
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess();
            this.midiSupported = true;
            console.log('✓ MIDI access granted');
            return true;
        } catch (error) {
            this.midiSupported = false;
            throw new Error(`Failed to access MIDI devices: ${error.message}`);
        }
    }

    /**
     * Get list of available MIDI output devices
     * 
     * @returns {Array} Array of MIDI output devices
     */
    getOutputDevices() {
        if (!this.midiAccess) {
            return [];
        }

        const outputs = [];
        for (const output of this.midiAccess.outputs.values()) {
            outputs.push({
                id: output.id,
                name: output.name || 'Unknown Device',
                manufacturer: output.manufacturer || 'Unknown',
                state: output.state,
                connection: output.connection
            });
        }

        return outputs;
    }

    /**
     * Select MIDI output device
     * 
     * @param {string} deviceId - ID of the MIDI output device
     * @returns {boolean} True if device was selected successfully
     */
    selectOutput(deviceId) {
        if (!this.midiAccess) {
            return false;
        }

        const output = this.midiAccess.outputs.get(deviceId);
        if (output) {
            this.selectedOutput = output;
            console.log(`Selected MIDI output: ${output.name}`);
            return true;
        }

        return false;
    }

    /**
     * Map audio frequency to MIDI note number
     * 
     * Uses standard A4 = 440 Hz tuning.
     * MIDI note 69 = A4 (440 Hz)
     * 
     * @param {number} frequency - Frequency in Hz
     * @returns {number} MIDI note number (0-127), clamped to valid range
     */
    frequencyToMIDINote(frequency) {
        // Formula: MIDI note = 69 + 12 * log2(frequency / 440)
        const noteNumber = 69 + 12 * Math.log2(frequency / 440);
        
        // Clamp to valid MIDI note range (0-127)
        return Math.max(0, Math.min(127, Math.round(noteNumber)));
    }

    /**
     * Send a single MIDI note
     * 
     * @param {number} note - MIDI note number (0-127)
     * @param {number} velocity - Note velocity (0-127)
     * @param {number} duration - Note duration in milliseconds
     * @private
     */
    sendNote(note, velocity, duration) {
        if (!this.selectedOutput) {
            throw new Error('No MIDI output device selected');
        }

        // Note on message: [0x90 + channel, note, velocity]
        const noteOnMessage = [0x90 + this.channel, note, velocity];
        this.selectedOutput.send(noteOnMessage);

        // Schedule note off after duration
        setTimeout(() => {
            // Note off message: [0x80 + channel, note, 0]
            const noteOffMessage = [0x80 + this.channel, note, 0];
            this.selectedOutput.send(noteOffMessage);
        }, duration);
    }

    /**
     * Send spectrum peaks as MIDI notes
     * 
     * Converts spectral peaks to MIDI notes and sends them to the selected output device.
     * Can be sent as a chord (all at once) or as an arpeggio (sequentially).
     * 
     * @param {Array} peaks - Array of peak objects with audioFreq and absorbance
     * @param {string} mode - 'chord' or 'arpeggio'
     * @returns {Promise<void>}
     * @throws {Error} If no device is selected or peaks are invalid
     */
    async sendPeaks(peaks, mode = 'chord') {
        if (!this.selectedOutput) {
            throw new Error('No MIDI output device selected. Please select a device first.');
        }

        if (!Array.isArray(peaks) || peaks.length === 0) {
            throw new Error('Invalid peaks: must be a non-empty array');
        }

        if (mode === 'chord') {
            // Send all notes simultaneously
            peaks.forEach(peak => {
                const note = this.frequencyToMIDINote(peak.audioFreq);
                // Scale velocity based on peak intensity
                const velocity = Math.max(1, Math.min(127, Math.round(this.velocity * peak.absorbance)));
                this.sendNote(note, velocity, this.noteDuration);
            });
            
            console.log(`Sent ${peaks.length} MIDI notes as chord`);
        } else if (mode === 'arpeggio') {
            // Send notes sequentially
            const noteDelay = this.noteDuration / peaks.length;
            
            for (let i = 0; i < peaks.length; i++) {
                const peak = peaks[i];
                const note = this.frequencyToMIDINote(peak.audioFreq);
                const velocity = Math.max(1, Math.min(127, Math.round(this.velocity * peak.absorbance)));
                
                // Schedule note with delay
                setTimeout(() => {
                    this.sendNote(note, velocity, this.noteDuration);
                }, i * noteDelay);
            }
            
            console.log(`Sent ${peaks.length} MIDI notes as arpeggio`);
        } else {
            throw new Error(`Invalid mode: ${mode}. Must be 'chord' or 'arpeggio'.`);
        }
    }

    /**
     * Send all notes off (panic button)
     * 
     * Sends note off messages for all possible notes to stop any stuck notes.
     */
    allNotesOff() {
        if (!this.selectedOutput) {
            return;
        }

        // Send note off for all notes
        for (let note = 0; note < 128; note++) {
            const noteOffMessage = [0x80 + this.channel, note, 0];
            this.selectedOutput.send(noteOffMessage);
        }

        // Also send MIDI CC 123 (All Notes Off)
        const allNotesOffMessage = [0xB0 + this.channel, 123, 0];
        this.selectedOutput.send(allNotesOffMessage);

        console.log('All notes off sent');
    }

    /**
     * Set MIDI velocity
     * 
     * @param {number} velocity - Velocity value (0-127)
     */
    setVelocity(velocity) {
        this.velocity = Math.max(0, Math.min(127, Math.round(velocity)));
    }

    /**
     * Set note duration
     * 
     * @param {number} duration - Duration in milliseconds
     */
    setNoteDuration(duration) {
        this.noteDuration = Math.max(100, Math.min(10000, duration));
    }

    /**
     * Set MIDI channel
     * 
     * @param {number} channel - MIDI channel (0-15, corresponding to channels 1-16)
     */
    setChannel(channel) {
        this.channel = Math.max(0, Math.min(15, channel));
    }

    /**
     * Check if MIDI is supported
     * 
     * @returns {boolean} True if Web MIDI API is supported
     */
    isSupported() {
        return 'requestMIDIAccess' in navigator;
    }

    /**
     * Check if a device is selected
     * 
     * @returns {boolean} True if a device is selected
     */
    hasSelectedDevice() {
        return this.selectedOutput !== null;
    }
}
