/**
 * Analysis Utilities Module
 *
 * Provides spectral analysis utilities:
 * - Spectral similarity calculations
 * - Smart suggestions
 */

/**
 * Calculate spectral similarity using cosine similarity
 * @param {Array} spectrum1 - First spectrum data
 * @param {Array} spectrum2 - Second spectrum data
 * @returns {number} Similarity score (0-1)
 */
export function calculateSpectralSimilarity(spectrum1, spectrum2) {
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

    if (magnitude1 === 0 || magnitude2 === 0) {
        return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
}
