#!/usr/bin/env node
/**
 * Batch MIDI Export - Render the whole FTIR library as .mid files
 *
 * Generates one Standard MIDI File per substance/mode/variant using the
 * exact same peak detection and MIDI writer as the web app, so the files
 * match what the in-app "Export MIDI File" button produces.
 *
 * Variants:
 * - pitch-accurate: notes spread across MIDI channels with per-note pitch
 *   bends (MPE-style) so peaks keep their exact frequencies. Best with an
 *   MPE-capable instrument, or split channels to separate tracks.
 * - quantized: plain single-channel MIDI, notes snapped to the nearest
 *   semitone. Drops straight onto any instrument track.
 *
 * Output layout: <out>/<variant>/<category>/<substance-id>_<mode>.mid
 *
 * Usage:
 *   node batch-export-midi.js
 *   node batch-export-midi.js --modes=chord,arpeggio-up --tempo=120 \
 *       --note-duration=500 --variants=pitch-accurate,quantized --out=midi-export
 */

/* eslint-env node */
/* global process */

const fs = require('fs');
const path = require('path');

// Browser modules, loaded Node-side
global.CONFIG = require('./config.js');
global.Logger = { log() {}, info() {}, error() {}, debug() {} };
const SpectrumCodec = require('./spectrum-codec.js');
const { categorizeSubstance } = require('./substance-utilities.js');
const { FrequencyMapper } = require('./frequency-mapper.js');
const { MIDIOutput } = require('./midi-output.js');

const DEFAULTS = {
    modes: ['chord', 'arpeggio-up'],
    variants: ['pitch-accurate', 'quantized'],
    tempo: 120,
    noteDuration: 500, // ms
    out: 'midi-export',
};

function parseArgs(argv) {
    const options = { ...DEFAULTS };
    for (const arg of argv) {
        const match = arg.match(/^--([a-z-]+)=(.+)$/);
        if (!match) continue;
        const [, key, value] = match;
        if (key === 'modes') options.modes = value.split(',');
        else if (key === 'variants') options.variants = value.split(',');
        else if (key === 'tempo') options.tempo = parseInt(value, 10);
        else if (key === 'note-duration') options.noteDuration = parseInt(value, 10);
        else if (key === 'out') options.out = value;
    }
    return options;
}

function main() {
    const options = parseArgs(process.argv.slice(2));

    console.log('='.repeat(60));
    console.log('Batch MIDI Export');
    console.log('='.repeat(60));
    console.log(`Modes: ${options.modes.join(', ')} | Variants: ${options.variants.join(', ')}`);
    console.log(`Tempo: ${options.tempo} BPM | Note duration: ${options.noteDuration} ms`);

    console.log('\nReading ftir-library.json...');
    const library = SpectrumCodec.decodeLibrary(
        JSON.parse(fs.readFileSync(path.join(__dirname, 'ftir-library.json'), 'utf8'))
    );
    console.log(`  ${library.length} substances`);

    const mapper = new FrequencyMapper();
    const midi = new MIDIOutput();
    midi.setNoteDuration(options.noteDuration);

    let written = 0;
    const skipped = [];

    for (const substance of library) {
        const peaks = mapper.extractPeaks(substance.spectrum);
        if (peaks.length === 0) {
            skipped.push(substance.name);
            continue;
        }

        const category = categorizeSubstance(substance);

        for (const variant of options.variants) {
            midi.setPitchBendEnabled(variant === 'pitch-accurate');

            const dir = path.join(__dirname, options.out, variant, category);
            fs.mkdirSync(dir, { recursive: true });

            for (const mode of options.modes) {
                const data = midi.createMIDIFileData(peaks, mode, options.tempo);
                fs.writeFileSync(path.join(dir, `${substance.id}_${mode}.mid`), data);
                written++;
            }
        }
    }

    // Drop a README next to the files so the export is self-explanatory
    const readme = [
        'Spectral Synthesizer - batch MIDI export',
        '',
        `Generated from ${library.length} FTIR spectra (ENFSI DWG IR Library).`,
        `Modes: ${options.modes.join(', ')} | Tempo: ${options.tempo} BPM | Note duration: ${options.noteDuration} ms`,
        '',
        'pitch-accurate/  Notes are spread across MIDI channels 2-16 with per-note',
        '                 pitch bends (bend range +/-2 semitones, announced via RPN 0),',
        '                 preserving the exact peak frequencies. In Ableton Live 11+,',
        '                 drop onto a track with an MPE-enabled instrument for correct',
        '                 microtonal playback.',
        '',
        'quantized/       Plain single-channel MIDI, notes snapped to the nearest',
        '                 semitone. Works on any instrument track, loses the',
        '                 microtonal detail of the molecular fingerprint.',
        '',
        'chord mode:        all peaks sound together (the "sound" of the molecule).',
        'arpeggio-up mode:  peaks played low to high as a melodic sequence.',
        '',
        'Velocity encodes peak intensity (absorbance).',
    ].join('\n');
    fs.writeFileSync(path.join(__dirname, options.out, 'README.txt'), readme, 'utf8');

    console.log(`\n✅ Wrote ${written} MIDI files to ${options.out}/`);
    if (skipped.length) {
        console.log(`  Skipped (no peaks detected): ${skipped.length}`);
        skipped.forEach(name => console.log(`    - ${name}`));
    }
}

try {
    main();
} catch (error) {
    console.error('❌ Batch export failed:', error.message);
    process.exit(1);
}
