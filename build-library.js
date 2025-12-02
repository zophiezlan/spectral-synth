#!/usr/bin/env node

/**
 * Build Library - Processes ENFSI JCAMP-DX files into JSON format
 *
 * This Node.js script reads JCAMP-DX FTIR spectra files from the ENFSI library
 * and converts them into a JSON format suitable for the web application.
 * 
 * Features:
 * - Parses JCAMP-DX format (standard for spectroscopy data)
 * - Converts absorbance to transmittance
 * - Downsamples spectra for web performance (~400 points per spectrum)
 * - Extracts metadata (name, formula, molecular weight, etc.)
 * 
 * Usage:
 *   1. Download ENFSI library and extract to enfsi_data/ directory
 *   2. Run: node build-library.js
 *   3. Output: ftir-library.json (ready for web app)
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse a JCAMP-DX file
 * 
 * JCAMP-DX is a standard format for exchanging spectroscopic data.
 * Files contain metadata (##KEY=VALUE) and compressed data tables.
 * 
 * @param {string} filePath - Path to .JDX file
 * @returns {Object} Parsed spectrum data with metadata and spectrum array
 */
function parseJCAMP(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    const metadata = {};
    let xyData = [];
    let inDataSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('##')) {
            // Parse header line
            const match = line.match(/^##([^=]+)=\s*(.+)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                metadata[key] = value;

                // Check if we're entering the data section
                if (key === 'XYDATA') {
                    inDataSection = true;
                }
            }
        } else if (inDataSection && line && !line.startsWith('##END')) {
            // Parse data line
            const parts = line.split(/\s+/);
            if (parts.length > 0 && !isNaN(parseFloat(parts[0]))) {
                xyData.push(parts.map(p => parseFloat(p)));
            }
        } else if (line.startsWith('##END')) {
            break;
        }
    }

    // Convert compressed format to (x,y) pairs
    const spectrum = [];
    const deltaX = parseFloat(metadata.DELTAX || 1);
    const xFactor = parseFloat(metadata.XFACTOR || 1);
    const yFactor = parseFloat(metadata.YFACTOR || 1);

    for (let i = 0; i < xyData.length; i++) {
        const row = xyData[i];
        const x = row[0] * xFactor;

        // First value after x is y at that x
        // Subsequent values are y at x + deltaX, x + 2*deltaX, etc.
        for (let j = 1; j < row.length; j++) {
            const wavenumber = x + (j - 1) * deltaX;
            const absorbance = row[j] * yFactor;

            // Convert absorbance to transmittance for consistency
            // T = 10^(-A)  where A is absorbance
            // But for simplicity, we'll use T% = 100 * (1 - normalized_absorbance)
            spectrum.push({ wavenumber, absorbance });
        }
    }

    return {
        title: metadata.TITLE || '',
        name: extractSubstanceName(metadata.TITLE || ''),
        molForm: metadata.MOLFORM || '',
        mw: metadata.MW || '',
        casName: metadata['CAS NAME'] || '',
        description: metadata['SAMPLE DESCRIPTION'] || '',
        spectrum: spectrum
    };
}

/**
 * Extract substance name from title
 * @param {string} title - JCAMP title field
 * @returns {string} Clean substance name
 */
function extractSubstanceName(title) {
    // Format: #XXXXn/v - Substance Name
    const match = title.match(/^#\d+[nv]?\s*-\s*(.+)$/);
    return match ? match[1].trim() : title;
}

/**
 * Convert absorbance spectrum to transmittance
 * 
 * Transmittance (T) and absorbance (A) are related by: T = 10^(-A)
 * For web display, we normalize and use a simplified conversion:
 * T% = 100 * (1 - normalized_absorbance)
 * 
 * @param {Array} spectrum - Array of {wavenumber, absorbance}
 * @returns {Array} Array of {wavenumber, transmittance}
 */
function convertToTransmittance(spectrum) {
    // Find max absorbance for normalization
    const maxAbs = Math.max(...spectrum.map(p => p.absorbance));

    return spectrum.map(point => ({
        wavenumber: point.wavenumber,
        transmittance: 100 * (1 - (point.absorbance / maxAbs))
    }));
}

/**
 * Downsample spectrum for web performance
 * 
 * Original FTIR spectra can have 1800+ data points, which is excessive for web display.
 * This function reduces the number of points by uniform sampling while maintaining
 * the overall shape and key features.
 * 
 * Note: A more sophisticated approach would use peak-preserving downsampling.
 * 
 * @param {Array} spectrum - Full spectrum
 * @param {number} [targetPoints=500] - Target number of points
 * @returns {Array} Downsampled spectrum
 */
function downsample(spectrum, targetPoints = 500) {
    if (spectrum.length <= targetPoints) return spectrum;

    const step = Math.floor(spectrum.length / targetPoints);
    const downsampled = [];

    for (let i = 0; i < spectrum.length; i += step) {
        downsampled.push(spectrum[i]);
    }

    return downsampled;
}

/**
 * Build curated library from JCAMP files
 */
function buildLibrary() {
    const enfsiDir = path.join(__dirname, 'enfsi_data');
    const outputFile = path.join(__dirname, 'ftir-library.json');

    // Curated list of interesting substances
    const curatedSubstances = [
        'Caffeine',
        'MDMA',
        'Ketamine',
        'Cocaine',
        'Heroin',
        'Aspirin',
        'Morphine',
        'Amphetamine',
        'Mephedrone',
        'LSD',
        'Fentanyl',
        'Methamphetamine',
        'Cannabis', // THC
        'Benzoylecgonine', // Cocaine metabolite
        'Codeine',
        'Diazepam',
        'Alprazolam',
        'Testosterone',
        'Buprenorphine',
        'Methadone'
    ];

    console.log('Scanning ENFSI library...');
    const files = fs.readdirSync(enfsiDir).filter(f => f.endsWith('.JDX'));
    console.log(`Found ${files.length} JCAMP-DX files`);

    const library = {};
    let processedCount = 0;

    for (const file of files) {
        const filePath = path.join(enfsiDir, file);

        // Check if this is a curated substance
        const matchesCurated = curatedSubstances.some(sub =>
            file.toLowerCase().includes(sub.toLowerCase())
        );

        if (!matchesCurated) continue;

        try {
            console.log(`Processing: ${file}`);
            const data = parseJCAMP(filePath);

            // Convert to transmittance and downsample
            const transmittanceSpectrum = convertToTransmittance(data.spectrum);
            const downsampled = downsample(transmittanceSpectrum, 400);

            // Create unique ID
            const id = data.name.toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, '');

            // Store if not duplicate or if this is a better version (more metadata)
            if (!library[id] || data.molForm) {
                library[id] = {
                    id: id,
                    name: data.name,
                    formula: data.molForm,
                    mw: data.mw,
                    casName: data.casName,
                    description: data.description || `FTIR spectrum of ${data.name}`,
                    source: 'ENFSI DWG IR Library',
                    spectrum: downsampled
                };
                processedCount++;
            }
        } catch (error) {
            console.error(`Error processing ${file}:`, error.message);
        }
    }

    // Convert to array and sort by name
    const libraryArray = Object.values(library).sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    // Write output
    fs.writeFileSync(outputFile, JSON.stringify(libraryArray, null, 2));

    console.log(`\n✓ Library built successfully!`);
    console.log(`  Processed: ${processedCount} substances`);
    console.log(`  Output: ${outputFile}`);
    console.log(`\nSubstances included:`);
    libraryArray.forEach(item => console.log(`  - ${item.name}`));
}

// Run the builder
if (require.main === module) {
    buildLibrary();
}

module.exports = { parseJCAMP, buildLibrary };
