/**
 * MIDI Output - Send spectral peaks as MIDI notes to external synthesizers
 *
 * Uses the Web MIDI API to communicate with hardware and software MIDI devices.
 * Maps audio frequencies from spectral peaks to MIDI note numbers.
 */

export class MIDIOutput {
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

    /**
     * Export spectrum peaks as Standard MIDI File (.mid)
     *
     * Creates a downloadable MIDI file with peaks encoded as notes.
     * Supports different playback modes (chord, sequential, arpeggio).
     *
     * @param {Array} peaks - Array of peak objects with audioFreq and absorbance
     * @param {string} mode - Playback mode: 'chord', 'sequential', 'arpeggio-up', 'arpeggio-down', 'arpeggio-updown', 'random'
     * @param {number} tempo - Tempo in BPM (default: 120)
     * @param {string} filename - Output filename (default: 'spectrum.mid')
     * @throws {Error} If peaks are invalid or mode is unsupported
     */
    exportMIDIFile(peaks, mode = 'sequential', tempo = 120, filename = 'spectrum.mid') {
        if (!Array.isArray(peaks) || peaks.length === 0) {
            throw new Error('Invalid peaks: must be a non-empty array');
        }

        // Sort/arrange peaks based on mode
        let orderedPeaks = [...peaks];

        switch (mode) {
            case 'chord':
                // All notes play simultaneously - no reordering needed
                break;
            case 'arpeggio-up':
                orderedPeaks.sort((a, b) => a.audioFreq - b.audioFreq);
                break;
            case 'arpeggio-down':
                orderedPeaks.sort((a, b) => b.audioFreq - a.audioFreq);
                break;
            case 'arpeggio-updown':
                orderedPeaks.sort((a, b) => a.audioFreq - b.audioFreq);
                orderedPeaks = [...orderedPeaks, ...orderedPeaks.slice(0, -1).reverse()];
                break;
            case 'sequential':
                orderedPeaks.sort((a, b) => b.absorbance - a.absorbance);
                break;
            case 'random':
                for (let i = orderedPeaks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [orderedPeaks[i], orderedPeaks[j]] = [orderedPeaks[j], orderedPeaks[i]];
                }
                break;
            default:
                throw new Error(`Unsupported mode: ${mode}`);
        }

        // Build MIDI file
        const midiData = this.buildMIDIFile(orderedPeaks, mode, tempo);

        // Create blob and download
        const blob = new Blob([midiData], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        console.log(`Exported MIDI file: ${filename} (${orderedPeaks.length} notes, mode: ${mode})`);
    }

    /**
     * Build Standard MIDI File binary data
     *
     * Creates a Type 0 MIDI file with a single track containing the notes.
     *
     * @param {Array} peaks - Ordered array of peak objects
     * @param {string} mode - Playback mode
     * @param {number} tempo - Tempo in BPM
     * @returns {Uint8Array} MIDI file binary data
     * @private
     */
    buildMIDIFile(peaks, mode, tempo) {
        const ticksPerBeat = 480; // Standard MIDI resolution
        const microsecondsPerBeat = Math.round(60000000 / tempo);

        // Calculate note timing
        const noteDurationTicks = Math.round((this.noteDuration / 1000) * (ticksPerBeat * tempo / 60));
        const noteSpacingTicks = mode === 'chord' ? 0 : Math.round(noteDurationTicks * 0.8);

        // Build track events
        const events = [];

        // Set tempo meta event
        events.push(...this.createTempoEvent(0, microsecondsPerBeat));

        if (mode === 'chord') {
            // All notes start at the same time
            peaks.forEach((peak, idx) => {
                const note = this.frequencyToMIDINote(peak.audioFreq);
                const velocity = Math.max(1, Math.min(127, Math.round(this.velocity * peak.absorbance)));

                // Note on at time 0
                events.push(...this.createNoteEvent(0, 0x90, note, velocity));
                // Note off after duration
                events.push(...this.createNoteEvent(noteDurationTicks, 0x80, note, 0));
            });
        } else {
            // Sequential notes
            let currentTick = 0;
            peaks.forEach((peak, idx) => {
                const note = this.frequencyToMIDINote(peak.audioFreq);
                const velocity = Math.max(1, Math.min(127, Math.round(this.velocity * peak.absorbance)));

                // Note on
                const deltaTimeOn = idx === 0 ? 0 : noteSpacingTicks;
                events.push(...this.createNoteEvent(deltaTimeOn, 0x90, note, velocity));

                // Note off
                events.push(...this.createNoteEvent(noteDurationTicks, 0x80, note, 0));

                currentTick += deltaTimeOn + noteDurationTicks;
            });
        }

        // End of track
        events.push(...this.createMetaEvent(0, 0x2F, []));

        // Build MIDI file structure
        const header = this.createMIDIHeader(0, 1, ticksPerBeat);
        const track = this.createMIDITrack(events);

        // Combine header and track
        const midiFile = new Uint8Array(header.length + track.length);
        midiFile.set(header, 0);
        midiFile.set(track, header.length);

        return midiFile;
    }

    /**
     * Create MIDI file header chunk
     *
     * @param {number} format - MIDI format (0, 1, or 2)
     * @param {number} tracks - Number of tracks
     * @param {number} division - Ticks per quarter note
     * @returns {Uint8Array} Header chunk
     * @private
     */
    createMIDIHeader(format, tracks, division) {
        const header = new Uint8Array(14);

        // "MThd" chunk type
        header[0] = 0x4D; // M
        header[1] = 0x54; // T
        header[2] = 0x68; // h
        header[3] = 0x64; // d

        // Chunk length (always 6 for header)
        header[4] = 0x00;
        header[5] = 0x00;
        header[6] = 0x00;
        header[7] = 0x06;

        // Format (2 bytes)
        header[8] = (format >> 8) & 0xFF;
        header[9] = format & 0xFF;

        // Number of tracks (2 bytes)
        header[10] = (tracks >> 8) & 0xFF;
        header[11] = tracks & 0xFF;

        // Division (ticks per quarter note, 2 bytes)
        header[12] = (division >> 8) & 0xFF;
        header[13] = division & 0xFF;

        return header;
    }

    /**
     * Create MIDI track chunk
     *
     * @param {Array} events - Array of event bytes
     * @returns {Uint8Array} Track chunk
     * @private
     */
    createMIDITrack(events) {
        const eventData = new Uint8Array(events);
        const track = new Uint8Array(8 + eventData.length);

        // "MTrk" chunk type
        track[0] = 0x4D; // M
        track[1] = 0x54; // T
        track[2] = 0x72; // r
        track[3] = 0x6B; // k

        // Chunk length (4 bytes, big-endian)
        const length = eventData.length;
        track[4] = (length >> 24) & 0xFF;
        track[5] = (length >> 16) & 0xFF;
        track[6] = (length >> 8) & 0xFF;
        track[7] = length & 0xFF;

        // Event data
        track.set(eventData, 8);

        return track;
    }

    /**
     * Create a MIDI note event (note on or note off)
     *
     * @param {number} deltaTime - Ticks since last event
     * @param {number} status - Status byte (0x90 for note on, 0x80 for note off)
     * @param {number} note - MIDI note number (0-127)
     * @param {number} velocity - Note velocity (0-127)
     * @returns {Array} Event bytes
     * @private
     */
    createNoteEvent(deltaTime, status, note, velocity) {
        const deltaTimeBytes = this.encodeVariableLength(deltaTime);
        return [...deltaTimeBytes, status + this.channel, note, velocity];
    }

    /**
     * Create a tempo meta event
     *
     * @param {number} deltaTime - Ticks since last event
     * @param {number} microsecondsPerBeat - Microseconds per quarter note
     * @returns {Array} Event bytes
     * @private
     */
    createTempoEvent(deltaTime, microsecondsPerBeat) {
        const deltaTimeBytes = this.encodeVariableLength(deltaTime);
        return [
            ...deltaTimeBytes,
            0xFF, // Meta event
            0x51, // Tempo
            0x03, // Length (3 bytes)
            (microsecondsPerBeat >> 16) & 0xFF,
            (microsecondsPerBeat >> 8) & 0xFF,
            microsecondsPerBeat & 0xFF
        ];
    }

    /**
     * Create a generic meta event
     *
     * @param {number} deltaTime - Ticks since last event
     * @param {number} type - Meta event type
     * @param {Array} data - Event data bytes
     * @returns {Array} Event bytes
     * @private
     */
    createMetaEvent(deltaTime, type, data) {
        const deltaTimeBytes = this.encodeVariableLength(deltaTime);
        const lengthBytes = this.encodeVariableLength(data.length);
        return [...deltaTimeBytes, 0xFF, type, ...lengthBytes, ...data];
    }

    /**
     * Encode a number as MIDI variable-length quantity
     *
     * @param {number} value - Value to encode
     * @returns {Array} Variable-length encoded bytes
     * @private
     */
    encodeVariableLength(value) {
        if (value === 0) {
            return [0];
        }

        const bytes = [];
        let buffer = value & 0x7F;

        while (value >>= 7) {
            buffer <<= 8;
            buffer |= ((value & 0x7F) | 0x80);
        }

        while (true) {
            bytes.push(buffer & 0xFF);
            if (buffer & 0x80) {
                buffer >>= 8;
            } else {
                break;
            }
        }

        return bytes;
    }
}
