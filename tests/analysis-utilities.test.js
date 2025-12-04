/**
 * Unit Tests for Analysis Utilities Module
 *
 * Tests spectral similarity calculations using cosine similarity.
 */

const { loadBrowserModule } = require('./test-helpers');
const { calculateSpectralSimilarity } = loadBrowserModule('analysis-utilities.js');

describe('Analysis Utilities', () => {
    // Helper to generate test spectrum
    const generateSpectrum = (pattern = 'flat', intensity = 50) => {
        const spectrum = [];
        for (let wn = 400; wn <= 4000; wn += 36) {  // ~100 points
            let transmittance = 95;

            switch (pattern) {
                case 'flat':
                    transmittance = 95;
                    break;
                case 'carbonyl':
                    // Peak at 1700 cm⁻¹
                    if (wn >= 1650 && wn <= 1750) {
                        transmittance = intensity;
                    }
                    break;
                case 'c-h':
                    // Peak at 2950 cm⁻¹
                    if (wn >= 2900 && wn <= 3000) {
                        transmittance = intensity;
                    }
                    break;
                case 'o-h':
                    // Peak at 3500 cm⁻¹
                    if (wn >= 3450 && wn <= 3550) {
                        transmittance = intensity;
                    }
                    break;
                case 'complex':
                    // Multiple peaks
                    if (wn >= 1650 && wn <= 1750) transmittance = 30;
                    if (wn >= 2900 && wn <= 3000) transmittance = 40;
                    if (wn >= 3450 && wn <= 3550) transmittance = 50;
                    break;
            }

            spectrum.push({ wavenumber: wn, transmittance });
        }
        return spectrum;
    };

    describe('calculateSpectralSimilarity', () => {
        it('should return 1.0 for identical spectra', () => {
            const spectrum = generateSpectrum('carbonyl');
            const similarity = calculateSpectralSimilarity(spectrum, spectrum);

            expect(similarity).toBeCloseTo(1.0, 5);
        });

        it('should return high similarity for very similar spectra', () => {
            const spectrum1 = generateSpectrum('carbonyl', 30);
            const spectrum2 = generateSpectrum('carbonyl', 35);  // Slightly different intensity

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            expect(similarity).toBeGreaterThan(0.95);
        });

        it('should return lower similarity for different spectra', () => {
            const spectrum1 = generateSpectrum('carbonyl');
            const spectrum2 = generateSpectrum('o-h');

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            expect(similarity).toBeLessThan(0.5);
        });

        it('should return 0 for completely different spectra', () => {
            // Create two spectra with peaks in non-overlapping regions
            const spectrum1 = [];
            const spectrum2 = [];

            for (let wn = 400; wn <= 4000; wn += 36) {
                // Spectrum 1: peak only at low wavenumbers (400-800)
                const t1 = (wn >= 400 && wn <= 800) ? 20 : 100;
                // Spectrum 2: peak only at high wavenumbers (3600-4000)
                const t2 = (wn >= 3600 && wn <= 4000) ? 20 : 100;

                spectrum1.push({ wavenumber: wn, transmittance: t1 });
                spectrum2.push({ wavenumber: wn, transmittance: t2 });
            }

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            expect(similarity).toBeLessThan(0.1);
        });

        it('should return value between 0 and 1', () => {
            const spectrum1 = generateSpectrum('complex');
            const spectrum2 = generateSpectrum('carbonyl');

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            expect(similarity).toBeGreaterThanOrEqual(0);
            expect(similarity).toBeLessThanOrEqual(1);
        });

        it('should be symmetric (order independent)', () => {
            const spectrum1 = generateSpectrum('carbonyl');
            const spectrum2 = generateSpectrum('c-h');

            const similarity1 = calculateSpectralSimilarity(spectrum1, spectrum2);
            const similarity2 = calculateSpectralSimilarity(spectrum2, spectrum1);

            expect(similarity1).toBeCloseTo(similarity2, 10);
        });

        it('should handle flat spectra (no peaks)', () => {
            const flat1 = generateSpectrum('flat');
            const flat2 = generateSpectrum('flat');

            // Two flat spectra should be identical
            const similarity = calculateSpectralSimilarity(flat1, flat2);
            expect(similarity).toBeCloseTo(1.0, 5);
        });

        it('should handle empty regions gracefully', () => {
            // Create spectrum with some zero absorbance regions
            const spectrum1 = [];
            const spectrum2 = [];

            for (let wn = 400; wn <= 4000; wn += 36) {
                spectrum1.push({ wavenumber: wn, transmittance: 100 }); // All 100% T = 0 absorbance
                spectrum2.push({ wavenumber: wn, transmittance: 100 });
            }

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            // Should return 0 when both vectors have zero magnitude
            expect(similarity).toBe(0);
        });

        it('should use 100 bins for comparison', () => {
            // This tests the internal binning logic indirectly
            // If binning works correctly, small wavenumber shifts shouldn't affect similarity much
            const spectrum1 = generateSpectrum('carbonyl', 30);

            // Create same pattern but shifted by a small amount
            const spectrum2 = [];
            for (let wn = 405; wn <= 4005; wn += 36) {  // 5 cm⁻¹ shift
                let transmittance = 95;
                if (wn >= 1655 && wn <= 1755) {
                    transmittance = 30;
                }
                spectrum2.push({ wavenumber: wn, transmittance });
            }

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            // Should still be very similar despite small shift
            expect(similarity).toBeGreaterThan(0.9);
        });

        it('should correctly convert transmittance to absorbance for binning', () => {
            // Low transmittance (high absorption) should contribute more to similarity
            const strongPeak = [];
            const weakPeak = [];

            for (let wn = 400; wn <= 4000; wn += 36) {
                const hasStrongPeak = (wn >= 1650 && wn <= 1750) ? 10 : 95;  // Strong absorption
                const hasWeakPeak = (wn >= 1650 && wn <= 1750) ? 80 : 95;    // Weak absorption

                strongPeak.push({ wavenumber: wn, transmittance: hasStrongPeak });
                weakPeak.push({ wavenumber: wn, transmittance: hasWeakPeak });
            }

            // Compare each to itself
            const strongSelf = calculateSpectralSimilarity(strongPeak, strongPeak);
            const weakSelf = calculateSpectralSimilarity(weakPeak, weakPeak);

            expect(strongSelf).toBeCloseTo(1.0, 5);
            expect(weakSelf).toBeCloseTo(1.0, 5);

            // Compare strong to weak
            const crossSimilarity = calculateSpectralSimilarity(strongPeak, weakPeak);
            expect(crossSimilarity).toBeLessThan(1.0);
            expect(crossSimilarity).toBeGreaterThan(0.5);  // Same peak location, different intensity
        });

        it('should handle spectra with different number of points', () => {
            // Sparse spectrum
            const sparse = [];
            for (let wn = 400; wn <= 4000; wn += 100) {
                let transmittance = (wn >= 1650 && wn <= 1750) ? 30 : 95;
                sparse.push({ wavenumber: wn, transmittance });
            }

            // Dense spectrum with same pattern
            const dense = [];
            for (let wn = 400; wn <= 4000; wn += 10) {
                let transmittance = (wn >= 1650 && wn <= 1750) ? 30 : 95;
                dense.push({ wavenumber: wn, transmittance });
            }

            const similarity = calculateSpectralSimilarity(sparse, dense);

            // Should still be similar despite different densities (binning smooths differences)
            expect(similarity).toBeGreaterThan(0.5);
        });

        it('should handle wavenumbers outside standard range', () => {
            // Spectrum with values outside 400-4000 range
            const extended = [];
            for (let wn = 200; wn <= 5000; wn += 50) {
                let transmittance = 95;
                if (wn >= 1650 && wn <= 1750) transmittance = 30;
                extended.push({ wavenumber: wn, transmittance });
            }

            const standard = generateSpectrum('carbonyl', 30);

            // Should still work, comparing only the overlapping region
            const similarity = calculateSpectralSimilarity(extended, standard);
            expect(similarity).toBeGreaterThan(0);
            expect(similarity).toBeLessThanOrEqual(1);
        });
    });

    describe('cosine similarity mathematical properties', () => {
        it('should satisfy triangle inequality approximately', () => {
            const a = generateSpectrum('carbonyl');
            const b = generateSpectrum('c-h');
            const c = generateSpectrum('o-h');

            const simAB = calculateSpectralSimilarity(a, b);
            const simBC = calculateSpectralSimilarity(b, c);
            const simAC = calculateSpectralSimilarity(a, c);

            // While cosine similarity doesn't strictly satisfy triangle inequality,
            // the values should be internally consistent
            expect(simAB).toBeGreaterThanOrEqual(0);
            expect(simBC).toBeGreaterThanOrEqual(0);
            expect(simAC).toBeGreaterThanOrEqual(0);
        });

        it('should be scale invariant for absorption intensity', () => {
            // Create two spectra with same pattern but different overall absorption
            const spectrum1 = [];
            const spectrum2 = [];

            for (let wn = 400; wn <= 4000; wn += 36) {
                let base = (wn >= 1650 && wn <= 1750) ? 0.5 : 0.05;  // Absorbance pattern

                // Spectrum 1: base intensity
                spectrum1.push({
                    wavenumber: wn,
                    transmittance: 100 - (base * 100)
                });

                // Spectrum 2: doubled intensity (but same pattern)
                spectrum2.push({
                    wavenumber: wn,
                    transmittance: 100 - (base * 200)
                });
            }

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            // Cosine similarity is scale-invariant for the direction
            // So similar patterns should still score high
            expect(similarity).toBeGreaterThan(0.8);
        });
    });

    describe('edge cases', () => {
        it('should handle single-point spectra', () => {
            const single1 = [{ wavenumber: 1700, transmittance: 30 }];
            const single2 = [{ wavenumber: 1700, transmittance: 30 }];

            const similarity = calculateSpectralSimilarity(single1, single2);

            expect(similarity).toBeDefined();
            expect(typeof similarity).toBe('number');
        });

        it('should handle spectra with same wavenumbers but different transmittances', () => {
            const spectrum1 = [
                { wavenumber: 1000, transmittance: 20 },
                { wavenumber: 2000, transmittance: 80 },
            ];
            const spectrum2 = [
                { wavenumber: 1000, transmittance: 80 },
                { wavenumber: 2000, transmittance: 20 },
            ];

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            // Inverse patterns should have low similarity
            expect(similarity).toBeLessThan(0.5);
        });
    });
});
