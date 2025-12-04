/**
 * Analysis Utilities Module
 *
 * Purpose: Provides spectral analysis utilities for comparing FTIR spectra
 *
 * Dependencies:
 * - None
 *
 * Exports:
 * - calculateSpectralSimilarity(spectrum1, spectrum2) - Cosine similarity calculation
 * - findSimilarSubstances(targetSpectrum, library, count) - Find most similar spectra
 *
 * Usage:
 * ```javascript
 * // Calculate similarity between two spectra
 * const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);
 * // Returns: 0.0 (completely different) to 1.0 (identical)
 *
 * // Find 5 most similar substances
 * const similar = findSimilarSubstances(currentSpectrum, libraryData, 5);
 * // Returns: Array of {substance, similarity} objects, sorted by similarity
 * ```
 *
 * Algorithm:
 * Uses cosine similarity on binned spectral data (100 bins from 400-4000 cm⁻¹).
 * This provides rotation and scale invariant comparison of spectral patterns.
 *
 * Performance:
 * O(n) for similarity calculation, O(n*m) for finding similar substances
 * where n = library size, m = bin count (100)
 */

/**
 * Calculate spectral similarity using cosine similarity
 * @param {Array} spectrum1 - First spectrum data
 * @param {Array} spectrum2 - Second spectrum data
 * @returns {number} Similarity score (0-1)
 */
function calculateSpectralSimilarity(spectrum1, spectrum2) {
    // Convert spectra to fixed-length vectors for comparison
    const minWavenumber = 400;
    const maxWavenumber = 4000;
    const bins = 100;
    const binSize = (maxWavenumber - minWavenumber) / bins;

    const vector1 = new Array(bins).fill(0);
    const vector2 = new Array(bins).fill(0);

    // Bin spectrum1
    spectrum1.forEach(point => {
        const binIndex = Math.floor((point.wavenumber - minWavenumber) / binSize);
        if (binIndex >= 0 && binIndex < bins) {
            vector1[binIndex] += (100 - point.transmittance) / 100; // Convert to absorbance
        }
    });

    // Bin spectrum2
    spectrum2.forEach(point => {
        const binIndex = Math.floor((point.wavenumber - minWavenumber) / binSize);
        if (binIndex >= 0 && binIndex < bins) {
            vector2[binIndex] += (100 - point.transmittance) / 100;
        }
    });

    // Calculate cosine similarity
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < bins; i++) {
        dotProduct += vector1[i] * vector2[i];
        magnitude1 += vector1[i] * vector1[i];
        magnitude2 += vector2[i] * vector2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
}
