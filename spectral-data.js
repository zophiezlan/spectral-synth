/**
 * FTIR Spectral Data
 *
 * This file contains simplified FTIR spectra for various substances.
 * Real FTIR data typically has thousands of points; these are simplified
 * but representative versions highlighting characteristic absorption peaks.
 *
 * Data format: Array of {wavenumber (cm⁻¹), transmittance (%)}
 * Lower transmittance = higher absorption = stronger peak
 */

const SPECTRAL_DATABASE = {
    mdma: {
        name: 'MDMA (3,4-Methylenedioxymethamphetamine)',
        description: 'Characteristic peaks include aromatic C-H stretches, methylenedioxy bridge, and amine groups.',
        spectrum: [
            // O-H/N-H region (3000-3500)
            {wavenumber: 3400, transmittance: 85},
            {wavenumber: 3300, transmittance: 75},
            {wavenumber: 3200, transmittance: 82},

            // C-H stretches (2800-3000)
            {wavenumber: 2960, transmittance: 70},
            {wavenumber: 2920, transmittance: 65},
            {wavenumber: 2850, transmittance: 72},

            // Aromatic C=C (1400-1650)
            {wavenumber: 1610, transmittance: 60},
            {wavenumber: 1505, transmittance: 55},
            {wavenumber: 1490, transmittance: 58},

            // Methylenedioxy C-O-C (1200-1300)
            {wavenumber: 1250, transmittance: 50},
            {wavenumber: 1235, transmittance: 45},
            {wavenumber: 1040, transmittance: 52},

            // Aromatic C-H bending (700-900)
            {wavenumber: 870, transmittance: 63},
            {wavenumber: 810, transmittance: 68},
            {wavenumber: 750, transmittance: 70},

            // Baseline points
            {wavenumber: 4000, transmittance: 95},
            {wavenumber: 3700, transmittance: 92},
            {wavenumber: 2700, transmittance: 88},
            {wavenumber: 2400, transmittance: 90},
            {wavenumber: 2000, transmittance: 92},
            {wavenumber: 1800, transmittance: 85},
            {wavenumber: 1350, transmittance: 75},
            {wavenumber: 1150, transmittance: 70},
            {wavenumber: 950, transmittance: 80},
            {wavenumber: 650, transmittance: 85},
            {wavenumber: 400, transmittance: 88}
        ]
    },

    ketamine: {
        name: 'Ketamine',
        description: 'Ketamine shows distinctive C=O carbonyl peak, aromatic rings, and amine groups.',
        spectrum: [
            // N-H stretch
            {wavenumber: 3350, transmittance: 78},
            {wavenumber: 3280, transmittance: 82},

            // C-H stretches
            {wavenumber: 2980, transmittance: 68},
            {wavenumber: 2940, transmittance: 64},
            {wavenumber: 2860, transmittance: 70},

            // C=O carbonyl (strong characteristic peak)
            {wavenumber: 1720, transmittance: 40},

            // Aromatic C=C
            {wavenumber: 1595, transmittance: 62},
            {wavenumber: 1490, transmittance: 58},
            {wavenumber: 1450, transmittance: 65},

            // C-N stretch
            {wavenumber: 1310, transmittance: 70},
            {wavenumber: 1280, transmittance: 68},

            // C-Cl stretch
            {wavenumber: 760, transmittance: 55},
            {wavenumber: 690, transmittance: 60},

            // Baseline points
            {wavenumber: 4000, transmittance: 94},
            {wavenumber: 3700, transmittance: 91},
            {wavenumber: 3100, transmittance: 88},
            {wavenumber: 2700, transmittance: 87},
            {wavenumber: 2400, transmittance: 90},
            {wavenumber: 2000, transmittance: 92},
            {wavenumber: 1900, transmittance: 88},
            {wavenumber: 1350, transmittance: 78},
            {wavenumber: 1100, transmittance: 75},
            {wavenumber: 950, transmittance: 80},
            {wavenumber: 850, transmittance: 82},
            {wavenumber: 600, transmittance: 85},
            {wavenumber: 400, transmittance: 88}
        ]
    },

    caffeine: {
        name: 'Caffeine',
        description: 'Multiple C=O peaks, aromatic ring, and methyl groups create a distinctive spectrum.',
        spectrum: [
            // C-H stretches
            {wavenumber: 2960, transmittance: 72},
            {wavenumber: 2900, transmittance: 70},
            {wavenumber: 2850, transmittance: 75},

            // C=O stretches (multiple carbonyls)
            {wavenumber: 1700, transmittance: 48},
            {wavenumber: 1660, transmittance: 52},
            {wavenumber: 1550, transmittance: 60},

            // C=N and C=C aromatic
            {wavenumber: 1600, transmittance: 65},
            {wavenumber: 1480, transmittance: 62},
            {wavenumber: 1420, transmittance: 68},

            // C-N stretches
            {wavenumber: 1290, transmittance: 58},
            {wavenumber: 1240, transmittance: 62},

            // Ring breathing and bending
            {wavenumber: 1070, transmittance: 66},
            {wavenumber: 970, transmittance: 70},
            {wavenumber: 745, transmittance: 72},

            // Baseline points
            {wavenumber: 4000, transmittance: 93},
            {wavenumber: 3500, transmittance: 91},
            {wavenumber: 3100, transmittance: 90},
            {wavenumber: 2700, transmittance: 87},
            {wavenumber: 2400, transmittance: 90},
            {wavenumber: 2000, transmittance: 91},
            {wavenumber: 1900, transmittance: 88},
            {wavenumber: 1350, transmittance: 76},
            {wavenumber: 1150, transmittance: 73},
            {wavenumber: 850, transmittance: 80},
            {wavenumber: 650, transmittance: 83},
            {wavenumber: 400, transmittance: 87}
        ]
    },

    aspirin: {
        name: 'Aspirin (Acetylsalicylic Acid)',
        description: 'Strong carbonyl peaks (ester and carboxylic acid), aromatic ring, and O-H stretch.',
        spectrum: [
            // O-H stretch (carboxylic acid, broad)
            {wavenumber: 3300, transmittance: 70},
            {wavenumber: 3100, transmittance: 75},
            {wavenumber: 2900, transmittance: 78},

            // C-H stretches
            {wavenumber: 2980, transmittance: 80},
            {wavenumber: 2940, transmittance: 78},

            // C=O stretches (acid and ester)
            {wavenumber: 1755, transmittance: 42},
            {wavenumber: 1690, transmittance: 48},

            // Aromatic C=C
            {wavenumber: 1605, transmittance: 60},
            {wavenumber: 1580, transmittance: 65},
            {wavenumber: 1485, transmittance: 62},

            // C-O stretches
            {wavenumber: 1370, transmittance: 68},
            {wavenumber: 1310, transmittance: 65},
            {wavenumber: 1190, transmittance: 55},
            {wavenumber: 1070, transmittance: 60},

            // Aromatic C-H bending
            {wavenumber: 760, transmittance: 58},
            {wavenumber: 690, transmittance: 62},

            // Baseline points
            {wavenumber: 4000, transmittance: 92},
            {wavenumber: 3700, transmittance: 88},
            {wavenumber: 2700, transmittance: 86},
            {wavenumber: 2400, transmittance: 89},
            {wavenumber: 2000, transmittance: 91},
            {wavenumber: 1900, transmittance: 86},
            {wavenumber: 1450, transmittance: 72},
            {wavenumber: 1250, transmittance: 70},
            {wavenumber: 950, transmittance: 75},
            {wavenumber: 850, transmittance: 78},
            {wavenumber: 600, transmittance: 82},
            {wavenumber: 400, transmittance: 86}
        ]
    }
};

/**
 * Get FTIR spectrum data for a substance
 * @param {string} substanceId - Substance identifier
 * @returns {Object|null} Spectrum data or null if not found
 */
function getSpectrum(substanceId) {
    const data = SPECTRAL_DATABASE[substanceId];
    if (!data) return null;

    // Sort spectrum by wavenumber (descending for proper display)
    const sortedSpectrum = [...data.spectrum].sort((a, b) => b.wavenumber - a.wavenumber);

    return {
        name: data.name,
        description: data.description,
        spectrum: sortedSpectrum
    };
}

/**
 * Get list of available substances
 * @returns {Array} Array of {id, name} objects
 */
function getAvailableSubstances() {
    return Object.keys(SPECTRAL_DATABASE).map(id => ({
        id: id,
        name: SPECTRAL_DATABASE[id].name
    }));
}
