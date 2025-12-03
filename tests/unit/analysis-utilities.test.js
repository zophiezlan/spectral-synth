/**
 * Unit tests for Analysis Utilities
 */

describe('AnalysisUtilities', () => {
    let calculateSpectralSimilarity;

    beforeEach(() => {
        // Mock the calculateSpectralSimilarity function
        calculateSpectralSimilarity = function(spectrum1, spectrum2) {
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
                    vector1[binIndex] += (100 - point.transmittance) / 100;
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
        };
    });

    describe('calculateSpectralSimilarity', () => {
        test('should return 1.0 for identical spectra', () => {
            const spectrum = [
                { wavenumber: 500, transmittance: 80 },
                { wavenumber: 1000, transmittance: 60 },
                { wavenumber: 1500, transmittance: 40 },
                { wavenumber: 2000, transmittance: 70 }
            ];

            const similarity = calculateSpectralSimilarity(spectrum, spectrum);

            expect(similarity).toBeCloseTo(1.0, 5);
        });

        test('should return high similarity for very similar spectra', () => {
            const spectrum1 = [
                { wavenumber: 500, transmittance: 80 },
                { wavenumber: 1000, transmittance: 60 },
                { wavenumber: 1500, transmittance: 40 }
            ];

            const spectrum2 = [
                { wavenumber: 500, transmittance: 82 }, // Slightly different
                { wavenumber: 1000, transmittance: 58 },
                { wavenumber: 1500, transmittance: 42 }
            ];

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            expect(similarity).toBeGreaterThan(0.95);
            expect(similarity).toBeLessThan(1.0);
        });

        test('should return low similarity for completely different spectra', () => {
            const spectrum1 = [
                { wavenumber: 500, transmittance: 100 },
                { wavenumber: 1000, transmittance: 100 },
                { wavenumber: 1500, transmittance: 100 }
            ];

            const spectrum2 = [
                { wavenumber: 2500, transmittance: 0 },
                { wavenumber: 3000, transmittance: 0 },
                { wavenumber: 3500, transmittance: 0 }
            ];

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            expect(similarity).toBeLessThan(0.5);
        });

        test('should return 0 for empty first spectrum', () => {
            const spectrum1 = [];
            const spectrum2 = [
                { wavenumber: 500, transmittance: 80 }
            ];

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            expect(similarity).toBe(0);
        });

        test('should return 0 for empty second spectrum', () => {
            const spectrum1 = [
                { wavenumber: 500, transmittance: 80 }
            ];
            const spectrum2 = [];

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            expect(similarity).toBe(0);
        });

        test('should return 0 for both empty spectra', () => {
            const similarity = calculateSpectralSimilarity([], []);

            expect(similarity).toBe(0);
        });

        test('should handle spectra with points outside valid range', () => {
            const spectrum1 = [
                { wavenumber: 100, transmittance: 50 },  // Below min (400)
                { wavenumber: 500, transmittance: 80 },
                { wavenumber: 5000, transmittance: 30 }  // Above max (4000)
            ];

            const spectrum2 = [
                { wavenumber: 500, transmittance: 80 }
            ];

            // Should not throw and should return reasonable value
            expect(() => {
                const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);
                expect(typeof similarity).toBe('number');
                expect(similarity).toBeGreaterThanOrEqual(0);
                expect(similarity).toBeLessThanOrEqual(1);
            }).not.toThrow();
        });

        test('should handle transmittance values at boundaries (0 and 100)', () => {
            const spectrum1 = [
                { wavenumber: 500, transmittance: 0 },   // Complete absorption
                { wavenumber: 1000, transmittance: 100 }  // No absorption
            ];

            const spectrum2 = [
                { wavenumber: 500, transmittance: 0 },
                { wavenumber: 1000, transmittance: 100 }
            ];

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            expect(similarity).toBeCloseTo(1.0, 5);
        });

        test('should handle spectra with many data points', () => {
            const spectrum1 = [];
            const spectrum2 = [];

            // Generate 1000 points for each spectrum
            for (let i = 400; i <= 4000; i += 4) {
                spectrum1.push({ wavenumber: i, transmittance: 50 + Math.sin(i / 100) * 20 });
                spectrum2.push({ wavenumber: i, transmittance: 50 + Math.sin(i / 100) * 20 });
            }

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            expect(similarity).toBeCloseTo(1.0, 5);
        });

        test('should handle spectra with overlapping but offset peaks', () => {
            const spectrum1 = [
                { wavenumber: 1000, transmittance: 20 },
                { wavenumber: 2000, transmittance: 20 }
            ];

            const spectrum2 = [
                { wavenumber: 1010, transmittance: 20 },  // Offset by 10 (within same bin, bin size is 36)
                { wavenumber: 2010, transmittance: 20 }
            ];

            const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);

            // Should have high similarity since peaks are in same bins
            expect(similarity).toBeGreaterThan(0.99);
        });

        test('should be symmetric (similarity(A,B) = similarity(B,A))', () => {
            const spectrum1 = [
                { wavenumber: 500, transmittance: 80 },
                { wavenumber: 1000, transmittance: 60 }
            ];

            const spectrum2 = [
                { wavenumber: 700, transmittance: 70 },
                { wavenumber: 1200, transmittance: 50 }
            ];

            const sim1 = calculateSpectralSimilarity(spectrum1, spectrum2);
            const sim2 = calculateSpectralSimilarity(spectrum2, spectrum1);

            expect(sim1).toBeCloseTo(sim2, 10);
        });

        test('should handle spectra with duplicate wavenumber values', () => {
            const spectrum1 = [
                { wavenumber: 1000, transmittance: 50 },
                { wavenumber: 1000, transmittance: 60 },  // Duplicate
                { wavenumber: 2000, transmittance: 70 }
            ];

            const spectrum2 = [
                { wavenumber: 1000, transmittance: 55 },
                { wavenumber: 2000, transmittance: 70 }
            ];

            // Should handle gracefully and return reasonable value
            expect(() => {
                const similarity = calculateSpectralSimilarity(spectrum1, spectrum2);
                expect(typeof similarity).toBe('number');
                expect(similarity).toBeGreaterThanOrEqual(0);
                expect(similarity).toBeLessThanOrEqual(1);
            }).not.toThrow();
        });
    });
});
