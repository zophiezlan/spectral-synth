#!/usr/bin/env node
/**
 * Batch MIDI Export - Render the whole FTIR library as a DAW-ready MIDI pack
 *
 * One Type 1 .mid per substance (see src/midi/midi-pack.js): a named chord
 * track and a named sequence track, grid-quantized, clip lengths rounded to
 * whole bars, velocities normalised. Drag a file into Ableton/Logic/Reaper
 * and you get clips named after the molecule, not "Track 0".
 *
 * Output layout:
 *   <out>/README.txt
 *   <out>/index.csv                       one row per file: name, formula, key, notes...
 *   <out>/<variant>/<category>/<Name> [<formula>].mid
 *
 * Variants:
 * - quantized: single-channel, notes snapped to the nearest semitone; peaks
 *   sharing a semitone are merged (loudest wins). Works on any instrument.
 * - pitch-accurate: notes spread across channels 2-16 with per-note pitch
 *   bends (MPE-style), preserving exact peak frequencies. Needs an
 *   MPE-capable instrument.
 *
 * Usage:
 *   node scripts/batch-export-midi.js
 *   node scripts/batch-export-midi.js --grid=16 --max-peaks=16 --chord-bars=2 \
 *       --velocity=40:127 --fold=C2:C5 --rhythm=euclid --tempo=120 \
 *       --variants=quantized,pitch-accurate --tracks=chord,sequence --out=midi-export
 *
 * Options:
 *   --grid=N            steps per bar in the sequence track (16 = 1/16 notes)
 *   --max-peaks=N       strongest N peaks per substance (16 = one bar at 1/16)
 *   --chord-bars=N      chord length in bars
 *   --gate=F            sequence note length as a fraction of a step (0-1)
 *   --velocity=MIN:MAX  velocity range; strongest peak = MAX
 *   --fold=LOW:HIGH     octave-fold notes into a range (note names or MIDI numbers)
 *   --rhythm=steps|euclid
 *                       front-load peaks, or spread them as a Euclidean rhythm
 *   --tempo=BPM
 *   --variants=...      quantized, pitch-accurate
 *   --tracks=...        chord, sequence
 *   --no-markers        omit per-peak wavenumber markers
 *   --category=NAME     export only one category
 *   --limit=N           export only the first N substances (for a quick look)
 *   --out=DIR
 */


import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpectrumCodec } from '../src/data/spectrum-codec.js';
import { categorizeSubstance } from '../src/data/substance-utilities.js';
import { FrequencyMapper } from '../src/audio/frequency-mapper.js';
import { MIDIPackBuilder, PACK_DEFAULTS, noteName, parseNote, guessKey } from '../src/midi/midi-pack.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
    const options = {
        ...PACK_DEFAULTS,
        variants: ['quantized', 'pitch-accurate'],
        out: 'midi-export',
        category: null,
        limit: Infinity,
    };
    for (const arg of argv) {
        if (arg === '--help' || arg === '-h') {
            // The header comment is the manual
            const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
            console.log(source.slice(source.indexOf('/**') + 3, source.indexOf('*/')).replace(/^ \* ?/gm, ''));
            process.exit(0);
        }
        if (arg === '--no-markers') { options.markers = false; continue; }
        const match = arg.match(/^--([a-z-]+)=(.+)$/);
        if (!match) {
            console.error(`Unrecognised argument: ${arg}`);
            process.exit(1);
        }
        const [, key, value] = match;
        switch (key) {
            case 'grid': options.grid = parseInt(value, 10); break;
            case 'max-peaks': options.maxPeaks = parseInt(value, 10); break;
            case 'chord-bars': options.chordBars = parseFloat(value); break;
            case 'gate': options.gate = parseFloat(value); break;
            case 'velocity': options.velocityRange = value.split(':').map(Number); break;
            case 'fold': options.fold = value.split(':').map(parseNote); break;
            case 'rhythm': options.rhythm = value; break;
            case 'tempo': options.tempo = parseInt(value, 10); break;
            case 'variants': options.variants = value.split(','); break;
            case 'tracks': options.tracks = value.split(','); break;
            case 'category': options.category = value; break;
            case 'limit': options.limit = parseInt(value, 10); break;
            case 'out': options.out = value; break;
            default:
                console.error(`Unknown option: --${key}`);
                process.exit(1);
        }
    }
    return options;
}

/** "1-(1,3-diphenylpropan-2-yl)pyrrolidine [C19H23N]" — safe on every filesystem */
function fileStem(substance) {
    const name = substance.name
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return substance.formula ? `${name} [${substance.formula}]` : name;
}

function csvCell(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const outDir = path.resolve(ROOT, options.out);

    console.log('='.repeat(60));
    console.log('Batch MIDI Export');
    console.log('='.repeat(60));
    console.log(`Grid: 1/${options.grid} | Max peaks: ${options.maxPeaks} | Chord: ${options.chordBars} bar(s) | Tempo: ${options.tempo} BPM`);
    console.log(`Velocity: ${options.velocityRange.join('-')} | Fold: ${options.fold ? options.fold.map(noteName).join('..') : 'off'} | Rhythm: ${options.rhythm}`);
    console.log(`Variants: ${options.variants.join(', ')} | Tracks: ${options.tracks.join(', ')}`);

    console.log('\nReading ftir-library.json...');
    let library = SpectrumCodec.decodeLibrary(
        JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ftir-library.json'), 'utf8'))
    );
    if (options.category) library = library.filter(s => categorizeSubstance(s) === options.category);
    library = library.slice(0, options.limit);
    console.log(`  ${library.length} substances`);

    const mapper = new FrequencyMapper();
    const describePeak = wavenumber => mapper.getFunctionalGroup(wavenumber) || '';

    const rows = [['file', 'name', 'formula', 'mw', 'category', 'variant', 'peaks', 'bars',
        'closest_key', 'lowest', 'highest', 'notes', 'wavenumbers']];
    let written = 0;
    const skipped = [];

    for (const variant of options.variants) {
        const builder = new MIDIPackBuilder({ ...options, pitchAccurate: variant === 'pitch-accurate' });

        for (const substance of library) {
            // Pull a deeper pool than we keep so semitone merging (quantized)
            // can backfill from the next-strongest distinct peaks
            const peaks = mapper.extractPeaks(substance.spectrum, undefined, options.maxPeaks * 3);
            if (peaks.length === 0) {
                if (variant === options.variants[0]) skipped.push(substance.name);
                continue;
            }

            const category = categorizeSubstance(substance);
            const dir = path.join(outDir, variant, category);
            fs.mkdirSync(dir, { recursive: true });

            const { data, notes, bars } = builder.build({ ...substance, category }, peaks, describePeak);
            const file = path.join(variant, category, `${fileStem(substance)}.mid`);
            fs.writeFileSync(path.join(outDir, file), data);
            written++;

            const pitches = notes.map(n => n.note);
            rows.push([
                file.split(path.sep).join('/'), substance.name, substance.formula, substance.mw, category, variant,
                notes.length, bars, guessKey(notes),
                noteName(Math.min(...pitches)), noteName(Math.max(...pitches)),
                notes.map(n => noteName(n.note)).join(' '),
                notes.map(n => Math.round(n.wavenumber)).join(' '),
            ]);
        }
    }

    fs.writeFileSync(path.join(outDir, 'index.csv'),
        rows.map(row => row.map(csvCell).join(',')).join('\n') + '\n', 'utf8');
    fs.writeFileSync(path.join(outDir, 'README.txt'), readme(options, library.length), 'utf8');

    console.log(`\n✅ Wrote ${written} MIDI files to ${options.out}/ (+ index.csv, README.txt)`);
    if (skipped.length) {
        console.log(`  Skipped (no peaks detected): ${skipped.length}`);
        skipped.forEach(name => console.log(`    - ${name}`));
    }
}

function readme(options, count) {
    const fold = options.fold ? `${options.fold.map(noteName).join('..')} (octave-folded)` : 'off';
    return `Spectral Synthesizer - MIDI pack
=================================

${count} FTIR spectra (ENFSI DWG IR Library) rendered as DAW-ready MIDI.
Each peak in a molecule's infrared spectrum becomes a note; the peak's
intensity becomes velocity. Every file is the fingerprint of one compound.

Settings: grid 1/${options.grid} | max ${options.maxPeaks} peaks | chord ${options.chordBars} bar(s) | ${options.tempo} BPM
          velocity ${options.velocityRange.join('-')} | fold ${fold} | rhythm ${options.rhythm}

FILES
-----
<variant>/<category>/<Name> [<formula>].mid

Each file is a Type 1 MIDI file with named tracks. Drag one into your DAW
and you get:

  "<Name> · chord"     all peaks together, held for ${options.chordBars} bar(s) - the sound of
                       the molecule. Arp it in the DAW for up/down/random.
  "<Name> · sequence"  one peak per 1/${options.grid} step, strongest first, so the
                       melody follows the fingerprint's intensity order.
                       Clip length is rounded up to whole bars.

Ableton: drop the file into the Arrangement to get both tracks; drop it
onto a single clip slot to get just the first (chord).

VARIANTS
--------
quantized/       Single channel, notes snapped to the nearest semitone.
                 Peaks that share a semitone are merged (loudest wins) so
                 chords never contain duplicate notes. Works on anything.

pitch-accurate/  Notes spread across MIDI channels 2-16 with per-note pitch
                 bends (range +/-2 semitones, announced via RPN 0). This keeps
                 the exact peak frequencies - the microtonal detail IS the
                 fingerprint. Use an MPE-enabled instrument (Ableton Live 11+:
                 enable MPE on the track/instrument). On a non-MPE instrument
                 the bends will smear, so use quantized/ instead.

index.csv
---------
One row per file: name, formula, category, peak count, clip length, a
"closest key" guess, note range and the full note list. Sort or filter it
to find e.g. every 16-peak compound near F minor.

Note names use scientific pitch (C4 = MIDI 60). Ableton labels the same
key C3.

Regenerate with different settings:
  node scripts/batch-export-midi.js --help
`;
}

try {
    main();
} catch (error) {
    console.error('❌ Batch export failed:', error.message);
    process.exit(1);
}
