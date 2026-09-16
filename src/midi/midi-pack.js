/**
 * MIDI Pack - DAW-oriented Standard MIDI Files for the batch export
 *
 * The in-app "Export MIDI File" button writes a Type 0 file with millisecond
 * note timing (see MIDIOutput.createMIDIFileData). That is fine for a quick
 * download but awkward in a DAW: notes sit off the grid, clip lengths vary
 * with peak count, every file imports as "Track 0", and velocities never
 * exceed 80. This module builds files meant to be dragged straight into a
 * producer's session instead:
 *
 * - Type 1, one file per substance. Track 0 is a conductor track (sequence
 *   name, tempo, time signature, text meta with formula/MW/category/source).
 *   Then one named note track per requested mode: "<Name> · chord" and
 *   "<Name> · sequence". DAWs create one track per MTrk, so a single drag
 *   drops both clips in, named after the molecule.
 * - Grid timing: the sequence puts one peak per step (1/16 by default), and
 *   both clips end on a bar boundary so they loop cleanly. Peaks are capped
 *   (16 by default) so a 1/16 grid gives a one-bar loop for most of the
 *   library. Substances with fewer peaks than steps can be spread as a
 *   Euclidean rhythm instead of front-loaded.
 * - Velocity normalised per substance: strongest peak = 127, the rest
 *   proportional, floored so nothing is inaudible.
 * - Quantized (single-channel) files drop peaks that round to the same
 *   semitone, keeping the loudest, so chords never contain duplicate notes.
 *   Pitch-accurate (MPE-style) files keep every peak, since note + bend
 *   distinguishes them.
 * - Optional octave folding into a playable range.
 *
 * DOM-free; used by scripts/batch-export-midi.js.
 */


import { MIDIOutput } from './midi-output.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Kessler key profiles, for the "closest key" guess in the index
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export const PACK_DEFAULTS = {
    tempo: 120,
    timeSignature: [4, 4],
    grid: 16,             // steps per bar for the sequence track (16 = 1/16 notes)
    maxPeaks: 16,         // strongest N peaks per substance
    chordBars: 1,         // how long the chord holds
    gate: 0.9,            // sequence note length as a fraction of one step
    velocityRange: [40, 127],
    fold: null,           // e.g. [36, 72] to octave-fold notes into C2..C5; null = leave as mapped
    rhythm: 'steps',      // 'steps' (front-loaded) or 'euclid' (spread across the bar)
    pitchAccurate: false, // per-note pitch bends on channels 2-16 (MPE-style)
    tracks: ['chord', 'sequence'],
    markers: true,        // wavenumber/functional-group marker at each sequence step
};

const TICKS_PER_BEAT = 480;

/**
 * Name of a MIDI note in scientific pitch notation (C4 = 60).
 * Ableton Live displays the same note as C3.
 * @param {number} note - MIDI note number
 * @returns {string}
 */
export function noteName(note) {
    return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

/**
 * Parse a note given as a name ("C2", "F#4", "Bb3") or a MIDI number ("36").
 * @param {string} text
 * @returns {number} MIDI note number
 * @throws {Error} If the text is not a note
 */
export function parseNote(text) {
    const trimmed = String(text).trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    const match = trimmed.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
    if (!match) throw new Error(`Not a note: "${text}"`);
    const [, letter, accidental, octave] = match;
    const base = NOTE_NAMES.indexOf(letter.toUpperCase());
    const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
    return (Number(octave) + 1) * 12 + base + offset;
}

/**
 * Onset positions of the Euclidean rhythm E(onsets, steps), via Bresenham.
 * E(5, 16) → [0, 3, 6, 9, 12] (rotated so the first step is an onset).
 * @param {number} onsets
 * @param {number} steps
 * @returns {number[]} Step indices
 */
export function euclideanOnsets(onsets, steps) {
    if (onsets >= steps) return Array.from({ length: onsets }, (_, i) => i);
    const positions = [];
    for (let k = 0; k < steps; k++) {
        if (Math.floor(k * onsets / steps) !== Math.floor((k - 1) * onsets / steps)) {
            positions.push(k);
        }
    }
    return positions;
}

/**
 * Guess the closest major/minor key for a set of notes by correlating a
 * velocity-weighted pitch-class histogram with Krumhansl-Kessler profiles.
 * @param {Array<{note: number, velocity: number}>} notes
 * @returns {string} e.g. "F minor"
 */
export function guessKey(notes) {
    const histogram = new Array(12).fill(0);
    notes.forEach(({ note, velocity }) => { histogram[note % 12] += velocity; });

    let best = { score: -Infinity, name: '' };
    for (let root = 0; root < 12; root++) {
        for (const [profile, quality] of [[MAJOR_PROFILE, 'major'], [MINOR_PROFILE, 'minor']]) {
            const score = correlation(histogram, profile.map((_, i) => profile[(i - root + 12) % 12]));
            if (score > best.score) best = { score, name: `${NOTE_NAMES[root]} ${quality}` };
        }
    }
    return best.name;
}

function correlation(a, b) {
    const n = a.length;
    const meanA = a.reduce((s, v) => s + v, 0) / n;
    const meanB = b.reduce((s, v) => s + v, 0) / n;
    let num = 0, denA = 0, denB = 0;
    for (let i = 0; i < n; i++) {
        num += (a[i] - meanA) * (b[i] - meanB);
        denA += (a[i] - meanA) ** 2;
        denB += (b[i] - meanB) ** 2;
    }
    return denA && denB ? num / Math.sqrt(denA * denB) : 0;
}

export class MIDIPackBuilder {
    /**
     * @param {Object} [options] - Overrides for PACK_DEFAULTS
     * @param {MIDIOutput} [midi] - Provides the low-level SMF byte helpers
     */
    constructor(options = {}, midi = new MIDIOutput()) {
        this.options = { ...PACK_DEFAULTS, ...options };
        this.midi = midi;
        this.midi.setPitchBendEnabled(this.options.pitchAccurate);
    }

    /**
     * Turn raw peaks into the notes a file will contain: capped, velocity
     * normalised, optionally folded, and (single-channel only) de-duplicated
     * per semitone. Order is by intensity, strongest first.
     *
     * @param {Array<{audioFreq: number, absorbance: number, wavenumber: number}>} peaks
     * @returns {Array<{note, bend, cents, velocity, channel, wavenumber, absorbance}>}
     */
    prepareNotes(peaks) {
        const { maxPeaks, velocityRange, fold, pitchAccurate } = this.options;
        const [velMin, velMax] = velocityRange;

        let notes = [...peaks]
            .sort((a, b) => b.absorbance - a.absorbance)
            .map(peak => {
                const { note, bend, cents } = this.midi.frequencyToMIDI(peak.audioFreq);
                return { note: fold ? foldNote(note, fold) : note, bend, cents,
                    wavenumber: peak.wavenumber, absorbance: peak.absorbance };
            });

        // Single-channel files can't tell two peaks on one semitone apart —
        // keep the loudest. Done before capping so the cap still fills.
        if (!pitchAccurate) {
            const seen = new Set();
            notes = notes.filter(n => !seen.has(n.note) && seen.add(n.note));
        }

        notes = notes.slice(0, maxPeaks);

        // Strongest peak hits velMax, the rest scale with it, floored at velMin
        const strongest = notes[0]?.absorbance || 1;
        notes.forEach((n, idx) => {
            n.velocity = Math.max(velMin, Math.min(velMax, Math.round(n.absorbance / strongest * velMax)));
            n.channel = pitchAccurate
                ? this.midi.NOTE_CHANNELS[idx % this.midi.NOTE_CHANNELS.length]
                : this.midi.channel;
        });

        return notes;
    }

    /**
     * Build the Type 1 file for one substance.
     *
     * @param {{name: string, formula?: string, mw?: number, category?: string, id?: string, source?: string, enfsiId?: string}} substance
     * @param {Array} peaks - From FrequencyMapper.extractPeaks
     * @param {(wavenumber: number) => string} [describePeak] - Marker text per peak
     * @returns {{data: Uint8Array, notes: Array, bars: number}}
     * @throws {Error} If no peaks survive preparation
     */
    build(substance, peaks, describePeak = null) {
        const notes = this.prepareNotes(peaks);
        if (notes.length === 0) throw new Error(`No notes for ${substance.name}`);

        const { tracks, chordBars, grid, rhythm } = this.options;
        const barTicks = this.barTicks();
        const stepTicks = barTicks / grid;

        const sequenceBars = Math.max(1, Math.ceil(notes.length / grid));
        const stepPositions = rhythm === 'euclid'
            ? euclideanOnsets(notes.length, sequenceBars * grid)
            : notes.map((_, i) => i);

        const chunks = [];
        chunks.push(this.conductorTrack(substance, notes, stepPositions, stepTicks, describePeak));

        const clipBars = [];
        for (const mode of tracks) {
            if (mode === 'chord') {
                chunks.push(this.noteTrack(`${substance.name} · chord`, notes.map(n => ({
                    ...n, start: 0, length: chordBars * barTicks,
                })), chordBars * barTicks));
                clipBars.push(chordBars);
            } else if (mode === 'sequence') {
                chunks.push(this.noteTrack(`${substance.name} · sequence`, notes.map((n, i) => ({
                    ...n, start: stepPositions[i] * stepTicks, length: Math.round(stepTicks * this.options.gate),
                })), sequenceBars * barTicks));
                clipBars.push(sequenceBars);
            } else {
                throw new Error(`Unsupported track: ${mode}`);
            }
        }

        const header = this.midi.createMIDIHeader(1, chunks.length, TICKS_PER_BEAT);
        const total = header.length + chunks.reduce((s, c) => s + c.length, 0);
        const data = new Uint8Array(total);
        let offset = 0;
        for (const chunk of [header, ...chunks]) {
            data.set(chunk, offset);
            offset += chunk.length;
        }

        return { data, notes, bars: Math.max(...clipBars) };
    }

    barTicks() {
        const [num, den] = this.options.timeSignature;
        return TICKS_PER_BEAT * 4 * num / den;
    }

    /**
     * Track 0: sequence name, tempo, time signature, descriptive text and
     * (optionally) a marker per sequence step naming the peak.
     * @private
     */
    conductorTrack(substance, notes, stepPositions, stepTicks, describePeak) {
        const { tempo, timeSignature: [num, den], markers } = this.options;
        const events = [];
        const at = (tick, bytes) => events.push({ tick, bytes });

        at(0, this.midi.createMetaEvent(0, 0x03, textBytes(substance.name)));
        at(0, this.midi.createTempoEvent(0, Math.round(60000000 / tempo)));
        at(0, this.midi.createMetaEvent(0, 0x58, [num, Math.log2(den), 24, 8]));

        const description = [
            substance.formula && `Formula: ${substance.formula}`,
            substance.mw && `MW: ${substance.mw} g/mol`,
            substance.category && `Category: ${substance.category}`,
            substance.id && `ID: ${substance.id}`,
            substance.enfsiId && `ENFSI: ${substance.enfsiId}`,
            substance.source && `Source: ${substance.source}`,
        ].filter(Boolean).join(' | ');
        if (description) at(0, this.midi.createMetaEvent(0, 0x01, textBytes(description)));
        at(0, this.midi.createMetaEvent(0, 0x01, textBytes(
            'Generated by Spectral Synthesizer from an FTIR spectrum. Velocity = peak intensity.'
        )));

        if (markers) {
            notes.forEach((n, i) => {
                const label = describePeak ? describePeak(n.wavenumber) : '';
                at(stepPositions[i] * stepTicks, this.midi.createMetaEvent(
                    0, 0x06, textBytes(`${Math.round(n.wavenumber)} cm-1${label ? ' ' + label : ''}`)
                ));
            });
        }

        return this.finishTrack(events, 0);
    }

    /**
     * A named note track. Note-offs are emitted before note-ons at the same
     * tick so back-to-back repeats never overlap. Ends exactly at clipTicks.
     * @private
     */
    noteTrack(name, notes, clipTicks) {
        const events = [];
        const at = (tick, order, bytes) => events.push({ tick, order, bytes });

        at(0, 0, this.midi.createMetaEvent(0, 0x03, textBytes(name)));

        if (this.options.pitchAccurate) {
            [...new Set(notes.map(n => n.channel))].forEach(channel => {
                at(0, 0, this.midi.createRPNBendRangeEvents(channel));
            });
        }

        for (const n of notes) {
            if (this.options.pitchAccurate) {
                at(n.start, 1, this.midi.createPitchBendEvent(0, n.channel, n.bend));
            }
            at(n.start, 2, this.midi.createNoteEvent(0, 0x90, n.note, n.velocity, n.channel));
            at(n.start + n.length, 1, this.midi.createNoteEvent(0, 0x80, n.note, 0, n.channel));
        }

        return this.finishTrack(events, clipTicks);
    }

    /**
     * Sort absolute-tick events, convert to delta times, append end-of-track
     * at endTick and wrap as an MTrk chunk.
     * @private
     */
    finishTrack(events, endTick) {
        events.sort((a, b) => a.tick - b.tick || (a.order || 0) - (b.order || 0));
        const bytes = [];
        let last = 0;
        for (const event of events) {
            // Each helper emits a leading zero delta; replace it with the real one
            bytes.push(...this.midi.encodeVariableLength(event.tick - last), ...event.bytes.slice(1));
            last = event.tick;
        }
        bytes.push(...this.midi.encodeVariableLength(Math.max(endTick, last) - last), 0xFF, 0x2F, 0x00);
        return this.midi.createMIDITrack(bytes);
    }
}

/** Octave-shift a note into [low, high]; leaves it alone if the range is narrower than an octave */
function foldNote(note, [low, high]) {
    if (high - low < 11) return note;
    let folded = note;
    while (folded < low) folded += 12;
    while (folded > high) folded -= 12;
    return folded;
}

/** Text meta payload — SMF text is Latin-1, so strip anything wider */
function textBytes(text) {
    return [...String(text)].map(ch => {
        const code = ch.charCodeAt(0);
        return code < 256 ? code : 0x3F; // '?'
    });
}
