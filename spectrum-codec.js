/**
 * Spectrum Codec Module
 *
 * Purpose: Encode/decode FTIR spectra between the app's runtime format
 * (array of {wavenumber, transmittance} points) and the compact storage
 * format used on disk and over the wire.
 *
 * Compact format (per substance):
 * ```json
 * "spectrum": {
 *   "firstX": 451.26,        // wavenumber of first point (cm⁻¹)
 *   "lastX": 3999.53,        // wavenumber of last point (cm⁻¹)
 *   "y": [93.84, 97.07, ...] // transmittance (%), rounded to 2 decimals
 * }
 * ```
 * Points sit on a linear grid reconstructed from firstX/lastX/y.length.
 * Spectra that are not on a (near-)linear grid carry an explicit "x"
 * array instead of firstX/lastX.
 *
 * The legacy format (spectrum as an array of point objects) is still
 * accepted by all decode functions, so old monolith files, IndexedDB
 * caches, and user imports keep working.
 *
 * Works both as a browser global (SpectrumCodec) and a Node module.
 */

(function(root) {
    'use strict';

    // Grid points may deviate from a perfectly linear grid by this much
    // (cm⁻¹) before we fall back to storing explicit x values. FTIR
    // instrument resolution is ~4 cm⁻¹, so 1.0 is comfortably lossless
    // in practice.
    const GRID_TOLERANCE = 1.0;

    const round2 = v => Math.round(v * 100) / 100;

    /**
     * Encode a runtime spectrum (array of {wavenumber, transmittance})
     * into the compact storage format.
     * @param {Array} points - Array of {wavenumber, transmittance}
     * @returns {Object} Compact spectrum
     */
    function encodeSpectrum(points) {
        if (!Array.isArray(points) || points.length === 0) {
            throw new Error('encodeSpectrum: points must be a non-empty array');
        }

        const n = points.length;
        const firstX = points[0].wavenumber;
        const lastX = points[n - 1].wavenumber;
        const y = points.map(p => round2(p.transmittance));

        // Check the x values sit on a linear grid within tolerance
        const step = n > 1 ? (lastX - firstX) / (n - 1) : 0;
        let onGrid = true;
        for (let i = 0; i < n; i++) {
            if (Math.abs(points[i].wavenumber - (firstX + i * step)) > GRID_TOLERANCE) {
                onGrid = false;
                break;
            }
        }

        if (onGrid) {
            return { firstX: round2(firstX), lastX: round2(lastX), y };
        }

        return { x: points.map(p => round2(p.wavenumber)), y };
    }

    /**
     * Decode a compact spectrum into the runtime format.
     * Passes legacy point arrays through untouched.
     * @param {Object|Array} spectrum - Compact spectrum or legacy point array
     * @returns {Array} Array of {wavenumber, transmittance}
     */
    function decodeSpectrum(spectrum) {
        if (Array.isArray(spectrum)) {
            return spectrum; // legacy format
        }

        if (!spectrum || !Array.isArray(spectrum.y)) {
            throw new Error('decodeSpectrum: invalid spectrum data');
        }

        const y = spectrum.y;
        const n = y.length;

        if (Array.isArray(spectrum.x)) {
            return y.map((t, i) => ({ wavenumber: spectrum.x[i], transmittance: t }));
        }

        const step = n > 1 ? (spectrum.lastX - spectrum.firstX) / (n - 1) : 0;
        return y.map((t, i) => ({
            wavenumber: spectrum.firstX + i * step,
            transmittance: t
        }));
    }

    /**
     * Decode every substance in a library array in place-safe fashion.
     * Returns new substance objects with expanded spectra; non-spectrum
     * fields are shared by reference.
     * @param {Array} substances - Array of substance records
     * @returns {Array} Substances with runtime-format spectra
     */
    function decodeLibrary(substances) {
        if (!Array.isArray(substances)) {
            throw new Error('decodeLibrary: expected an array of substances');
        }
        return substances.map(s =>
            Array.isArray(s.spectrum) ? s : { ...s, spectrum: decodeSpectrum(s.spectrum) }
        );
    }

    /**
     * Encode every substance in a library array to compact format.
     * @param {Array} substances - Array of substance records
     * @returns {Array} Substances with compact spectra
     */
    function encodeLibrary(substances) {
        if (!Array.isArray(substances)) {
            throw new Error('encodeLibrary: expected an array of substances');
        }
        return substances.map(s =>
            Array.isArray(s.spectrum) ? { ...s, spectrum: encodeSpectrum(s.spectrum) } : s
        );
    }

    const SpectrumCodec = {
        encodeSpectrum,
        decodeSpectrum,
        encodeLibrary,
        decodeLibrary,
        GRID_TOLERANCE
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SpectrumCodec;
    }
    if (typeof window !== 'undefined') {
        root.SpectrumCodec = SpectrumCodec;
    }
})(typeof window !== 'undefined' ? window : globalThis);
