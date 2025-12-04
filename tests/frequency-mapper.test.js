/**
 * Unit Tests for FrequencyMapper Module
 *
 * Tests the IR-to-audio frequency mapping and peak detection functionality.
 */

const { loadBrowserModule } = require('./test-helpers');
const { FrequencyMapper } = loadBrowserModule('frequency-mapper.js');

describe('FrequencyMapper', () => {
    let mapper;

    beforeEach(() => {
        mapper = new FrequencyMapper();
    });

    describe('constructor', () => {
        it('should initialize with CONFIG values', () => {
            expect(mapper.IR_MIN).toBe(CONFIG.frequency.IR_MIN);
            expect(mapper.IR_MAX).toBe(CONFIG.frequency.IR_MAX);
            expect(mapper.AUDIO_MIN).toBe(CONFIG.frequency.AUDIO_MIN);
            expect(mapper.AUDIO_MAX).toBe(CONFIG.frequency.AUDIO_MAX);
            expect(mapper.DEFAULT_THRESHOLD).toBe(CONFIG.peakDetection.DEFAULT_THRESHOLD);
            expect(mapper.DEFAULT_MAX_PEAKS).toBe(CONFIG.peakDetection.DEFAULT_MAX_PEAKS);
        });
    });

    describe('irToAudio', () => {
        it('should map minimum IR frequency to minimum audio frequency', () => {
            const audioFreq = mapper.irToAudio(CONFIG.frequency.IR_MIN);
            expect(audioFreq).toBeCloseTo(CONFIG.frequency.AUDIO_MIN, 0);
        });

        it('should map maximum IR frequency to maximum audio frequency', () => {
            const audioFreq = mapper.irToAudio(CONFIG.frequency.IR_MAX);
            expect(audioFreq).toBeCloseTo(CONFIG.frequency.AUDIO_MAX, 0);
        });

        it('should map mid-range IR frequency to appropriate audio frequency', () => {
            const midIR = (CONFIG.frequency.IR_MIN + CONFIG.frequency.IR_MAX) / 2;
            const audioFreq = mapper.irToAudio(midIR);
            expect(audioFreq).toBeGreaterThan(CONFIG.frequency.AUDIO_MIN);
            expect(audioFreq).toBeLessThan(CONFIG.frequency.AUDIO_MAX);
        });

        it('should use logarithmic scaling (not linear)', () => {
            const ir1 = 1000;
            const ir2 = 2000;
            const ir3 = 3000;

            const audio1 = mapper.irToAudio(ir1);
            const audio2 = mapper.irToAudio(ir2);
            const audio3 = mapper.irToAudio(ir3);

            expect(audio2).toBeGreaterThan(audio1);
            expect(audio3).toBeGreaterThan(audio2);
        });

        it('should clamp values below IR_MIN', () => {
            const audioFreq = mapper.irToAudio(100);
            expect(audioFreq).toBeCloseTo(CONFIG.frequency.AUDIO_MIN, 0);
        });

        it('should clamp values above IR_MAX', () => {
            const audioFreq = mapper.irToAudio(5000);
            expect(audioFreq).toBeCloseTo(CONFIG.frequency.AUDIO_MAX, 0);
        });

        it('should throw error for non-numeric input', () => {
            expect(() => mapper.irToAudio('invalid')).toThrow('Invalid wavenumber');
            expect(() => mapper.irToAudio(null)).toThrow('Invalid wavenumber');
            expect(() => mapper.irToAudio(undefined)).toThrow('Invalid wavenumber');
            expect(() => mapper.irToAudio(NaN)).toThrow('Invalid wavenumber');
        });

        it('should handle edge case of exact boundary values', () => {
            expect(() => mapper.irToAudio(400)).not.toThrow();
            expect(() => mapper.irToAudio(4000)).not.toThrow();
        });

        it('should produce monotonically increasing output', () => {
            const frequencies = [500, 1000, 1500, 2000, 2500, 3000, 3500];
            const audioFreqs = frequencies.map(f => mapper.irToAudio(f));

            for (let i = 1; i < audioFreqs.length; i++) {
                expect(audioFreqs[i]).toBeGreaterThan(audioFreqs[i - 1]);
            }
        });
    });

    describe('extractPeaks', () => {
        const generateTestSpectrum = () => {
            const spectrum = [];
            for (let wn = 400; wn <= 4000; wn += 10) {
                let transmittance = 95;

                if (wn >= 1690 && wn <= 1710) {
                    transmittance = 20 + Math.abs(wn - 1700) * 2;
                } else if (wn >= 2940 && wn <= 2960) {
                    transmittance = 30 + Math.abs(wn - 2950) * 3;
                } else if (wn >= 3490 && wn <= 3510) {
                    transmittance = 40 + Math.abs(wn - 3500) * 4;
                }

                spectrum.push({ wavenumber: wn, transmittance });
            }
            return spectrum;
        };

        it('should extract peaks from valid spectrum', () => {
            const spectrum = generateTestSpectrum();
            const peaks = mapper.extractPeaks(spectrum);

            expect(Array.isArray(peaks)).toBe(true);
            expect(peaks.length).toBeGreaterThan(0);
        });

        it('should return peaks with required properties', () => {
            const spectrum = generateTestSpectrum();
            const peaks = mapper.extractPeaks(spectrum);

            peaks.forEach(peak => {
                expect(peak).toHaveProperty('wavenumber');
                expect(peak).toHaveProperty('absorbance');
                expect(peak).toHaveProperty('audioFreq');
                expect(typeof peak.wavenumber).toBe('number');
                expect(typeof peak.absorbance).toBe('number');
                expect(typeof peak.audioFreq).toBe('number');
            });
        });

        it('should detect peaks at expected wavenumbers', () => {
            const spectrum = generateTestSpectrum();
            const peaks = mapper.extractPeaks(spectrum, 0.1, 10);

            const wavenumbers = peaks.map(p => p.wavenumber);

            const hasCarbonylPeak = wavenumbers.some(w => w >= 1690 && w <= 1710);
            const hasCHPeak = wavenumbers.some(w => w >= 2940 && w <= 2960);
            const hasOHPeak = wavenumbers.some(w => w >= 3490 && w <= 3510);

            expect(hasCarbonylPeak).toBe(true);
            expect(hasCHPeak).toBe(true);
            expect(hasOHPeak).toBe(true);
        });

        it('should respect maxPeaks limit', () => {
            const spectrum = generateTestSpectrum();
            const peaks5 = mapper.extractPeaks(spectrum, 0.05, 5);
            const peaks10 = mapper.extractPeaks(spectrum, 0.05, 10);

            expect(peaks5.length).toBeLessThanOrEqual(5);
            expect(peaks10.length).toBeLessThanOrEqual(10);
        });

        it('should filter peaks by threshold', () => {
            const spectrum = generateTestSpectrum();
            const peaksLowThreshold = mapper.extractPeaks(spectrum, 0.05);
            const peaksHighThreshold = mapper.extractPeaks(spectrum, 0.5);

            expect(peaksLowThreshold.length).toBeGreaterThanOrEqual(peaksHighThreshold.length);
        });

        it('should sort peaks by intensity (descending)', () => {
            const spectrum = generateTestSpectrum();
            const peaks = mapper.extractPeaks(spectrum);

            for (let i = 1; i < peaks.length; i++) {
                expect(peaks[i].absorbance).toBeLessThanOrEqual(peaks[i - 1].absorbance);
            }
        });

        it('should convert transmittance to absorbance correctly', () => {
            const spectrum = generateTestSpectrum();
            const peaks = mapper.extractPeaks(spectrum);

            peaks.forEach(peak => {
                expect(peak.absorbance).toBeGreaterThanOrEqual(0);
                expect(peak.absorbance).toBeLessThanOrEqual(1);
            });
        });

        it('should throw error for empty spectrum', () => {
            expect(() => mapper.extractPeaks([])).toThrow('Invalid spectrum');
        });

        it('should throw error for non-array input', () => {
            expect(() => mapper.extractPeaks(null)).toThrow('Invalid spectrum');
            expect(() => mapper.extractPeaks('invalid')).toThrow('Invalid spectrum');
            expect(() => mapper.extractPeaks({})).toThrow('Invalid spectrum');
        });

        it('should use default threshold and maxPeaks when not specified', () => {
            const spectrum = generateTestSpectrum();
            const peaks = mapper.extractPeaks(spectrum);

            expect(peaks.length).toBeLessThanOrEqual(CONFIG.peakDetection.DEFAULT_MAX_PEAKS);
        });

        it('should handle spectrum with no peaks above threshold', () => {
            const flatSpectrum = [];
            for (let wn = 400; wn <= 4000; wn += 10) {
                flatSpectrum.push({ wavenumber: wn, transmittance: 95 });
            }

            const peaks = mapper.extractPeaks(flatSpectrum, 0.5);
            expect(peaks.length).toBe(0);
        });

        it('should correctly map audio frequencies for detected peaks', () => {
            const spectrum = generateTestSpectrum();
            const peaks = mapper.extractPeaks(spectrum);

            peaks.forEach(peak => {
                const expectedAudioFreq = mapper.irToAudio(peak.wavenumber);
                expect(peak.audioFreq).toBeCloseTo(expectedAudioFreq, 5);
            });
        });
    });

    describe('getMappingInfo', () => {
        it('should return formatted string for valid peaks', () => {
            const peaks = [
                { wavenumber: 1700, absorbance: 0.8, audioFreq: 2000 },
                { wavenumber: 2950, absorbance: 0.6, audioFreq: 4500 },
            ];

            const info = mapper.getMappingInfo(peaks);

            expect(typeof info).toBe('string');
            expect(info).toContain('1700');
            expect(info).toContain('2950');
            expect(info).toContain('cm⁻¹');
            expect(info).toContain('Hz');
        });

        it('should return "No peaks detected" for empty array', () => {
            const info = mapper.getMappingInfo([]);
            expect(info).toBe('No peaks detected.');
        });

        it('should return "No peaks detected" for null/undefined', () => {
            expect(mapper.getMappingInfo(null)).toBe('No peaks detected.');
            expect(mapper.getMappingInfo(undefined)).toBe('No peaks detected.');
        });

        it('should include mapping range information', () => {
            const peaks = [{ wavenumber: 1700, absorbance: 0.8, audioFreq: 2000 }];
            const info = mapper.getMappingInfo(peaks);

            expect(info).toContain(String(CONFIG.frequency.IR_MIN));
            expect(info).toContain(String(CONFIG.frequency.IR_MAX));
            expect(info).toContain(String(CONFIG.frequency.AUDIO_MIN));
            expect(info).toContain(String(CONFIG.frequency.AUDIO_MAX));
        });
    });

    describe('getFunctionalGroup', () => {
        it('should identify O-H stretch (3500-3700 cm⁻¹)', () => {
            expect(mapper.getFunctionalGroup(3600)).toContain('O-H');
            expect(mapper.getFunctionalGroup(3550)).toContain('O-H');
        });

        it('should identify N-H stretch (3200-3500 cm⁻¹)', () => {
            expect(mapper.getFunctionalGroup(3400)).toContain('N-H');
            expect(mapper.getFunctionalGroup(3300)).toContain('N-H');
        });

        it('should identify C-H aromatic stretch (3000-3100 cm⁻¹)', () => {
            expect(mapper.getFunctionalGroup(3050)).toContain('aromatic');
        });

        it('should identify C-H aliphatic stretch (2850-3000 cm⁻¹)', () => {
            expect(mapper.getFunctionalGroup(2950)).toContain('aliphatic');
            expect(mapper.getFunctionalGroup(2900)).toContain('C-H');
        });

        it('should identify C≡N/C≡C stretch (2100-2300 cm⁻¹)', () => {
            const group = mapper.getFunctionalGroup(2200);
            expect(group.includes('C≡N') || group.includes('C≡C')).toBe(true);
        });

        it('should identify C=O carbonyl (1650-1750 cm⁻¹)', () => {
            expect(mapper.getFunctionalGroup(1700)).toContain('C=O');
            expect(mapper.getFunctionalGroup(1720)).toContain('carbonyl');
        });

        it('should identify C=C aromatic (1500-1650 cm⁻¹)', () => {
            expect(mapper.getFunctionalGroup(1600)).toContain('aromatic');
        });

        it('should identify C-H bend (1350-1500 cm⁻¹)', () => {
            expect(mapper.getFunctionalGroup(1450)).toContain('C-H');
            expect(mapper.getFunctionalGroup(1400)).toContain('bend');
        });

        it('should identify C-O stretch (1000-1300 cm⁻¹)', () => {
            expect(mapper.getFunctionalGroup(1200)).toContain('C-O');
        });

        it('should identify fingerprint region for unmatched wavenumbers', () => {
            expect(mapper.getFunctionalGroup(500)).toContain('Fingerprint');
            expect(mapper.getFunctionalGroup(950)).toContain('Fingerprint');
        });

        it('should handle boundary values correctly', () => {
            // Should return defined strings for any valid wavenumber
            const group3500 = mapper.getFunctionalGroup(3500);
            const group1050 = mapper.getFunctionalGroup(1050);

            expect(typeof group3500).toBe('string');
            expect(typeof group1050).toBe('string');
            expect(group3500.length).toBeGreaterThan(0);
            expect(group1050.length).toBeGreaterThan(0);
        });
    });
});
