/**
 * Unit Tests for CSVImporter Module
 *
 * Tests CSV file parsing, validation, and data processing for FTIR spectra.
 */

const { loadBrowserModule } = require('./test-helpers');
const { CSVImporter } = loadBrowserModule('csv-importer.js');

describe('CSVImporter', () => {
    // Helper to create mock File
    const createMockFile = (content, name, type = 'text/csv') => {
        return new File([content], name, { type });
    };

    describe('parseCSV', () => {
        it('should parse valid CSV with header', async () => {
            const csv = `wavenumber,transmittance
400,95.0
800,90.0
1200,85.0
1600,80.0
2000,75.0`;

            const file = createMockFile(csv, 'test.csv');
            const result = await CSVImporter.parseCSV(file);

            expect(result.name).toBe('test');
            expect(result.spectrum).toHaveLength(5);
            expect(result.spectrum[0].wavenumber).toBe(400);
            expect(result.spectrum[0].transmittance).toBe(95.0);
        });

        it('should parse CSV without header', async () => {
            const csv = `400,95.0
800,90.0
1200,85.0`;

            const file = createMockFile(csv, 'noheader.csv');
            const result = await CSVImporter.parseCSV(file);

            expect(result.spectrum).toHaveLength(3);
            expect(result.spectrum[0].wavenumber).toBe(400);
        });

        it('should handle semicolon delimiters', async () => {
            const csv = `wavenumber;transmittance
400;95.0
800;90.0`;

            const file = createMockFile(csv, 'semicolon.csv');
            const result = await CSVImporter.parseCSV(file);

            expect(result.spectrum).toHaveLength(2);
        });

        it('should handle tab delimiters', async () => {
            const csv = `wavenumber\ttransmittance
400\t95.0
800\t90.0`;

            const file = createMockFile(csv, 'tab.csv');
            const result = await CSVImporter.parseCSV(file);

            expect(result.spectrum).toHaveLength(2);
        });

        it('should detect and convert absorbance data', async () => {
            const csv = `wavenumber,absorbance
400,0.1
800,0.5
1200,1.0`;

            const file = createMockFile(csv, 'absorbance.csv');
            const result = await CSVImporter.parseCSV(file);

            // Absorbance 0.1 -> Transmittance ~79.4%
            // Absorbance 0.5 -> Transmittance ~31.6%
            // Absorbance 1.0 -> Transmittance 10%
            expect(result.spectrum[0].transmittance).toBeCloseTo(79.43, 1);
            expect(result.spectrum[1].transmittance).toBeCloseTo(31.62, 1);
            expect(result.spectrum[2].transmittance).toBeCloseTo(10, 1);
        });

        it('should sort spectrum by wavenumber', async () => {
            const csv = `wavenumber,transmittance
2000,75.0
400,95.0
1200,85.0`;

            const file = createMockFile(csv, 'unsorted.csv');
            const result = await CSVImporter.parseCSV(file);

            expect(result.spectrum[0].wavenumber).toBe(400);
            expect(result.spectrum[1].wavenumber).toBe(1200);
            expect(result.spectrum[2].wavenumber).toBe(2000);
        });

        it('should include metadata in result', async () => {
            const csv = `wavenumber,transmittance
400,95.0
800,90.0`;

            const file = createMockFile(csv, 'metadata.csv');
            const result = await CSVImporter.parseCSV(file);

            expect(result.source).toBe('User Import');
            expect(result.category).toBe('custom');
            expect(result.metadata).toBeDefined();
            expect(result.metadata.originalPoints).toBe(2);
            expect(result.metadata.finalPoints).toBe(2);
            expect(result.metadata.wavenumberRange).toEqual([400, 800]);
            expect(result.metadata.importDate).toBeDefined();
        });

        it('should throw error for non-CSV file', async () => {
            const file = createMockFile('some data', 'test.txt');
            await expect(CSVImporter.parseCSV(file)).rejects.toThrow('must be a CSV file');
        });

        it('should throw error for null file', async () => {
            await expect(CSVImporter.parseCSV(null)).rejects.toThrow('No file provided');
        });

        it('should throw error for empty file', async () => {
            const file = createMockFile('', 'empty.csv');
            file.size = 0;
            await expect(CSVImporter.parseCSV(file)).rejects.toThrow('File is empty');
        });

        it('should handle file with single data point', async () => {
            const csv = `wavenumber,transmittance
400,95.0`;

            const file = createMockFile(csv, 'single.csv');
            const result = await CSVImporter.parseCSV(file);

            // Module accepts single data point (may be useful for comparison)
            expect(result.spectrum).toHaveLength(1);
        });

        it('should skip invalid lines gracefully', async () => {
            const csv = `wavenumber,transmittance
400,95.0
invalid,data
800,90.0
,
1200,85.0`;

            const file = createMockFile(csv, 'mixed.csv');
            const result = await CSVImporter.parseCSV(file);

            expect(result.spectrum).toHaveLength(3);
            expect(Logger.warn).toHaveBeenCalled();
        });

        it('should clamp transmittance to valid range', async () => {
            const csv = `wavenumber,transmittance
400,150
800,-10`;

            const file = createMockFile(csv, 'outofrange.csv');
            const result = await CSVImporter.parseCSV(file);

            expect(result.spectrum[0].transmittance).toBe(100);
            expect(result.spectrum[1].transmittance).toBe(0);
        });

        it('should throw error for CSV with no valid data', async () => {
            const csv = `wavenumber,transmittance
invalid,data
also,invalid`;

            const file = createMockFile(csv, 'invalid.csv');
            await expect(CSVImporter.parseCSV(file)).rejects.toThrow('No valid data points');
        });
    });

    describe('sanitizeName', () => {
        it('should remove XSS-prone characters', () => {
            expect(CSVImporter.sanitizeName('test<script>')).toBe('testscript');
            expect(CSVImporter.sanitizeName("test'name")).toBe('testname');
            expect(CSVImporter.sanitizeName('test"name')).toBe('testname');
            expect(CSVImporter.sanitizeName('test&name')).toBe('testname');
        });

        it('should replace path separators', () => {
            expect(CSVImporter.sanitizeName('path/to/file')).toBe('path-to-file');
            expect(CSVImporter.sanitizeName('path\\to\\file')).toBe('path-to-file');
        });

        it('should limit length to 100 characters', () => {
            const longName = 'a'.repeat(150);
            expect(CSVImporter.sanitizeName(longName).length).toBe(100);
        });

        it('should return "Untitled" for empty input', () => {
            expect(CSVImporter.sanitizeName('')).toBe('Untitled');
            expect(CSVImporter.sanitizeName(null)).toBe('Untitled');
            expect(CSVImporter.sanitizeName(undefined)).toBe('Untitled');
        });

        it('should trim whitespace', () => {
            expect(CSVImporter.sanitizeName('  test  ')).toBe('test');
        });
    });

    describe('downsample', () => {
        it('should reduce spectrum to target points', () => {
            const spectrum = [];
            for (let i = 0; i < 100; i++) {
                spectrum.push({ wavenumber: i * 10, transmittance: 90 });
            }

            const downsampled = CSVImporter.downsample(spectrum, 20);

            expect(downsampled.length).toBe(20);
        });

        it('should preserve data when fewer points than target', () => {
            const spectrum = [
                { wavenumber: 400, transmittance: 95 },
                { wavenumber: 800, transmittance: 90 },
            ];

            const result = CSVImporter.downsample(spectrum, 100);

            expect(result).toEqual(spectrum);
        });

        it('should average values in each bin', () => {
            const spectrum = [
                { wavenumber: 100, transmittance: 80 },
                { wavenumber: 200, transmittance: 90 },
                { wavenumber: 300, transmittance: 85 },
                { wavenumber: 400, transmittance: 95 },
            ];

            const result = CSVImporter.downsample(spectrum, 2);

            // First bin: avg of (100,200) = 150, avg of (80,90) = 85
            // Second bin: avg of (300,400) = 350, avg of (85,95) = 90
            expect(result[0].wavenumber).toBeCloseTo(150);
            expect(result[0].transmittance).toBeCloseTo(85);
            expect(result[1].wavenumber).toBeCloseTo(350);
            expect(result[1].transmittance).toBeCloseTo(90);
        });
    });

    describe('validate', () => {
        it('should pass for valid data', () => {
            const data = {
                name: 'Test Compound',
                spectrum: [
                    { wavenumber: 400, transmittance: 95 },
                    { wavenumber: 800, transmittance: 90 },
                ],
            };

            expect(CSVImporter.validate(data)).toBe(true);
        });

        it('should throw for null data', () => {
            expect(() => CSVImporter.validate(null)).toThrow('Invalid data structure');
        });

        it('should throw for missing name', () => {
            const data = {
                spectrum: [{ wavenumber: 400, transmittance: 95 }],
            };

            expect(() => CSVImporter.validate(data)).toThrow('Missing or invalid name');
        });

        it('should throw for empty spectrum', () => {
            const data = {
                name: 'Test',
                spectrum: [],
            };

            expect(() => CSVImporter.validate(data)).toThrow('non-empty array');
        });

        it('should throw for invalid spectrum point structure', () => {
            const data = {
                name: 'Test',
                spectrum: [
                    { wavenumber: 'invalid', transmittance: 95 },
                ],
            };

            expect(() => CSVImporter.validate(data)).toThrow('Invalid spectrum data point');
        });
    });

    describe('generateTemplate', () => {
        it('should return valid CSV string', () => {
            const template = CSVImporter.generateTemplate();

            expect(typeof template).toBe('string');
            expect(template).toContain('wavenumber,transmittance');
            expect(template.split('\n').length).toBeGreaterThan(10);
        });

        it('should include data covering FTIR range', () => {
            const template = CSVImporter.generateTemplate();
            const lines = template.split('\n');

            // First data line (skip header)
            const firstData = lines[1].split(',');
            const lastData = lines[lines.length - 1].split(',');

            expect(parseFloat(firstData[0])).toBe(400);
            expect(parseFloat(lastData[0])).toBe(4000);
        });
    });
});
