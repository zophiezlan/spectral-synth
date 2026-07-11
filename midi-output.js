/**
 * MIDI Output - Send spectral peaks as MIDI notes to external synthesizers
 *
 * Uses the Web MIDI API to communicate with hardware and software MIDI devices.
 * Maps audio frequencies from spectral peaks to MIDI note numbers.
 *
 * Pitch accuracy:
 * Spectral peaks rarely land on 12-TET semitones — the microtonal offsets ARE
 * the molecular fingerprint. In pitch-bend mode (default) each note is sent on
 * its own MIDI channel with a per-channel pitch bend, MPE-style, so peaks keep
 * their exact frequencies. Receivers are configured via the standard RPN 0
 * (pitch bend sensitivity) message. Single-channel mode (bends off) remains
 * available for synths that only listen on one channel; it quantizes to the
 * nearest semitone like a conventional keyboard.
 *
 * Timing: note-offs and arpeggio note-ons use Web MIDI timestamped sends, so
 * they fire on time even when the tab is backgrounded (setTimeout is throttled
 * in background tabs and causes stuck notes).
 */

class MIDIOutput {
    constructor() {
        this.midiAccess = null;
        this.selectedOutput = null;
        this.midiSupported = false;

        // Default MIDI parameters
        this.velocity = 80; // 0-127
        this.noteDuration = 500; // milliseconds
        this.channel = 0; // Base channel for single-channel mode (0-indexed)

        // Pitch accuracy
        this.pitchBendEnabled = true;    // Per-note pitch bend (MPE-style)
        this.bendRangeSemitones = 2;     // ±2 semitones is the near-universal default

        // Note channels for pitch-bend mode: 1-15 (0 reserved as master,
        // 9 skipped — GM percussion). 14 distinct channels; with more
        // simultaneous notes than that, channels are reused and colliding
        // notes share the later note's bend.
        this.NOTE_CHANNELS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
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
            Logger.log('✓ MIDI access granted');
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
            Logger.log(`Selected MIDI output: ${output.name}`);
            return true;
        }

        return false;
    }

    /**
     * Map audio frequency to MIDI note number (quantized to nearest semitone)
     *
     * Uses standard A4 = 440 Hz tuning. MIDI note 69 = A4 (440 Hz).
     *
     * @param {number} frequency - Frequency in Hz
     * @returns {number} MIDI note number (0-127), clamped to valid range
     */
    frequencyToMIDINote(frequency) {
        return this.frequencyToMIDI(frequency).note;
    }

    /**
     * Map audio frequency to MIDI note + pitch bend
     *
     * The note is the nearest semitone; the bend is a 14-bit pitch bend value
     * (8192 = centered) that corrects the remaining offset given the current
     * bend range, preserving the exact frequency.
     *
     * @param {number} frequency - Frequency in Hz
     * @returns {{note: number, bend: number, cents: number}}
     *   note: MIDI note (0-127), bend: 14-bit bend value, cents: offset from note
     */
    frequencyToMIDI(frequency) {
        // MIDI note = 69 + 12 * log2(frequency / 440)
        const exact = 69 + 12 * Math.log2(frequency / 440);
        const note = Math.max(0, Math.min(127, Math.round(exact)));
        const cents = (exact - note) * 100;

        // Scale the cent offset into the 14-bit bend range
        const bendOffset = Math.round((cents / 100) / this.bendRangeSemitones * 8192);
        const bend = Math.max(0, Math.min(16383, 8192 + bendOffset));

        return { note, bend, cents };
    }

    /**
     * Send pitch bend on a channel
     *
     * @param {number} channel - MIDI channel (0-15)
     * @param {number} bend - 14-bit bend value (0-16383, 8192 = centered)
     * @param {number} [when] - DOMHighResTimeStamp for scheduled send
     * @private
     */
    sendPitchBend(channel, bend, when) {
        const lsb = bend & 0x7F;
        const msb = (bend >> 7) & 0x7F;
        this.selectedOutput.send([0xE0 + channel, lsb, msb], when);
    }

    /**
     * Configure a receiver channel's pitch bend range via RPN 0
     * (pitch bend sensitivity), then null the RPN pointer.
     *
     * @param {number} channel - MIDI channel (0-15)
     * @private
     */
    sendBendRangeRPN(channel) {
        const cc = 0xB0 + channel;
        this.selectedOutput.send([cc, 101, 0]);   // RPN MSB
        this.selectedOutput.send([cc, 100, 0]);   // RPN LSB → RPN 0
        this.selectedOutput.send([cc, 6, this.bendRangeSemitones]); // Data entry MSB
        this.selectedOutput.send([cc, 38, 0]);    // Data entry LSB
        this.selectedOutput.send([cc, 101, 127]); // RPN null
        this.selectedOutput.send([cc, 100, 127]);
    }

    /**
     * Send a single MIDI note with scheduled note-off
     *
     * @param {number} note - MIDI note number (0-127)
     * @param {number} velocity - Note velocity (0-127)
     * @param {number} duration - Note duration in milliseconds
     * @param {number} [channel] - MIDI channel (defaults to base channel)
     * @param {number} [when] - DOMHighResTimeStamp for the note-on
     * @private
     */
    sendNote(note, velocity, duration, channel = this.channel, when = window.performance.now()) {
        if (!this.selectedOutput) {
            throw new Error('No MIDI output device selected');
        }

        // Timestamped sends survive background-tab timer throttling
        this.selectedOutput.send([0x90 + channel, note, velocity], when);
        this.selectedOutput.send([0x80 + channel, note, 0], when + duration);
    }

    /**
     * Send spectrum peaks as MIDI notes
     *
     * Converts spectral peaks to MIDI notes and sends them to the selected
     * output device. In pitch-bend mode each note gets its own channel and
     * bend so the exact peak frequencies are preserved.
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

        if (mode !== 'chord' && mode !== 'arpeggio') {
            throw new Error(`Invalid mode: ${mode}. Must be 'chord' or 'arpeggio'.`);
        }

        const now = window.performance.now();
        const noteDelay = mode === 'arpeggio' ? this.noteDuration / peaks.length : 0;

        // Configure bend range on every channel we're about to use
        if (this.pitchBendEnabled) {
            const used = Math.min(peaks.length, this.NOTE_CHANNELS.length);
            for (let i = 0; i < used; i++) {
                this.sendBendRangeRPN(this.NOTE_CHANNELS[i]);
            }
        }

        peaks.forEach((peak, i) => {
            const { note, bend } = this.frequencyToMIDI(peak.audioFreq);
            const velocity = Math.max(1, Math.min(127, Math.round(this.velocity * peak.absorbance)));
            const when = now + i * noteDelay;

            if (this.pitchBendEnabled) {
                const channel = this.NOTE_CHANNELS[i % this.NOTE_CHANNELS.length];
                this.sendPitchBend(channel, bend, when);
                this.sendNote(note, velocity, this.noteDuration, channel, when);
            } else {
                this.sendNote(note, velocity, this.noteDuration, this.channel, when);
            }
        });

        Logger.log(`Sent ${peaks.length} MIDI notes as ${mode}${this.pitchBendEnabled ? ' (pitch-accurate)' : ''}`);
    }

    /**
     * Send all notes off (panic button)
     *
     * Sends CC 123 (All Notes Off) and pitch bend reset on every channel.
     */
    allNotesOff() {
        if (!this.selectedOutput) {
            return;
        }

        for (let channel = 0; channel < 16; channel++) {
            this.selectedOutput.send([0xB0 + channel, 123, 0]); // All Notes Off
            this.sendPitchBend(channel, 8192);                  // Center bends
        }

        Logger.log('All notes off sent');
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
     * Set MIDI channel for single-channel mode
     *
     * @param {number} channel - MIDI channel (0-15, corresponding to channels 1-16)
     */
    setChannel(channel) {
        this.channel = Math.max(0, Math.min(15, channel));
    }

    /**
     * Enable/disable per-note pitch bend (pitch-accurate mode)
     *
     * @param {boolean} enabled
     */
    setPitchBendEnabled(enabled) {
        this.pitchBendEnabled = !!enabled;
    }

    /**
     * Set pitch bend range in semitones (must match the receiving synth
     * if it ignores the RPN configuration message)
     *
     * @param {number} semitones - Bend range (1-48)
     */
    setBendRange(semitones) {
        this.bendRangeSemitones = Math.max(1, Math.min(48, Math.round(semitones)));
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
     * In pitch-bend mode, notes are spread across channels with per-channel
     * pitch bends (and RPN bend-range setup), so a DAW plays back the exact
     * peak frequencies.
     *
     * @param {Array} peaks - Array of peak objects with audioFreq and absorbance
     * @param {string} mode - Playback mode: 'chord', 'sequential', 'arpeggio-up', 'arpeggio-down', 'arpeggio-updown', 'random'
     * @param {number} tempo - Tempo in BPM (default: 120)
     * @param {string} filename - Output filename (default: 'spectrum.mid')
     * @throws {Error} If peaks are invalid or mode is unsupported
     */
    exportMIDIFile(peaks, mode = 'sequential', tempo = 120, filename = 'spectrum.mid') {
        const midiData = this.createMIDIFileData(peaks, mode, tempo);

        // Create blob and download
        const blob = new Blob([midiData], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        Logger.log(`Exported MIDI file: ${filename} (${peaks.length} notes, mode: ${mode})`);
    }

    /**
     * Build Standard MIDI File bytes for peaks in a playback mode.
     * DOM-free — usable from Node for batch export (batch-export-midi.js).
     *
     * @param {Array} peaks - Array of peak objects with audioFreq and absorbance
     * @param {string} mode - 'chord', 'sequential', 'arpeggio-up', 'arpeggio-down', 'arpeggio-updown', 'random'
     * @param {number} tempo - Tempo in BPM
     * @returns {Uint8Array} MIDI file binary data
     * @throws {Error} If peaks are invalid or mode is unsupported
     */
    createMIDIFileData(peaks, mode = 'sequential', tempo = 120) {
        if (!Array.isArray(peaks) || peaks.length === 0) {
            throw new Error('Invalid peaks: must be a non-empty array');
        }

        return this.buildMIDIFile(this.orderPeaksForMode(peaks, mode), mode, tempo);
    }

    /**
     * Sort/arrange peaks according to a playback mode
     *
     * @param {Array} peaks - Array of peak objects
     * @param {string} mode - Playback mode
     * @returns {Array} Ordered copy of the peaks
     * @throws {Error} If the mode is unsupported
     * @private
     */
    orderPeaksForMode(peaks, mode) {
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

        return orderedPeaks;
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

        // Resolve note/bend/channel per peak up front
        const events = [];
        const notes = peaks.map((peak, idx) => {
            const { note, bend } = this.frequencyToMIDI(peak.audioFreq);
            const velocity = Math.max(1, Math.min(127, Math.round(this.velocity * peak.absorbance)));
            const channel = this.pitchBendEnabled
                ? this.NOTE_CHANNELS[idx % this.NOTE_CHANNELS.length]
                : this.channel;
            return { note, bend, velocity, channel };
        });

        // Set tempo meta event
        events.push(...this.createTempoEvent(0, microsecondsPerBeat));

        // Configure bend range on every channel used (RPN 0), at time 0
        if (this.pitchBendEnabled) {
            const usedChannels = [...new Set(notes.map(n => n.channel))];
            usedChannels.forEach(channel => {
                events.push(...this.createRPNBendRangeEvents(channel));
            });
        }

        if (mode === 'chord') {
            // All notes start at the same time
            notes.forEach(({ note, bend, velocity, channel }) => {
                if (this.pitchBendEnabled) {
                    events.push(...this.createPitchBendEvent(0, channel, bend));
                }
                events.push(...this.createNoteEvent(0, 0x90, note, velocity, channel));
            });
            // All note-offs after duration (first carries the delta)
            notes.forEach(({ note, channel }, idx) => {
                events.push(...this.createNoteEvent(idx === 0 ? noteDurationTicks : 0, 0x80, note, 0, channel));
            });
        } else {
            // Sequential notes
            notes.forEach(({ note, bend, velocity, channel }, idx) => {
                const deltaTimeOn = idx === 0 ? 0 : noteSpacingTicks;
                if (this.pitchBendEnabled) {
                    events.push(...this.createPitchBendEvent(deltaTimeOn, channel, bend));
                    events.push(...this.createNoteEvent(0, 0x90, note, velocity, channel));
                } else {
                    events.push(...this.createNoteEvent(deltaTimeOn, 0x90, note, velocity, channel));
                }
                events.push(...this.createNoteEvent(noteDurationTicks, 0x80, note, 0, channel));
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
     * @param {number} [channel] - MIDI channel (defaults to base channel)
     * @returns {Array} Event bytes
     * @private
     */
    createNoteEvent(deltaTime, status, note, velocity, channel = this.channel) {
        const deltaTimeBytes = this.encodeVariableLength(deltaTime);
        return [...deltaTimeBytes, status + channel, note, velocity];
    }

    /**
     * Create a pitch bend event
     *
     * @param {number} deltaTime - Ticks since last event
     * @param {number} channel - MIDI channel (0-15)
     * @param {number} bend - 14-bit bend value (0-16383)
     * @returns {Array} Event bytes
     * @private
     */
    createPitchBendEvent(deltaTime, channel, bend) {
        const deltaTimeBytes = this.encodeVariableLength(deltaTime);
        return [...deltaTimeBytes, 0xE0 + channel, bend & 0x7F, (bend >> 7) & 0x7F];
    }

    /**
     * Create RPN 0 (pitch bend sensitivity) setup events for a channel
     *
     * @param {number} channel - MIDI channel (0-15)
     * @returns {Array} Event bytes
     * @private
     */
    createRPNBendRangeEvents(channel) {
        const cc = 0xB0 + channel;
        return [
            0, cc, 101, 0,                          // RPN MSB
            0, cc, 100, 0,                          // RPN LSB → RPN 0
            0, cc, 6, this.bendRangeSemitones,      // Data entry MSB
            0, cc, 38, 0,                           // Data entry LSB
            0, cc, 101, 127,                        // RPN null
            0, cc, 100, 127
        ];
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
        if (value === 0) return [0];

        const bytes = [];
        let buffer = value & 0x7F;

        // eslint-disable-next-line no-cond-assign
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

// Also usable from Node for tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MIDIOutput };
}
