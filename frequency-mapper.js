/**
 * Frequency Mapper - Converts IR wavenumbers to audio frequencies
 *
 * FTIR measures wavenumbers in cm⁻¹ (typically 400-4000 cm⁻¹)
 * Audio frequencies range from 20 Hz to 20,000 Hz
 *
 * We use logarithmic mapping to preserve perceptual relationships
 */

class FrequencyMapper {
    constructor() {
        // FTIR typical range in wavenumbers (cm⁻¹)
        this.IR_MIN = 400;
        this.IR_MAX = 4000;

        // Audible frequency range (Hz)
        this.AUDIO_MIN = 100;  // Start at 100Hz for better musicality
        this.AUDIO_MAX = 8000; // Cap at 8kHz for pleasant sounds
    }

    /**
     * Map IR wavenumber to audio frequency using logarithmic scaling
     * @param {number} wavenumber - IR wavenumber in cm⁻¹
     * @returns {number} Audio frequency in Hz
     */
    irToAudio(wavenumber) {
        // Normalize wavenumber to 0-1 range
        const normalized = (wavenumber - this.IR_MIN) / (this.IR_MAX - this.IR_MIN);

        // Apply logarithmic scaling for perceptual uniformity
        const logMin = Math.log(this.AUDIO_MIN);
        const logMax = Math.log(this.AUDIO_MAX);

        const audioFreq = Math.exp(logMin + normalized * (logMax - logMin));

        return audioFreq;
    }

    /**
     * Extract peaks from FTIR spectrum for sonification
     * @param {Array} spectrum - Array of {wavenumber, transmittance} objects
     * @param {number} threshold - Minimum absorption intensity (0-1)
     * @param {number} maxPeaks - Maximum number of peaks to extract
     * @returns {Array} Array of {wavenumber, absorbance, audioFreq} objects
     */
    extractPeaks(spectrum, threshold = 0.15, maxPeaks = 20) {
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
