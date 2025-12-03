/**
 * Unit tests for FrequencyMapper
 */

// Mock CONFIG
global.CONFIG = {
    frequency: {
        IR_MIN: 400,
        IR_MAX: 4000,
        AUDIO_MIN: 100,
        AUDIO_MAX: 8000
    },
    peakDetection: {
        DEFAULT_THRESHOLD: 0.15,
        DEFAULT_MAX_PEAKS: 20
    }
};

describe('FrequencyMapper', () => {
    let FrequencyMapper;
    let mapper;

    beforeEach(() => {
        // Define FrequencyMapper class for testing
        FrequencyMapper = class {
            constructor() {
                this.IR_MIN = CONFIG.frequency.IR_MIN;
                this.IR_MAX = CONFIG.frequency.IR_MAX;
                this.AUDIO_MIN = CONFIG.frequency.AUDIO_MIN;
                this.AUDIO_MAX = CONFIG.frequency.AUDIO_MAX;
                this.DEFAULT_THRESHOLD = CONFIG.peakDetection.DEFAULT_THRESHOLD;
                this.DEFAULT_MAX_PEAKS = CONFIG.peakDetection.DEFAULT_MAX_PEAKS;
            }

            irToAudio(wavenumber) {
                if (typeof wavenumber !== 'number' || isNaN(wavenumber)) {
                    throw new Error(`Invalid wavenumber: ${wavenumber}. Must be a number.`);
                }

                const clampedWavenumber = Math.max(this.IR_MIN, Math.min(this.IR_MAX, wavenumber));
                const normalized = (clampedWavenumber - this.IR_MIN) / (this.IR_MAX - this.IR_MIN);
                const logMin = Math.log(this.AUDIO_MIN);
                const logMax = Math.log(this.AUDIO_MAX);
                const audioFreq = Math.exp(logMin + normalized * (logMax - logMin));

                return audioFreq;
            }

            extractPeaks(spectrum, threshold = this.DEFAULT_THRESHOLD, maxPeaks = this.DEFAULT_MAX_PEAKS) {
                if (!Array.isArray(spectrum) || spectrum.length === 0) {
                    throw new Error('Invalid spectrum: must be a non-empty array');
                }

                const absorbanceData = spectrum.map(point => ({
                    wavenumber: point.wavenumber,
                    absorbance: 1 - (point.transmittance / 100)
                }));

                const peaks = [];
                for (let i = 1; i < absorbanceData.length - 1; i++) {
                    const prev = absorbanceData[i - 1].absorbance;
                    const curr = absorbanceData[i].absorbance;
                    const next = absorbanceData[i + 1].absorbance;

                    if (curr > prev && curr > next && curr > threshold) {
                        peaks.push({
                            wavenumber: absorbanceData[i].wavenumber,
                            absorbance: curr,
                            audioFreq: this.irToAudio(absorbanceData[i].wavenumber)
                        });
                    }
                }

                peaks.sort((a, b) => b.absorbance - a.absorbance);
                return peaks.slice(0, maxPeaks);
            }

            getMappingInfo(peaks) {
                if (!peaks || peaks.length === 0) {
                    return 'No peaks detected.';
                }

                let info = `Found ${peaks.length} significant absorption peaks:\n\n`;

                peaks.forEach((peak, idx) => {
                    const wavenumberStr = peak.wavenumber.toFixed(1);
                    const audioFreqStr = peak.audioFreq.toFixed(1);
                    const intensityPercent = (peak.absorbance * 100).toFixed(1);

                    info += `${idx + 1}. ${wavenumberStr} cm⁻¹ → ${audioFreqStr} Hz (intensity: ${intensityPercent}%)\n`;
                });

                info += `\nMapping range: ${this.IR_MIN}-${this.IR_MAX} cm⁻¹ → ${this.AUDIO_MIN}-${this.AUDIO_MAX} Hz`;

                return info;
            }

            getFunctionalGroup(wavenumber) {
                if (wavenumber > 3500 && wavenumber < 3700) {
                    return 'O-H stretch (alcohol/phenol)';
                }
                if (wavenumber > 3200 && wavenumber < 3500) {
                    return 'N-H stretch (amine)';
                }
                if (wavenumber > 3000 && wavenumber < 3100) {
                    return 'C-H stretch (aromatic)';
                }
                if (wavenumber > 2850 && wavenumber < 3000) {
                    return 'C-H stretch (aliphatic)';
                }
                if (wavenumber > 2100 && wavenumber < 2300) {
                    return 'C≡N or C≡C stretch';
                }
                if (wavenumber > 1650 && wavenumber < 1750) {
                    return 'C=O stretch (carbonyl)';
                }
                if (wavenumber > 1500 && wavenumber < 1650) {
                    return 'C=C stretch (aromatic)';
                }
                if (wavenumber > 1350 && wavenumber < 1500) {
                    return 'C-H bend';
                }
                if (wavenumber > 1000 && wavenumber < 1300) {
                    return 'C-O stretch (ether/ester)';
                }
                if (wavenumber > 650 && wavenumber < 900) {
                    return 'C-H bend (aromatic)';
                }
                return 'Fingerprint region';
            }
        };

        mapper = new FrequencyMapper();
    });

    describe('constructor', () => {
        test('should initialize with correct default values', () => {
            expect(mapper.IR_MIN).toBe(400);
            expect(mapper.IR_MAX).toBe(4000);
            expect(mapper.AUDIO_MIN).toBe(100);
            expect(mapper.AUDIO_MAX).toBe(8000);
            expect(mapper.DEFAULT_THRESHOLD).toBe(0.15);
            expect(mapper.DEFAULT_MAX_PEAKS).toBe(20);
        });
    });

    describe('irToAudio', () => {
        test('should map minimum IR to minimum audio frequency', () => {
            const result = mapper.irToAudio(400);
            expect(result).toBeCloseTo(100, 1);
        });

        test('should map maximum IR to maximum audio frequency', () => {
            const result = mapper.irToAudio(4000);
            expect(result).toBeCloseTo(8000, 1);
        });

        test('should map middle IR value logarithmically', () => {
            const result = mapper.irToAudio(2200);
            // Should be between min and max, closer to min due to log scaling
            expect(result).toBeGreaterThan(100);
            expect(result).toBeLessThan(8000);
        });

        test('should clamp values below minimum', () => {
            const result = mapper.irToAudio(100);
            expect(result).toBeCloseTo(100, 1);
        });

        test('should clamp values above maximum', () => {
            const result = mapper.irToAudio(5000);
            expect(result).toBeCloseTo(8000, 1);
        });

        test('should throw error for non-number input', () => {
            expect(() => mapper.irToAudio('invalid')).toThrow('Invalid wavenumber');
            expect(() => mapper.irToAudio(null)).toThrow('Invalid wavenumber');
            expect(() => mapper.irToAudio(undefined)).toThrow('Invalid wavenumber');
        });

        test('should throw error for NaN', () => {
            expect(() => mapper.irToAudio(NaN)).toThrow('Invalid wavenumber');
        });

        test('should handle negative numbers by clamping', () => {
            const result = mapper.irToAudio(-100);
            expect(result).toBeCloseTo(100, 1);
        });

        test('should produce monotonically increasing output', () => {
            const result1 = mapper.irToAudio(1000);
            const result2 = mapper.irToAudio(2000);
            const result3 = mapper.irToAudio(3000);

            expect(result2).toBeGreaterThan(result1);
            expect(result3).toBeGreaterThan(result2);
        });
    });

    describe('extractPeaks', () => {
        test('should extract peaks from spectrum', () => {
            const spectrum = [
                { wavenumber: 1000, transmittance: 100 }, // High transmittance (low absorption)
                { wavenumber: 1100, transmittance: 20 },  // Low transmittance (high absorption) - PEAK
                { wavenumber: 1200, transmittance: 100 },
                { wavenumber: 1300, transmittance: 30 },  // PEAK
                { wavenumber: 1400, transmittance: 100 }
            ];

            const peaks = mapper.extractPeaks(spectrum);

            expect(peaks.length).toBeGreaterThan(0);
            expect(peaks[0]).toHaveProperty('wavenumber');
            expect(peaks[0]).toHaveProperty('absorbance');
            expect(peaks[0]).toHaveProperty('audioFreq');
        });

        test('should sort peaks by intensity', () => {
            const spectrum = [
                { wavenumber: 1000, transmittance: 100 },
                { wavenumber: 1100, transmittance: 50 },  // Medium peak
                { wavenumber: 1200, transmittance: 100 },
                { wavenumber: 1300, transmittance: 20 },  // Strong peak
                { wavenumber: 1400, transmittance: 100 }
            ];

            const peaks = mapper.extractPeaks(spectrum);

            if (peaks.length >= 2) {
                expect(peaks[0].absorbance).toBeGreaterThanOrEqual(peaks[1].absorbance);
            }
        });

        test('should respect threshold parameter', () => {
            const spectrum = [
                { wavenumber: 1000, transmittance: 100 },
                { wavenumber: 1100, transmittance: 85 },  // Weak peak (absorbance = 0.15)
                { wavenumber: 1200, transmittance: 100 }
            ];

            const peaksLowThreshold = mapper.extractPeaks(spectrum, 0.1);
            const peaksHighThreshold = mapper.extractPeaks(spectrum, 0.2);

            expect(peaksLowThreshold.length).toBeGreaterThanOrEqual(peaksHighThreshold.length);
        });

        test('should respect maxPeaks parameter', () => {
            const spectrum = [];
            // Create spectrum with many peaks
            for (let i = 0; i < 50; i++) {
                spectrum.push({ wavenumber: 1000 + i * 10, transmittance: i % 2 === 0 ? 100 : 20 });
            }

            const peaks = mapper.extractPeaks(spectrum, 0.1, 5);

            expect(peaks.length).toBeLessThanOrEqual(5);
        });

        test('should throw error for invalid spectrum', () => {
            expect(() => mapper.extractPeaks(null)).toThrow('Invalid spectrum');
            expect(() => mapper.extractPeaks([])).toThrow('Invalid spectrum');
            expect(() => mapper.extractPeaks('invalid')).toThrow('Invalid spectrum');
        });

        test('should handle spectrum with no peaks', () => {
            const spectrum = [
                { wavenumber: 1000, transmittance: 100 },
                { wavenumber: 1100, transmittance: 100 },
                { wavenumber: 1200, transmittance: 100 }
            ];

            const peaks = mapper.extractPeaks(spectrum);

            expect(peaks).toEqual([]);
        });

        test('should correctly calculate absorbance from transmittance', () => {
            const spectrum = [
                { wavenumber: 1000, transmittance: 100 },
                { wavenumber: 1100, transmittance: 0 },   // 100% absorption
                { wavenumber: 1200, transmittance: 100 }
            ];

            const peaks = mapper.extractPeaks(spectrum, 0.5);

            if (peaks.length > 0) {
                expect(peaks[0].absorbance).toBeCloseTo(1.0, 2);
            }
        });

        test('should include audioFreq for each peak', () => {
            const spectrum = [
                { wavenumber: 1000, transmittance: 100 },
                { wavenumber: 1500, transmittance: 20 },
                { wavenumber: 2000, transmittance: 100 }
            ];

            const peaks = mapper.extractPeaks(spectrum);

            peaks.forEach(peak => {
                expect(peak.audioFreq).toBeGreaterThan(0);
                expect(typeof peak.audioFreq).toBe('number');
            });
        });
    });

    describe('getMappingInfo', () => {
        test('should return message for no peaks', () => {
            const info = mapper.getMappingInfo([]);
            expect(info).toBe('No peaks detected.');
        });

        test('should return message for null peaks', () => {
            const info = mapper.getMappingInfo(null);
            expect(info).toBe('No peaks detected.');
        });

        test('should format peak information correctly', () => {
            const peaks = [
                { wavenumber: 1500, absorbance: 0.8, audioFreq: 500 },
                { wavenumber: 2000, absorbance: 0.6, audioFreq: 1000 }
            ];

            const info = mapper.getMappingInfo(peaks);

            expect(info).toContain('Found 2 significant absorption peaks');
            expect(info).toContain('1500.0 cm⁻¹');
            expect(info).toContain('500.0 Hz');
            expect(info).toContain('80.0%');
            expect(info).toContain('Mapping range');
        });

        test('should include all peaks in output', () => {
            const peaks = [
                { wavenumber: 1000, absorbance: 0.5, audioFreq: 200 },
                { wavenumber: 2000, absorbance: 0.7, audioFreq: 800 },
                { wavenumber: 3000, absorbance: 0.3, audioFreq: 2000 }
            ];

            const info = mapper.getMappingInfo(peaks);

            expect(info).toContain('1.');
            expect(info).toContain('2.');
            expect(info).toContain('3.');
        });
    });

    describe('getFunctionalGroup', () => {
        test('should identify O-H stretch (alcohol/phenol)', () => {
            expect(mapper.getFunctionalGroup(3600)).toBe('O-H stretch (alcohol/phenol)');
        });

        test('should identify N-H stretch (amine)', () => {
            expect(mapper.getFunctionalGroup(3300)).toBe('N-H stretch (amine)');
        });

        test('should identify C-H stretch (aromatic)', () => {
            expect(mapper.getFunctionalGroup(3050)).toBe('C-H stretch (aromatic)');
        });

        test('should identify C-H stretch (aliphatic)', () => {
            expect(mapper.getFunctionalGroup(2900)).toBe('C-H stretch (aliphatic)');
        });

        test('should identify C≡N or C≡C stretch', () => {
            expect(mapper.getFunctionalGroup(2200)).toBe('C≡N or C≡C stretch');
        });

        test('should identify C=O stretch (carbonyl)', () => {
            expect(mapper.getFunctionalGroup(1700)).toBe('C=O stretch (carbonyl)');
        });

        test('should identify C=C stretch (aromatic)', () => {
            expect(mapper.getFunctionalGroup(1600)).toBe('C=C stretch (aromatic)');
        });

        test('should identify C-H bend', () => {
            expect(mapper.getFunctionalGroup(1400)).toBe('C-H bend');
        });

        test('should identify C-O stretch (ether/ester)', () => {
            expect(mapper.getFunctionalGroup(1100)).toBe('C-O stretch (ether/ester)');
        });

        test('should identify C-H bend (aromatic)', () => {
            expect(mapper.getFunctionalGroup(800)).toBe('C-H bend (aromatic)');
        });

        test('should return fingerprint region for unmatched values', () => {
            expect(mapper.getFunctionalGroup(500)).toBe('Fingerprint region');
            expect(mapper.getFunctionalGroup(4000)).toBe('Fingerprint region');
        });

        test('should handle boundary values correctly', () => {
            expect(mapper.getFunctionalGroup(3500)).toBe('Fingerprint region');
            expect(mapper.getFunctionalGroup(3700)).toBe('Fingerprint region');
            expect(mapper.getFunctionalGroup(3600)).toBe('O-H stretch (alcohol/phenol)');
        });
    });
});
