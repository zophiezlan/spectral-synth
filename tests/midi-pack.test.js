/**
 * Unit Tests for MIDIPackBuilder
 *
 * Parses the generated files back with a minimal SMF reader and checks the
 * DAW-facing guarantees: Type 1 with named tracks, grid timing, bar-rounded
 * clip lengths, normalised velocities, semitone de-duplication, folding and
 * Euclidean spreading.
 */

import {
    MIDIPackBuilder, PACK_DEFAULTS, euclideanOnsets, noteName, parseNote, guessKey,
} from '../src/midi/midi-pack.js';

const TPB = 480;
const BAR = TPB * 4;

/** Minimal Standard MIDI File reader: header + per-track absolute-time events */
function parseSMF(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const str = (o, n) => String.fromCharCode(...data.slice(o, o + n));
    expect(str(0, 4)).toBe('MThd');
    const format = view.getUint16(8);
    const trackCount = view.getUint16(10);
    const division = view.getUint16(12);

    const tracks = [];
    let offset = 14;
    for (let t = 0; t < trackCount; t++) {
        expect(str(offset, 4)).toBe('MTrk');
        const length = view.getUint32(offset + 4);
        let pos = offset + 8;
        const end = pos + length;
        const events = [];
        let tick = 0;
        let running = null;

        const varLen = () => {
            let value = 0, byte;
            do { byte = data[pos++]; value = (value << 7) | (byte & 0x7F); } while (byte & 0x80);
            return value;
        };

        while (pos < end) {
            tick += varLen();
            let status = data[pos];
            if (status === 0xFF) {
                const type = data[pos + 1];
                pos += 2;
                const len = varLen();
                const payload = data.slice(pos, pos + len);
                pos += len;
                events.push({ tick, meta: type, text: String.fromCharCode(...payload), payload });
                continue;
            }
            if (status & 0x80) { running = status; pos++; } else { status = running; }
            const kind = status & 0xF0;
            const channel = status & 0x0F;
            const d1 = data[pos++];
            const d2 = kind === 0xC0 || kind === 0xD0 ? null : data[pos++];
            events.push({ tick, kind, channel, d1, d2 });
        }
        tracks.push({ events, end: tick });
        offset = end;
    }
    return { format, division, tracks };
}

/** Pair note-ons with note-offs → {note, velocity, channel, start, length} */
function notesOf(track) {
    const open = new Map();
    const notes = [];
    for (const e of track.events) {
        if (e.kind === 0x90 && e.d2 > 0) {
            open.set(`${e.channel}:${e.d1}`, e);
        } else if (e.kind === 0x80 || (e.kind === 0x90 && e.d2 === 0)) {
            const on = open.get(`${e.channel}:${e.d1}`);
            if (on) {
                notes.push({ note: e.d1, velocity: on.d2, channel: e.channel, start: on.tick, length: e.tick - on.tick });
                open.delete(`${e.channel}:${e.d1}`);
            }
        }
    }
    expect(open.size).toBe(0); // no hanging notes
    return notes;
}

const trackName = track => track.events.find(e => e.meta === 0x03)?.text;

/** Peaks at exact semitones so quantized and pitch-accurate agree on note numbers */
function semitonePeaks(notes, absorbances) {
    return notes.map((note, i) => ({
        audioFreq: 440 * Math.pow(2, (note - 69) / 12),
        absorbance: absorbances[i],
        wavenumber: 1000 + i * 100,
    }));
}

const substance = { name: 'Caffeine', formula: 'C8H10N4O2', mw: 194.19, category: 'stimulants', id: 'caffeine' };

describe('MIDIPackBuilder', () => {
    describe('file structure', () => {
        let file;
        beforeEach(() => {
            const peaks = semitonePeaks([60, 64, 67, 71], [1.0, 0.8, 0.6, 0.4]);
            file = parseSMF(new MIDIPackBuilder().build(substance, peaks, () => 'C=O').data);
        });

        it('writes a Type 1 file with a conductor track plus one track per mode', () => {
            expect(file.format).toBe(1);
            expect(file.division).toBe(TPB);
            expect(file.tracks).toHaveLength(3);
        });

        it('names every track after the substance', () => {
            expect(file.tracks.map(trackName)).toEqual([
                'Caffeine', 'Caffeine · chord', 'Caffeine · sequence',
            ]);
        });

        it('puts tempo, time signature and description in the conductor track', () => {
            const conductor = file.tracks[0];
            const tempo = conductor.events.find(e => e.meta === 0x51);
            expect(tempo.payload).toEqual(new Uint8Array([0x07, 0xA1, 0x20])); // 500000 µs = 120 BPM
            const timeSig = conductor.events.find(e => e.meta === 0x58);
            expect([...timeSig.payload]).toEqual([4, 2, 24, 8]);
            const text = conductor.events.filter(e => e.meta === 0x01).map(e => e.text).join('\n');
            expect(text).toContain('Formula: C8H10N4O2');
            expect(text).toContain('Category: stimulants');
        });

        it('adds a wavenumber marker at every sequence step', () => {
            const markers = file.tracks[0].events.filter(e => e.meta === 0x06);
            expect(markers).toHaveLength(4);
            expect(markers[0].text).toBe('1000 cm-1 C=O');
            expect(markers.map(m => m.tick)).toEqual([0, 120, 240, 360]);
        });

        it('ends every track with an end-of-track event', () => {
            file.tracks.forEach(track => {
                expect(track.events.at(-1).meta).toBe(0x2F);
            });
        });
    });

    describe('chord track', () => {
        it('starts every note at tick 0 and holds for chordBars bars', () => {
            const peaks = semitonePeaks([60, 64, 67], [1, 1, 1]);
            const file = parseSMF(new MIDIPackBuilder({ chordBars: 2 }).build(substance, peaks).data);
            const notes = notesOf(file.tracks[1]);
            expect(notes).toHaveLength(3);
            notes.forEach(n => {
                expect(n.start).toBe(0);
                expect(n.length).toBe(2 * BAR);
            });
            expect(file.tracks[1].end).toBe(2 * BAR);
        });
    });

    describe('sequence track', () => {
        it('places one note per grid step, strongest first, at the gate length', () => {
            const peaks = semitonePeaks([60, 72, 48], [0.5, 1.0, 0.75]);
            const file = parseSMF(new MIDIPackBuilder({ grid: 16, gate: 0.5 }).build(substance, peaks).data);
            const notes = notesOf(file.tracks[2]).sort((a, b) => a.start - b.start);
            expect(notes.map(n => n.note)).toEqual([72, 48, 60]);
            expect(notes.map(n => n.start)).toEqual([0, 120, 240]);
            notes.forEach(n => expect(n.length).toBe(60));
        });

        it('rounds the clip length up to whole bars', () => {
            const three = semitonePeaks([60, 62, 64], [1, 1, 1]);
            expect(parseSMF(new MIDIPackBuilder().build(substance, three).data).tracks[2].end).toBe(BAR);

            const twenty = semitonePeaks(Array.from({ length: 20 }, (_, i) => 40 + i), Array(20).fill(1));
            const file = parseSMF(new MIDIPackBuilder({ maxPeaks: 20 }).build(substance, twenty).data);
            expect(notesOf(file.tracks[2])).toHaveLength(20);
            expect(file.tracks[2].end).toBe(2 * BAR);
        });

        it('respects the grid resolution', () => {
            const peaks = semitonePeaks([60, 62], [1, 1]);
            const file = parseSMF(new MIDIPackBuilder({ grid: 8 }).build(substance, peaks).data);
            const notes = notesOf(file.tracks[2]).sort((a, b) => a.start - b.start);
            expect(notes[1].start).toBe(BAR / 8);
        });

        it('spreads sparse peaks across the bar as a Euclidean rhythm', () => {
            const peaks = semitonePeaks([60, 62, 64, 65], [1, 0.9, 0.8, 0.7]);
            const file = parseSMF(new MIDIPackBuilder({ rhythm: 'euclid' }).build(substance, peaks).data);
            const starts = notesOf(file.tracks[2]).map(n => n.start).sort((a, b) => a - b);
            expect(starts).toEqual([0, 4, 8, 12].map(s => s * BAR / 16));
        });
    });

    describe('note preparation', () => {
        it('caps at maxPeaks, keeping the strongest', () => {
            const peaks = semitonePeaks(Array.from({ length: 20 }, (_, i) => 40 + i),
                Array.from({ length: 20 }, (_, i) => (i + 1) / 20));
            const notes = new MIDIPackBuilder({ maxPeaks: 16 }).prepareNotes(peaks);
            expect(notes).toHaveLength(16);
            expect(notes[0].note).toBe(59); // absorbance 1.0
            expect(notes.map(n => n.note)).not.toContain(40); // the 4 weakest dropped
        });

        it('normalises velocity so the strongest peak hits the top of the range', () => {
            const peaks = semitonePeaks([60, 62, 64], [0.5, 0.25, 0.05]);
            const notes = new MIDIPackBuilder({ velocityRange: [40, 127] }).prepareNotes(peaks);
            expect(notes.map(n => n.velocity)).toEqual([127, 64, 40]);
        });

        it('merges peaks that share a semitone in quantized mode, keeping the loudest', () => {
            // 454 Hz and 464 Hz both round to A#4 (70)
            const peaks = [
                { audioFreq: 454, absorbance: 0.6, wavenumber: 1000 },
                { audioFreq: 464, absorbance: 0.9, wavenumber: 1100 },
                { audioFreq: 440, absorbance: 0.5, wavenumber: 1200 },
            ];
            const notes = new MIDIPackBuilder({ pitchAccurate: false }).prepareNotes(peaks);
            expect(notes.map(n => n.note)).toEqual([70, 69]);
            expect(notes[0].wavenumber).toBe(1100);
        });

        it('keeps same-semitone peaks in pitch-accurate mode, on separate channels with bends', () => {
            const peaks = [
                { audioFreq: 454, absorbance: 0.6, wavenumber: 1000 },
                { audioFreq: 464, absorbance: 0.9, wavenumber: 1100 },
            ];
            const notes = new MIDIPackBuilder({ pitchAccurate: true }).prepareNotes(peaks);
            expect(notes).toHaveLength(2);
            expect(notes[0].channel).not.toBe(notes[1].channel);
            expect(notes[0].bend).not.toBe(notes[1].bend);
        });

        it('writes RPN bend-range setup and per-note bends in pitch-accurate files', () => {
            const peaks = [{ audioFreq: 454, absorbance: 1, wavenumber: 1000 }];
            const file = parseSMF(new MIDIPackBuilder({ pitchAccurate: true }).build(substance, peaks).data);
            const chord = file.tracks[1].events;
            const rpn = chord.filter(e => e.kind === 0xB0 && e.d1 === 6);
            expect(rpn).toHaveLength(1);
            expect(rpn[0].d2).toBe(2);
            const bend = chord.find(e => e.kind === 0xE0);
            expect(bend).toBeDefined();
            const noteOn = chord.find(e => e.kind === 0x90);
            expect(bend.channel).toBe(noteOn.channel);
            expect(chord.indexOf(bend)).toBeLessThan(chord.indexOf(noteOn));
        });

        it('octave-folds notes into the requested range', () => {
            const peaks = semitonePeaks([24, 60, 96], [1, 1, 1]);
            const notes = new MIDIPackBuilder({ fold: [parseNote('C2'), parseNote('C5')] }).prepareNotes(peaks);
            notes.forEach(n => {
                expect(n.note).toBeGreaterThanOrEqual(36);
                expect(n.note).toBeLessThanOrEqual(72);
                expect(n.note % 12).toBe(0);
            });
        });

        it('leaves notes alone when folding is off', () => {
            const peaks = semitonePeaks([24, 100], [1, 1]);
            expect(new MIDIPackBuilder().prepareNotes(peaks).map(n => n.note)).toEqual([24, 100]);
        });

        it('throws when nothing survives', () => {
            expect(() => new MIDIPackBuilder().build(substance, [])).toThrow(/No notes/);
        });
    });

    describe('helpers', () => {
        it('euclideanOnsets matches the classic patterns', () => {
            expect(euclideanOnsets(4, 16)).toEqual([0, 4, 8, 12]);
            expect(euclideanOnsets(5, 8)).toHaveLength(5);
            expect(euclideanOnsets(16, 16)).toHaveLength(16);
            expect(euclideanOnsets(3, 8)).toEqual([0, 3, 6]);
        });

        it('noteName and parseNote round-trip in scientific pitch', () => {
            expect(noteName(60)).toBe('C4');
            expect(noteName(61)).toBe('C#4');
            expect(parseNote('C4')).toBe(60);
            expect(parseNote('Bb3')).toBe(58);
            expect(parseNote('36')).toBe(36);
            expect(() => parseNote('H2')).toThrow();
        });

        it('guessKey recognises a plain triad', () => {
            expect(guessKey([60, 64, 67].map(note => ({ note, velocity: 100 })))).toBe('C major');
            expect(guessKey([57, 60, 64].map(note => ({ note, velocity: 100 })))).toBe('A minor');
        });

        it('exposes the defaults the CLI documents', () => {
            expect(PACK_DEFAULTS.maxPeaks).toBe(16);
            expect(PACK_DEFAULTS.grid).toBe(16);
            expect(PACK_DEFAULTS.fold).toBeNull();
        });
    });
});
