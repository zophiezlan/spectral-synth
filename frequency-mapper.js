/**
 * Frequency Mapper Module
 *
 * Purpose: Converts IR wavenumbers to audio frequencies for sonification
 *
 * Dependencies:
 * - CONFIG (for frequency ranges and peak detection parameters)
 *
 * Exports:
 * - FrequencyMapper class - IR-to-audio mapping and peak detection
 *
 * Core Concept:
 * FTIR spectra use wavenumbers (cm⁻¹, typically 400-4000) while audio uses
 * frequencies (Hz, typically 20-20,000). This class maps between these domains
 * using logarithmic scaling to preserve perceptual relationships.
 *
 * Usage:
 * ```javascript
 * const mapper = new FrequencyMapper();
 *
 * // Map single wavenumber to audio frequency
 * const audioFreq = mapper.irToAudio(1650); // C=O peak → ~2000 Hz
 *
 * // Extract peaks from spectrum
 * const peaks = mapper.extractPeaks(spectrum, 0.15, 20);
 * // Returns: [{wavenumber, absorbance, audioFreq}, ...]
 *
 * // Get functional group info
 * const group = mapper.getFunctionalGroup(2950); // "C-H stretch"
 *
 * // Get mapping summary
 * const info = mapper.getMappingInfo(peaks);
 * console.log(info);
 * ```
 *
 * Mapping Details:
 * - Algorithm: Logarithmic scaling (preserves octave relationships)
 * - IR Range: 400-4000 cm⁻¹
 * - Audio Range: 20-8000 Hz (musical range)
 * - Higher IR wavenumber → Higher audio frequency
 *
 * Peak Detection:
 * - Finds local maxima in absorbance data
 * - Threshold-based filtering (default 0.15)
 * - Returns top N peaks sorted by intensity
 * - Includes functional group annotations
 *
 * Functional Groups:
 * Provides chemical interpretation for common IR peaks:
 * - O-H stretch (3500-3700 cm⁻¹): Alcohols, phenols
 * - C=O stretch (1650-1750 cm⁻¹): Carbonyls
 * - C-H stretch (2850-3100 cm⁻¹): Aliphatic, aromatic
 * - And more...
 */

class FrequencyMapper {
    constructor() {
        // Load configuration from global CONFIG object
        // FTIR typical range in wavenumbers (cm⁻¹)
        this.IR_MIN = CONFIG.frequency.IR_MIN;
        this.IR_MAX = CONFIG.frequency.IR_MAX;

        // Audible frequency range (Hz)
        this.AUDIO_MIN = CONFIG.frequency.AUDIO_MIN;
        this.AUDIO_MAX = CONFIG.frequency.AUDIO_MAX;

        // Peak detection parameters
        this.DEFAULT_THRESHOLD = CONFIG.peakDetection.DEFAULT_THRESHOLD;
        this.DEFAULT_MAX_PEAKS = CONFIG.peakDetection.DEFAULT_MAX_PEAKS;
    }

    /**
     * Map IR wavenumber to audio frequency using logarithmic scaling
     *
     * Uses logarithmic scaling to preserve perceptual relationships between
     * frequencies. Higher IR wavenumbers map to higher audio frequencies.
     *
     * @param {number} wavenumber - IR wavenumber in cm⁻¹
     * @returns {number} Audio frequency in Hz
     * @throws {Error} If wavenumber is not a valid number
     */
    irToAudio(wavenumber) {
        if (typeof wavenumber !== 'number' || isNaN(wavenumber)) {
            throw new Error(`Invalid wavenumber: ${wavenumber}. Must be a number.`);
        }

        // Clamp wavenumber to valid range
        const clampedWavenumber = Math.max(this.IR_MIN, Math.min(this.IR_MAX, wavenumber));

        // Normalize wavenumber to 0-1 range
        const normalized = (clampedWavenumber - this.IR_MIN) / (this.IR_MAX - this.IR_MIN);

        // Apply logarithmic scaling for perceptual uniformity
        const logMin = Math.log(this.AUDIO_MIN);
        const logMax = Math.log(this.AUDIO_MAX);

        const audioFreq = Math.exp(logMin + normalized * (logMax - logMin));

        return audioFreq;
    }

    /**
     * Extract peaks from FTIR spectrum for sonification
     *
     * Identifies local maxima in the absorption spectrum that exceed the threshold.
     * Returns the most intense peaks up to maxPeaks limit.
     *
     * @param {Array} spectrum - Array of {wavenumber, transmittance} objects
     * @param {number} [threshold=0.15] - Minimum absorption intensity (0-1)
     * @param {number} [maxPeaks=20] - Maximum number of peaks to extract
     * @returns {Array} Array of {wavenumber, absorbance, audioFreq} objects sorted by intensity
     * @throws {Error} If spectrum is invalid or empty
     */
    extractPeaks(spectrum, threshold = this.DEFAULT_THRESHOLD, maxPeaks = this.DEFAULT_MAX_PEAKS) {
        if (!Array.isArray(spectrum) || spectrum.length === 0) {
            throw new Error('Invalid spectrum: must be a non-empty array');
        }
        // Convert transmittance to absorbance
        // Absorbance = -log10(Transmittance/100)
        // But for simplicity, we'll use: Absorbance = 1 - (Transmittance/100)
        const absorbanceData = spectrum.map(point => ({
            wavenumber: point.wavenumber,
            absorbance: 1 - (point.transmittance / 100)
        }));

        // Find local maxima (peaks)
        const peaks = [];
        for (let i = 1; i < absorbanceData.length - 1; i++) {
            const prev = absorbanceData[i - 1].absorbance;
            const curr = absorbanceData[i].absorbance;
            const next = absorbanceData[i + 1].absorbance;

            // Check if current point is a local maximum
            if (curr > prev && curr > next && curr > threshold) {
                peaks.push({
                    wavenumber: absorbanceData[i].wavenumber,
                    absorbance: curr,
                    audioFreq: this.irToAudio(absorbanceData[i].wavenumber)
                });
            }
        }

        // Sort peaks by absorbance (intensity) and take top N
        peaks.sort((a, b) => b.absorbance - a.absorbance);
        return peaks.slice(0, maxPeaks);
    }

    /**
     * Get mapping information for display
     * @param {Array} peaks - Array of peak objects
     * @returns {string} Formatted mapping information
     */
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

    /**
     * Get functional group annotation for a wavenumber
     * @param {number} wavenumber - IR wavenumber in cm⁻¹
     * @returns {string} Functional group annotation
     */
    getFunctionalGroup(wavenumber) {
        if (wavenumber > 3500 && wavenumber < 3700) return 'O-H stretch (alcohol/phenol)';
        if (wavenumber > 3200 && wavenumber < 3500) return 'N-H stretch (amine)';
        if (wavenumber > 3000 && wavenumber < 3100) return 'C-H stretch (aromatic)';
        if (wavenumber > 2850 && wavenumber < 3000) return 'C-H stretch (aliphatic)';
        if (wavenumber > 2100 && wavenumber < 2300) return 'C≡N or C≡C stretch';
        if (wavenumber > 1650 && wavenumber < 1750) return 'C=O stretch (carbonyl)';
        if (wavenumber > 1500 && wavenumber < 1650) return 'C=C stretch (aromatic)';
        if (wavenumber > 1350 && wavenumber < 1500) return 'C-H bend';
        if (wavenumber > 1000 && wavenumber < 1300) return 'C-O stretch (ether/ester)';
        if (wavenumber > 650 && wavenumber < 900) return 'C-H bend (aromatic)';
        return 'Fingerprint region';
    }
}
