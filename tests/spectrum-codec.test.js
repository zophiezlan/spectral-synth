/**
 * Unit Tests for SpectrumCodec
 *
 * Locks in the compact storage format: linear-grid encoding, rounding
 * behavior, non-uniform fallback, and legacy pass-through.
 */

const SpectrumCodec = require('../spectrum-codec.js');

/** Build a linear-grid spectrum of {wavenumber, transmittance} points */
function gridSpectrum(firstX, step, values) {
    return values.map((t, i) => ({ wavenumber: firstX + i * step, transmittance: t }));
}

describe('SpectrumCodec', () => {
    describe('encodeSpectrum', () => {
        it('encodes a linear grid as {firstX, lastX, y}', () => {
            const points = gridSpectrum(400, 7.5, [95.123456, 92.987654, 88.5, 91.0]);
            const compact = SpectrumCodec.encodeSpectrum(points);

            expect(compact.firstX).toBe(400);
            expect(compact.lastX).toBe(422.5);
            expect(compact.y).toEqual([95.12, 92.99, 88.5, 91]);
            expect(compact.x).toBeUndefined();
        });

        it('rounds transmittance to 2 decimals', () => {
            const points = gridSpectrum(400, 1, [93.83648990667673]);
            expect(SpectrumCodec.encodeSpectrum(points).y).toEqual([93.84]);
        });

        it('tolerates small grid jitter within GRID_TOLERANCE', () => {
            const points = [
                { wavenumber: 400, transmittance: 90 },
                { wavenumber: 407.7, transmittance: 91 },
                { wavenumber: 415.5, transmittance: 92 }, // slight jitter vs 415.4
                { wavenumber: 423.1, transmittance: 93 },
            ];
            const compact = SpectrumCodec.encodeSpectrum(points);
            expect(compact.x).toBeUndefined();
            expect(compact.firstX).toBe(400);
        });

        it('falls back to an explicit x array for non-uniform grids', () => {
            const points = [
                { wavenumber: 400, transmittance: 90 },
                { wavenumber: 410, transmittance: 91 },
                { wavenumber: 500, transmittance: 92 },
            ];
            const compact = SpectrumCodec.encodeSpectrum(points);
            expect(compact.x).toEqual([400, 410, 500]);
            expect(compact.firstX).toBeUndefined();
        });

        it('throws on empty input', () => {
            expect(() => SpectrumCodec.encodeSpectrum([])).toThrow();
        });
    });

    describe('decodeSpectrum', () => {
        it('round-trips a linear grid within rounding tolerance', () => {
            const points = gridSpectrum(451.261, 7.714, [93.836, 97.071, 98.127, 98.23]);
            const decoded = SpectrumCodec.decodeSpectrum(SpectrumCodec.encodeSpectrum(points));

            expect(decoded).toHaveLength(points.length);
            decoded.forEach((p, i) => {
                expect(Math.abs(p.wavenumber - points[i].wavenumber)).toBeLessThan(0.05);
                expect(Math.abs(p.transmittance - points[i].transmittance)).toBeLessThanOrEqual(0.005);
            });
        });

        it('decodes explicit-x spectra', () => {
            const decoded = SpectrumCodec.decodeSpectrum({ x: [400, 410, 500], y: [90, 91, 92] });
            expect(decoded).toEqual([
                { wavenumber: 400, transmittance: 90 },
                { wavenumber: 410, transmittance: 91 },
                { wavenumber: 500, transmittance: 92 },
            ]);
        });

        it('passes legacy point arrays through untouched', () => {
            const legacy = [{ wavenumber: 400, transmittance: 90 }];
            expect(SpectrumCodec.decodeSpectrum(legacy)).toBe(legacy);
        });

        it('handles a single-point spectrum', () => {
            const decoded = SpectrumCodec.decodeSpectrum({ firstX: 400, lastX: 400, y: [90] });
            expect(decoded).toEqual([{ wavenumber: 400, transmittance: 90 }]);
        });

        it('throws on invalid input', () => {
            expect(() => SpectrumCodec.decodeSpectrum({})).toThrow();
            expect(() => SpectrumCodec.decodeSpectrum(null)).toThrow();
        });
    });

    describe('library helpers', () => {
        it('decodeLibrary expands compact substances and passes legacy through', () => {
            const compact = { id: 'a', spectrum: { firstX: 400, lastX: 410, y: [90, 91] } };
            const legacy = { id: 'b', spectrum: [{ wavenumber: 400, transmittance: 90 }] };

            const decoded = SpectrumCodec.decodeLibrary([compact, legacy]);

            expect(Array.isArray(decoded[0].spectrum)).toBe(true);
            expect(decoded[0].spectrum).toHaveLength(2);
            expect(decoded[1]).toBe(legacy);
        });

        it('encodeLibrary compacts runtime substances', () => {
            const runtime = { id: 'a', spectrum: gridSpectrum(400, 10, [90, 91, 92]) };
            const encoded = SpectrumCodec.encodeLibrary([runtime]);
            expect(encoded[0].spectrum.y).toEqual([90, 91, 92]);
            expect(encoded[0].spectrum.firstX).toBe(400);
        });
    });
});
