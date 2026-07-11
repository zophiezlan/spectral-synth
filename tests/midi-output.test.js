/**
 * Unit Tests for MIDIOutput
 *
 * Locks in the pitch-accuracy math (note + bend reconstructs the exact
 * frequency) and the Standard MIDI File structure including per-note
 * pitch bends and RPN bend-range setup.
 */

global.Logger = { log: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() };
const { MIDIOutput } = require('../midi-output.js');

/** Reconstruct the frequency a synth would play from note + bend */
function reconstructFrequency(note, bend, bendRange) {
    const semis = ((bend - 8192) / 8192) * bendRange;
    return 440 * Math.pow(2, (note + semis - 69) / 12);
}

describe('MIDIOutput', () => {
    let midi;

    beforeEach(() => {
        midi = new MIDIOutput();
    });

    describe('frequencyToMIDI', () => {
        it('maps A4 (440 Hz) to note 69 with centered bend', () => {
            const r = midi.frequencyToMIDI(440);
            expect(r.note).toBe(69);
            expect(r.bend).toBe(8192);
            expect(r.cents).toBeCloseTo(0, 5);
        });

        it('preserves microtonal offsets through note + bend', () => {
            // Frequencies deliberately off the 12-TET grid
            [454, 151, 483.7, 1234.5, 7000].forEach(freq => {
                const { note, bend } = midi.frequencyToMIDI(freq);
                const reconstructed = reconstructFrequency(note, bend, midi.bendRangeSemitones);
                // Bend resolution at ±2 semitones is ~0.024 cents — sub-Hz accuracy
                expect(Math.abs(reconstructed - freq) / freq).toBeLessThan(0.0005);
            });
        });

        it('distinguishes frequencies that quantize to the same semitone', () => {
            // Both round to note 70, but differ by ~40 cents
            const a = midi.frequencyToMIDI(454);
            const b = midi.frequencyToMIDI(464);
            expect(a.note).toBe(b.note);
            expect(a.bend).not.toBe(b.bend);
        });

        it('clamps notes to the valid MIDI range', () => {
            expect(midi.frequencyToMIDI(2).note).toBeGreaterThanOrEqual(0);
            expect(midi.frequencyToMIDI(30000).note).toBeLessThanOrEqual(127);
        });

        it('respects the configured bend range', () => {
            midi.setBendRange(12);
            const { note, bend } = midi.frequencyToMIDI(454);
            const reconstructed = reconstructFrequency(note, bend, 12);
            expect(Math.abs(reconstructed - 454) / 454).toBeLessThan(0.0005);
        });
    });

    describe('frequencyToMIDINote (legacy quantized)', () => {
        it('rounds to the nearest semitone', () => {
            expect(midi.frequencyToMIDINote(440)).toBe(69);
            expect(midi.frequencyToMIDINote(454)).toBe(70);
        });
    });

    describe('buildMIDIFile', () => {
        const peaks = [
            { audioFreq: 454, absorbance: 0.9 },
            { audioFreq: 151, absorbance: 0.8 },
            { audioFreq: 484, absorbance: 0.7 },
        ];

        function parseChunks(data) {
            const headerType = String.fromCharCode(...data.slice(0, 4));
            const trackType = String.fromCharCode(...data.slice(14, 18));
            const trackLen = (data[18] << 24) | (data[19] << 16) | (data[20] << 8) | data[21];
            return { headerType, trackType, trackLen, actualTrackLen: data.length - 22 };
        }

        /**
         * Minimal SMF track-event walker. The builder always emits explicit
         * status bytes (no running status), so each event is delta + status
         * + data. Returns [{status, channel, data}] for channel events.
         */
        function parseTrackEvents(data) {
            const events = [];
            let i = 22; // first byte after MTrk header

            const readVLQ = () => {
                let value = 0;
                let byte;
                do {
                    byte = data[i++];
                    value = (value << 7) | (byte & 0x7F);
                } while (byte & 0x80);
                return value;
            };

            while (i < data.length) {
                readVLQ(); // delta time
                const status = data[i++];
                if (status === 0xFF) {
                    const type = data[i++];
                    const len = readVLQ();
                    i += len;
                    if (type === 0x2F) break; // end of track
                } else {
                    const kind = status & 0xF0;
                    const dataBytes = (kind === 0xC0 || kind === 0xD0) ? 1 : 2;
                    events.push({
                        status: kind,
                        channel: status & 0x0F,
                        data: [...data.slice(i, i + dataBytes)],
                    });
                    i += dataBytes;
                }
            }
            return events;
        }

        it('produces a structurally valid Type 0 file', () => {
            const data = midi.buildMIDIFile(peaks, 'chord', 120);
            const { headerType, trackType, trackLen, actualTrackLen } = parseChunks(data);

            expect(headerType).toBe('MThd');
            expect(trackType).toBe('MTrk');
            expect(trackLen).toBe(actualTrackLen);
        });

        it('includes one pitch bend per note when pitch-accurate mode is on', () => {
            const data = midi.buildMIDIFile(peaks, 'chord', 120);
            const events = parseTrackEvents(data);
            const bends = events.filter(e => e.status === 0xE0);
            expect(bends).toHaveLength(peaks.length);
        });

        it('spreads notes across distinct channels in pitch-accurate mode', () => {
            const data = midi.buildMIDIFile(peaks, 'chord', 120);
            const events = parseTrackEvents(data);
            const noteOnChannels = new Set(
                events.filter(e => e.status === 0x90 && e.data[1] > 0).map(e => e.channel)
            );
            expect(noteOnChannels.size).toBe(peaks.length);
        });

        it('configures bend range via RPN on every channel used', () => {
            const data = midi.buildMIDIFile(peaks, 'chord', 120);
            const events = parseTrackEvents(data);
            const rpnDataEntries = events.filter(
                e => e.status === 0xB0 && e.data[0] === 6 && e.data[1] === midi.bendRangeSemitones
            );
            expect(rpnDataEntries).toHaveLength(peaks.length); // distinct channel each
        });

        it('uses a single channel with no bends when pitch bend is disabled', () => {
            midi.setPitchBendEnabled(false);
            const data = midi.buildMIDIFile(peaks, 'chord', 120);
            const events = parseTrackEvents(data);

            expect(events.filter(e => e.status === 0xE0)).toHaveLength(0);

            const noteOnChannels = new Set(
                events.filter(e => e.status === 0x90 && e.data[1] > 0).map(e => e.channel)
            );
            expect(noteOnChannels).toEqual(new Set([midi.channel]));
        });

        it('avoids the GM percussion channel (10 / index 9)', () => {
            expect(midi.NOTE_CHANNELS).not.toContain(9);
        });
    });

    describe('sendPeaks', () => {
        it('sends bend + note-on/off with timestamps', async () => {
            const sent = [];
            midi.selectedOutput = { send: (msg, when) => sent.push({ msg, when }) };
            global.window = { performance: { now: () => 1000 } };

            await midi.sendPeaks([{ audioFreq: 454, absorbance: 0.9 }], 'chord');

            const bends = sent.filter(s => (s.msg[0] & 0xF0) === 0xE0);
            const noteOns = sent.filter(s => (s.msg[0] & 0xF0) === 0x90 && s.msg[2] > 0);
            const noteOffs = sent.filter(s => (s.msg[0] & 0xF0) === 0x80);

            expect(bends.length).toBeGreaterThanOrEqual(1);
            expect(noteOns).toHaveLength(1);
            expect(noteOffs).toHaveLength(1);
            // Note-off scheduled noteDuration after note-on
            expect(noteOffs[0].when - noteOns[0].when).toBe(midi.noteDuration);

            delete global.window;
        });

        it('rejects when no device is selected', async () => {
            await expect(midi.sendPeaks([{ audioFreq: 440, absorbance: 1 }]))
                .rejects.toThrow(/No MIDI output device/);
        });
    });
});
