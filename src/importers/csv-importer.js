/**
 * CSV Importer - Import custom FTIR data from CSV files
 * 
 * Allows users to import their own FTIR spectral data in CSV format
 * and sonify it using the Spectral Synthesizer.
 */

class CSVImporter {
    /**
     * Parse CSV file containing FTIR data
     * 
     * Expected formats:
     * 1. Two columns: wavenumber, transmittance
     * 2. Two columns: wavenumber, absorbance
     * 3. With headers (will be auto-detected and skipped)
     * 
     * @param {File} file - CSV file from input element
     * @returns {Promise<Object>} Parsed spectrum data with metadata
     * @throws {Error} If file is invalid or parsing fails
     */
    static async parseCSV(file) {
        if (!file) {
            throw new Error('No file provided');
        }

        if (!file.name.toLowerCase().endsWith('.csv')) {
            throw new Error('File must be a CSV file');
        }

        // Validate file size (10MB max)
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size: 10MB`);
        }

        if (file.size === 0) {
            throw new Error('File is empty');
        }

        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            throw new Error('CSV file must contain at least 2 data points');
        }

        const spectrum = [];
        let hasHeader = false;
        let isAbsorbance = false;

        // Check if first line is a header
        const firstLine = lines[0].split(/[,;\t]/);
        if (isNaN(parseFloat(firstLine[0])) || isNaN(parseFloat(firstLine[1]))) {
            hasHeader = true;
            // Check if header mentions absorbance
            const headerText = lines[0].toLowerCase();
            isAbsorbance = headerText.includes('absorbance') || headerText.includes('absorption');
        }

        const startIdx = hasHeader ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
            const parts = lines[i].split(/[,;\t]/).map(p => p.trim());
            
            if (parts.length < 2) continue;

            const wavenumber = parseFloat(parts[0]);
            const value = parseFloat(parts[1]);

            if (isNaN(wavenumber) || isNaN(value)) {
                console.warn(`Skipping invalid line ${i + 1}: ${lines[i]}`);
                continue;
            }

            // If absorbance, convert to transmittance
            // transmittance = 10^(-absorbance) * 100
            let transmittance;
            if (isAbsorbance) {
                transmittance = Math.pow(10, -value) * 100;
            } else {
                transmittance = value;
            }

            // Validate reasonable ranges
            if (wavenumber < 100 || wavenumber > 10000) {
                console.warn(`Wavenumber ${wavenumber} outside typical range (100-10000 cm⁻¹)`);
            }

            if (transmittance < 0 || transmittance > 100) {
                // Clamp to valid range
                transmittance = Math.max(0, Math.min(100, transmittance));
            }

            spectrum.push({ wavenumber, transmittance });
        }

        if (spectrum.length === 0) {
            throw new Error('No valid data points found in CSV');
        }

        // Sort by wavenumber
        spectrum.sort((a, b) => a.wavenumber - b.wavenumber);

        // Downsample if too many points (for performance)
        const MAX_POINTS = 1000;
        let finalSpectrum = spectrum;
        if (spectrum.length > MAX_POINTS) {
            finalSpectrum = this.downsample(spectrum, MAX_POINTS);
        }

        return {
            name: this.sanitizeName(file.name.replace('.csv', '')),
            source: 'User Import',
            category: 'custom',
            spectrum: finalSpectrum,
            metadata: {
                originalPoints: spectrum.length,
                finalPoints: finalSpectrum.length,
                wavenumberRange: [
                    Math.min(...finalSpectrum.map(p => p.wavenumber)),
                    Math.max(...finalSpectrum.map(p => p.wavenumber))
                ],
                importDate: new Date().toISOString(),
            }
        };
    }

    /**
     * Sanitize substance name for security
     * Removes potentially dangerous characters and limits length
     *
     * @param {string} name - Raw name from file
     * @returns {string} Sanitized name
     * @private
     */
    static sanitizeName(name) {
        if (!name || typeof name !== 'string') {
            return 'Untitled';
        }

        return name
            .replace(/[<>'"&]/g, '') // Remove XSS-prone characters
            .replace(/[\/\\]/g, '-')  // Replace path separators
            .trim()
            .slice(0, 100) // Limit length
            || 'Untitled';
    }

    /**
     * Downsample spectrum data to target number of points
     * Uses simple averaging in bins
     * 
     * @param {Array} spectrum - Original spectrum data
     * @param {number} targetPoints - Desired number of points
     * @returns {Array} Downsampled spectrum
     * @private
     */
    static downsample(spectrum, targetPoints) {
        if (spectrum.length <= targetPoints) {
            return spectrum;
        }

        const result = [];
        const binSize = Math.floor(spectrum.length / targetPoints);

        for (let i = 0; i < targetPoints; i++) {
            const start = i * binSize;
            const end = Math.min(start + binSize, spectrum.length);
            
            let sumWavenumber = 0;
            let sumTransmittance = 0;
            let count = 0;

            for (let j = start; j < end; j++) {
                sumWavenumber += spectrum[j].wavenumber;
                sumTransmittance += spectrum[j].transmittance;
                count++;
            }

            result.push({
                wavenumber: sumWavenumber / count,
                transmittance: sumTransmittance / count
            });
        }

        return result;
    }

    /**
     * Validate imported spectrum data
     * 
     * @param {Object} data - Imported spectrum data
     * @returns {boolean} True if valid
     * @throws {Error} If validation fails with specific reason
     */
    static validate(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data structure');
        }

        if (!data.name || typeof data.name !== 'string') {
            throw new Error('Missing or invalid name');
        }

        if (!Array.isArray(data.spectrum) || data.spectrum.length === 0) {
            throw new Error('Spectrum must be a non-empty array');
        }

        // Check first few points for valid structure
        for (let i = 0; i < Math.min(5, data.spectrum.length); i++) {
            const point = data.spectrum[i];
            if (typeof point.wavenumber !== 'number' || typeof point.transmittance !== 'number') {
                throw new Error('Invalid spectrum data point structure');
            }
        }

        return true;
    }

    /**
     * Generate example CSV template
     * 
     * @returns {string} CSV template string
     */
    static generateTemplate() {
        return `wavenumber,transmittance
400,95.2
450,94.8
500,93.5
550,92.1
600,88.7
650,85.3
700,89.4
750,91.2
800,93.8
850,94.5
900,95.1
950,94.7
1000,93.2
1050,91.8
1100,87.5
1150,82.3
1200,86.9
1250,90.5
1300,92.8
1350,94.1
1400,95.0
1450,94.6
1500,93.8
1550,92.4
1600,88.1
1650,84.7
1700,65.2
1750,78.3
1800,87.6
1850,91.4
1900,93.7
1950,94.8
2000,95.2
2050,94.9
2100,94.5
2150,93.8
2200,92.9
2250,91.6
2300,89.8
2350,87.2
2400,88.5
2450,90.3
2500,92.1
2550,93.5
2600,94.3
2650,94.8
2700,95.1
2750,95.0
2800,94.6
2850,71.2
2900,68.5
2950,70.8
3000,85.3
3050,90.7
3100,93.2
3150,94.5
3200,95.0
3250,95.2
3300,95.1
3350,94.9
3400,94.6
3450,94.2
3500,93.7
3550,93.1
3600,92.4
3650,91.6
3700,90.8
3750,90.0
3800,89.2
3850,88.5
3900,87.9
3950,87.4
4000,87.0`;
    }

    /**
     * Download CSV template file
     */
    static downloadTemplate() {
        const csv = this.generateTemplate();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ftir-template.csv';
        a.click();
        URL.revokeObjectURL(url);
    }
}
