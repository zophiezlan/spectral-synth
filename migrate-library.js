#!/usr/bin/env node
/**
 * Library Migration - Converts ftir-library.json to the compact format
 *
 * One-off migration for libraries built before the compact spectrum
 * format existed. Rebuilding from ENFSI source data with the current
 * build-library.js produces the compact format directly, so this script
 * is only needed for existing ftir-library.json files.
 *
 * What it does:
 * - Encodes each spectrum as {firstX, lastX, y[]} (linear grid) with
 *   transmittance rounded to 2 decimals (~15x smaller on disk)
 * - Bakes the category into each substance record
 * - Verifies grid linearity per spectrum; non-uniform spectra keep an
 *   explicit x array (reported in the summary)
 *
 * Usage: node migrate-library.js
 */

/* eslint-env node */
/* global process */

const fs = require('fs');
const path = require('path');
const SpectrumCodec = require('./spectrum-codec.js');
const { categorizeSubstance } = require('./substance-utilities.js');

const LIBRARY_FILE = path.join(__dirname, 'ftir-library.json');

function migrate() {
    console.log('Reading ftir-library.json...');
    const raw = fs.readFileSync(LIBRARY_FILE, 'utf8');
    const library = JSON.parse(raw);
    console.log(`  ${library.length} substances, ${(raw.length / 1024 / 1024).toFixed(2)} MB`);

    let alreadyCompact = 0;
    let explicitX = 0;
    let maxGridError = 0;

    const migrated = library.map(substance => {
        if (!Array.isArray(substance.spectrum)) {
            alreadyCompact++;
            return { ...substance, category: substance.category || categorizeSubstance(substance) };
        }

        // Track worst-case deviation from the linear grid for reporting
        const pts = substance.spectrum;
        const n = pts.length;
        const step = n > 1 ? (pts[n - 1].wavenumber - pts[0].wavenumber) / (n - 1) : 0;
        for (let i = 0; i < n; i++) {
            const err = Math.abs(pts[i].wavenumber - (pts[0].wavenumber + i * step));
            if (err > maxGridError) maxGridError = err;
        }

        const compact = SpectrumCodec.encodeSpectrum(pts);
        if (compact.x) explicitX++;

        return {
            ...substance,
            category: substance.category || categorizeSubstance(substance),
            spectrum: compact
        };
    });

    // Round-trip check on a sample: decoded values must match the source
    // within rounding tolerance (0.005 transmittance, grid tolerance on x)
    const sample = library.find(s => Array.isArray(s.spectrum));
    if (sample) {
        const idx = library.indexOf(sample);
        const decoded = SpectrumCodec.decodeSpectrum(migrated[idx].spectrum);
        for (let i = 0; i < sample.spectrum.length; i++) {
            const dy = Math.abs(decoded[i].transmittance - sample.spectrum[i].transmittance);
            const dx = Math.abs(decoded[i].wavenumber - sample.spectrum[i].wavenumber);
            if (dy > 0.005 + 1e-9 || dx > SpectrumCodec.GRID_TOLERANCE) {
                throw new Error(`Round-trip check failed at point ${i}: dy=${dy}, dx=${dx}`);
            }
        }
        console.log('  ✓ Round-trip check passed');
    }

    const output = JSON.stringify(migrated);
    fs.writeFileSync(LIBRARY_FILE, output, 'utf8');

    console.log('\n✅ Migration complete');
    console.log(`  New size: ${(output.length / 1024 / 1024).toFixed(2)} MB (was ${(raw.length / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`  Max grid deviation: ${maxGridError.toFixed(4)} cm⁻¹ (tolerance ${SpectrumCodec.GRID_TOLERANCE})`);
    console.log(`  Spectra needing explicit x arrays: ${explicitX}`);
    if (alreadyCompact) console.log(`  Already compact (skipped): ${alreadyCompact}`);

    const categories = {};
    migrated.forEach(s => { categories[s.category] = (categories[s.category] || 0) + 1; });
    console.log('  Categories:', JSON.stringify(categories));
}

try {
    migrate();
} catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
}
