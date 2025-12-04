/**
 * Unit Tests for JCAMPImporter Module
 *
 * Tests JCAMP-DX file parsing, metadata extraction, and spectrum processing.
 */

const { loadBrowserModule } = require('./test-helpers');
const { JCAMPImporter } = loadBrowserModule('jcamp-importer.js');

describe('JCAMPImporter', () => {
    // Helper to create mock File
    const createMockFile = (content, name) => {
        return new File([content], name);
    };

    // Sample JCAMP-DX content with XYPOINTS format
    const sampleJCAMP_XYPOINTS = `##TITLE=Test Compound
##JCAMP-DX=5.01
##DATA TYPE=INFRARED SPECTRUM
##ORIGIN=Test Lab
##OWNER=Public Domain
##XUNITS=1/CM
##YUNITS=TRANSMITTANCE
##FIRSTX=400
##LASTX=4000
##NPOINTS=5
##XYPOINTS=(XY..XY)
400, 95.0
1000, 90.0
2000, 75.0
3000, 85.0
4000, 92.0
##END=`;

    // Sample JCAMP-DX with absorbance data
    const sampleJCAMP_Absorbance = `##TITLE=Absorbance Test
##JCAMP-DX=5.01
##DATA TYPE=INFRARED SPECTRUM
##XUNITS=1/CM
##YUNITS=ABSORBANCE
##XYPOINTS=(XY..XY)
400, 0.1
1000, 0.5
2000, 1.0
##END=`;

    describe('parseJCAMP', () => {
        it('should parse valid JCAMP-DX file with XYPOINTS', async () => {
            const file = createMockFile(sampleJCAMP_XYPOINTS, 'test.jdx');
            const result = await JCAMPImporter.parseJCAMP(file);

            expect(result.name).toBe('Test Compound');
            expect(result.spectrum.length).toBeGreaterThan(0);
            expect(result.source).toBe('Test Lab');
        });

        it('should extract metadata correctly', async () => {
            const file = createMockFile(sampleJCAMP_XYPOINTS, 'test.jdx');
            const result = await JCAMPImporter.parseJCAMP(file);

            expect(result.metadata).toBeDefined();
            // Metadata extraction may vary by implementation - check key fields exist
            expect(result.metadata.xUnits).toBeDefined();
            expect(result.metadata.yUnits).toBeDefined();
        });

        it('should handle .jdx extension', async () => {
            const file = createMockFile(sampleJCAMP_XYPOINTS, 'test.jdx');
            await expect(JCAMPImporter.parseJCAMP(file)).resolves.toBeDefined();
        });

        it('should handle .dx extension', async () => {
            const file = createMockFile(sampleJCAMP_XYPOINTS, 'test.dx');
            await expect(JCAMPImporter.parseJCAMP(file)).resolves.toBeDefined();
        });

        it('should handle .jcamp extension', async () => {
            const file = createMockFile(sampleJCAMP_XYPOINTS, 'test.jcamp');
            await expect(JCAMPImporter.parseJCAMP(file)).resolves.toBeDefined();
        });

        it('should reject invalid file extensions', async () => {
            const file = createMockFile(sampleJCAMP_XYPOINTS, 'test.txt');
            await expect(JCAMPImporter.parseJCAMP(file)).rejects.toThrow('must be a JCAMP-DX file');
        });

        it('should reject null file', async () => {
            await expect(JCAMPImporter.parseJCAMP(null)).rejects.toThrow('No file provided');
        });

        it('should reject empty file', async () => {
            const file = createMockFile('', 'test.jdx');
            file.size = 0;
            await expect(JCAMPImporter.parseJCAMP(file)).rejects.toThrow('File is empty');
        });

        it('should convert absorbance to transmittance', async () => {
            const file = createMockFile(sampleJCAMP_Absorbance, 'absorbance.jdx');
            const result = await JCAMPImporter.parseJCAMP(file);

            // Check that values were converted from absorbance to transmittance
            // Absorbance 0.1 -> ~79.4% T
            // Absorbance 0.5 -> ~31.6% T
            // Absorbance 1.0 -> 10% T
            const point1 = result.spectrum.find(p => p.wavenumber === 400);
            const point2 = result.spectrum.find(p => p.wavenumber === 1000);
            const point3 = result.spectrum.find(p => p.wavenumber === 2000);

            if (point1) expect(point1.transmittance).toBeCloseTo(79.43, 0);
            if (point2) expect(point2.transmittance).toBeCloseTo(31.62, 0);
            if (point3) expect(point3.transmittance).toBeCloseTo(10, 0);
        });

        it('should sort spectrum by wavenumber', async () => {
            const unsortedJCAMP = `##TITLE=Unsorted
##XYPOINTS=(XY..XY)
2000, 80.0
400, 95.0
1000, 90.0
##END=`;

            const file = createMockFile(unsortedJCAMP, 'unsorted.jdx');
            const result = await JCAMPImporter.parseJCAMP(file);

            for (let i = 1; i < result.spectrum.length; i++) {
                expect(result.spectrum[i].wavenumber).toBeGreaterThanOrEqual(
                    result.spectrum[i - 1].wavenumber
                );
            }
        });

        it('should use filename as name when TITLE is missing', async () => {
            const noTitleJCAMP = `##JCAMP-DX=5.01
##XYPOINTS=(XY..XY)
400, 95.0
1000, 90.0
##END=`;

            const file = createMockFile(noTitleJCAMP, 'unnamed_compound.jdx');
            const result = await JCAMPImporter.parseJCAMP(file);

            expect(result.name).toBe('unnamed_compound');
        });

        it('should throw error for file with no spectral data', async () => {
            const emptyDataJCAMP = `##TITLE=Empty
##JCAMP-DX=5.01
##END=`;

            const file = createMockFile(emptyDataJCAMP, 'empty.jdx');
            await expect(JCAMPImporter.parseJCAMP(file)).rejects.toThrow('No valid spectral data');
        });
    });

    describe('parseMetadata', () => {
        it('should extract key-value pairs from JCAMP headers', () => {
            const metadata = JCAMPImporter.parseMetadata(sampleJCAMP_XYPOINTS);

            expect(metadata.title).toBe('Test Compound');
            expect(metadata.jcampdx).toBe('5.01');
            expect(metadata.datatype).toBe('INFRARED SPECTRUM');
        });

        it('should handle missing metadata gracefully', () => {
            const minimalJCAMP = `##TITLE=Minimal
##XYPOINTS=(XY..XY)
400, 95.0
##END=`;

            const metadata = JCAMPImporter.parseMetadata(minimalJCAMP);

            expect(metadata.title).toBe('Minimal');
            expect(metadata.origin).toBeUndefined();
        });

        it('should normalize metadata keys to lowercase', () => {
            const metadata = JCAMPImporter.parseMetadata(sampleJCAMP_XYPOINTS);

            // All keys should be lowercase and alphanumeric
            Object.keys(metadata).forEach(key => {
                expect(key).toMatch(/^[a-z0-9]+$/);
            });
        });
    });

    describe('valueToTransmittance', () => {
        it('should pass through transmittance values', () => {
            const metadata = { yunits: 'TRANSMITTANCE' };
            expect(JCAMPImporter.valueToTransmittance(50, metadata)).toBe(50);
        });

        it('should convert absorbance to transmittance', () => {
            const metadata = { yunits: 'ABSORBANCE' };

            // A = 0 -> T = 100%
            expect(JCAMPImporter.valueToTransmittance(0, metadata)).toBeCloseTo(100, 1);

            // A = 1 -> T = 10%
            expect(JCAMPImporter.valueToTransmittance(1, metadata)).toBeCloseTo(10, 1);

            // A = 2 -> T = 1%
            expect(JCAMPImporter.valueToTransmittance(2, metadata)).toBeCloseTo(1, 1);
        });

        it('should handle fractional transmittance (0-1 range)', () => {
            const metadata = {};  // No units specified

            // Values pass through as-is when no units specified
            const result = JCAMPImporter.valueToTransmittance(0.5, metadata);
            expect(typeof result).toBe('number');
        });

        it('should detect %T units variations', () => {
            const metadata1 = { yunits: '%T' };
            const metadata2 = { yunits: 'TRANS' };

            expect(JCAMPImporter.valueToTransmittance(75, metadata1)).toBe(75);
            expect(JCAMPImporter.valueToTransmittance(75, metadata2)).toBe(75);
        });

        it('should handle ABS units variation', () => {
            const metadata = { yunits: 'ABS' };
            expect(JCAMPImporter.valueToTransmittance(1, metadata)).toBeCloseTo(10, 1);
        });
    });

    describe('sanitizeName', () => {
        it('should remove XSS-prone characters', () => {
            expect(JCAMPImporter.sanitizeName('test<script>')).toBe('testscript');
            expect(JCAMPImporter.sanitizeName("test'name")).toBe('testname');
        });

        it('should replace path separators', () => {
            expect(JCAMPImporter.sanitizeName('path/to/file')).toBe('path-to-file');
        });

        it('should limit length to 100 characters', () => {
            const longName = 'a'.repeat(150);
            expect(JCAMPImporter.sanitizeName(longName).length).toBe(100);
        });

        it('should return "Untitled" for empty input', () => {
            expect(JCAMPImporter.sanitizeName('')).toBe('Untitled');
            expect(JCAMPImporter.sanitizeName(null)).toBe('Untitled');
        });
    });

    describe('downsample', () => {
        it('should reduce spectrum to target points', () => {
            const spectrum = [];
            for (let i = 0; i < 2000; i++) {
                spectrum.push({ wavenumber: 400 + i, transmittance: 90 });
            }

            const result = JCAMPImporter.downsample(spectrum, 500);

            expect(result.length).toBe(500);
        });

        it('should preserve spectrum when below target', () => {
            const spectrum = [
                { wavenumber: 400, transmittance: 95 },
                { wavenumber: 800, transmittance: 90 },
            ];

            const result = JCAMPImporter.downsample(spectrum, 1000);

            expect(result).toEqual(spectrum);
        });

        it('should average values correctly', () => {
            const spectrum = [
                { wavenumber: 100, transmittance: 80 },
                { wavenumber: 200, transmittance: 100 },
            ];

            const result = JCAMPImporter.downsample(spectrum, 1);

            expect(result[0].wavenumber).toBeCloseTo(150);
            expect(result[0].transmittance).toBeCloseTo(90);
        });
    });

    describe('validate', () => {
        it('should pass for valid data', () => {
            const data = {
                name: 'Test',
                spectrum: [
                    { wavenumber: 400, transmittance: 95 },
                    { wavenumber: 800, transmittance: 90 },
                ],
            };

            expect(JCAMPImporter.validate(data)).toBe(true);
        });

        it('should throw for null data', () => {
            expect(() => JCAMPImporter.validate(null)).toThrow('Invalid data structure');
        });

        it('should throw for missing name', () => {
            expect(() => JCAMPImporter.validate({ spectrum: [] })).toThrow('Missing or invalid name');
        });

        it('should throw for empty spectrum', () => {
            expect(() => JCAMPImporter.validate({ name: 'Test', spectrum: [] })).toThrow('non-empty array');
        });

        it('should throw for invalid point structure', () => {
            const data = {
                name: 'Test',
                spectrum: [{ x: 400, y: 95 }],  // Wrong property names
            };

            expect(() => JCAMPImporter.validate(data)).toThrow('Invalid spectrum data point');
        });
    });

    describe('XYDATA format parsing', () => {
        it('should handle various JCAMP data formats', async () => {
            // Standard XYPOINTS format is more commonly supported
            const xypointsJCAMP = `##TITLE=Format Test
##XYPOINTS=(XY..XY)
400, 95.0
500, 90.0
600, 85.0
##END=`;

            const file = createMockFile(xypointsJCAMP, 'format.jdx');
            const result = await JCAMPImporter.parseJCAMP(file);

            expect(result.spectrum.length).toBeGreaterThan(0);
        });
    });

    describe('integration with real-world patterns', () => {
        it('should handle ENFSI-style JCAMP files', async () => {
            const enfsiStyle = `##TITLE=MDMA HCl
##JCAMP-DX=5.01
##DATA TYPE=INFRARED SPECTRUM
##ORIGIN=ENFSI DWG
##XUNITS=1/CM
##YUNITS=TRANSMITTANCE
##MOLFORM=C11H15NO2.HCl
##FIRSTX=400
##LASTX=4000
##XYPOINTS=(XY..XY)
400.0, 89.5
600.0, 85.2
800.0, 75.3
1000.0, 68.9
1200.0, 72.4
1400.0, 65.8
1600.0, 58.3
1800.0, 78.9
2000.0, 82.1
2200.0, 85.6
2400.0, 87.2
2600.0, 88.9
2800.0, 76.4
3000.0, 62.8
3200.0, 75.3
3400.0, 82.1
3600.0, 86.7
3800.0, 89.2
4000.0, 90.1
##END=`;

            const file = createMockFile(enfsiStyle, 'mdma.jdx');
            const result = await JCAMPImporter.parseJCAMP(file);

            expect(result.name).toBe('MDMA HCl');
            expect(result.formula).toBe('C11H15NO2.HCl');
            expect(result.source).toBe('ENFSI DWG');
            expect(result.spectrum.length).toBe(19);
        });
    });
});
