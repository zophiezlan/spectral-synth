/**
 * JCAMP-DX Importer - Import FTIR data from JCAMP-DX files
 * 
 * JCAMP-DX is the standard format for spectroscopy data exchange.
 * This module provides browser-based parsing of JCAMP-DX files.
 */

class JCAMPImporter {
    /**
     * Parse JCAMP-DX file containing FTIR data
     * 
     * Supports JCAMP-DX format with XYDATA or XYPOINTS sections.
     * Handles both transmittance and absorbance data.
     * 
     * @param {File} file - JCAMP-DX file from input element
     * @returns {Promise<Object>} Parsed spectrum data with metadata
     * @throws {Error} If file is invalid or parsing fails
     */
    static async parseJCAMP(file) {
        if (!file) {
            throw new Error('No file provided');
        }

        const validExtensions = ['.jdx', '.dx', '.jcamp'];
        const fileName = file.name.toLowerCase();
        const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
        
        if (!hasValidExtension) {
            throw new Error('File must be a JCAMP-DX file (.jdx, .dx, or .jcamp)');
        }

        // Validate file size (50MB max for JCAMP files which can be large)
        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size: 50MB`);
        }

        if (file.size === 0) {
            throw new Error('File is empty');
        }

        const text = await file.text();
        
        // Parse JCAMP-DX format
        const metadata = this.parseMetadata(text);
        const spectrum = this.parseSpectrum(text, metadata);

        if (spectrum.length === 0) {
            throw new Error('No valid spectral data found in JCAMP file');
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
            name: this.sanitizeName(metadata.title || file.name.replace(/\.(jdx|dx|jcamp)$/i, '')),
            source: metadata.origin || 'JCAMP Import',
            category: 'custom',
            formula: metadata.molform || '',
            description: metadata.comment || 'Imported from JCAMP-DX file',
            spectrum: finalSpectrum,
            metadata: {
                originalPoints: spectrum.length,
                finalPoints: finalSpectrum.length,
                wavenumberRange: [
                    Math.min(...finalSpectrum.map(p => p.wavenumber)),
                    Math.max(...finalSpectrum.map(p => p.wavenumber))
                ],
                importDate: new Date().toISOString(),
                jcampVersion: metadata.jcampDx || 'Unknown',
                dataType: metadata.dataType || 'Unknown',
                xUnits: metadata.xUnits || 'cm⁻¹',
                yUnits: metadata.yUnits || 'Transmittance'
            }
        };
    }

    /**
     * Parse metadata from JCAMP-DX file
     * 
     * @param {string} text - JCAMP file content
     * @returns {Object} Metadata object
     * @private
     */
    static parseMetadata(text) {
        const metadata = {};
        const lines = text.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            
            // JCAMP fields start with ##
            if (!trimmed.startsWith('##')) continue;
            
            // Skip data sections
            if (trimmed.includes('XYDATA') || trimmed.includes('XYPOINTS')) break;

            // Parse key-value pair
            const match = trimmed.match(/^##(.+?)=(.*)$/);
            if (match) {
                const key = match[1].trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                const value = match[2].trim();
                metadata[key] = value;
            }
        }

        return metadata;
    }

    /**
     * Parse spectrum data from JCAMP-DX file
     * 
     * @param {string} text - JCAMP file content
     * @param {Object} metadata - Parsed metadata
     * @returns {Array} Array of {wavenumber, transmittance} objects
     * @private
     */
    static parseSpectrum(text, metadata) {
        const spectrum = [];
        const lines = text.split('\n');
        
        // Determine if data is in XYDATA or XYPOINTS format
        let inDataSection = false;
        let dataFormat = null;
        let xFactor = 1;
        let yFactor = 1;
        let firstX = null;
        let lastX = null;
        let numPoints = null;

        // Extract factors and ranges
        if (metadata.xfactor) xFactor = parseFloat(metadata.xfactor);
        if (metadata.yfactor) yFactor = parseFloat(metadata.yfactor);
        if (metadata.firstx) firstX = parseFloat(metadata.firstx);
        if (metadata.lastx) lastX = parseFloat(metadata.lastx);
        if (metadata.npoints) numPoints = parseInt(metadata.npoints);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Start of data section
            if (line.includes('##XYDATA') || line.includes('##XYPOINTS')) {
                inDataSection = true;
                dataFormat = line.includes('##XYDATA') ? 'XYDATA' : 'XYPOINTS';
                continue;
            }

            // End of data section
            if (line.startsWith('##') && inDataSection) {
                inDataSection = false;
                continue;
            }

            if (!inDataSection || !line) continue;

            // Parse data based on format
            if (dataFormat === 'XYPOINTS') {
                // Format: X, Y pairs on each line
                const parts = line.split(/[,\s]+/).filter(p => p);
                if (parts.length >= 2) {
                    const wavenumber = parseFloat(parts[0]) * xFactor;
                    const value = parseFloat(parts[1]) * yFactor;
                    
                    if (!isNaN(wavenumber) && !isNaN(value)) {
                        spectrum.push({
                            wavenumber,
                            transmittance: this.valueToTransmittance(value, metadata)
                        });
                    }
                }
            } else if (dataFormat === 'XYDATA') {
                // XYDATA can be compressed with difference encoding
                // Format: X followed by Y values, or compressed notation
                const parts = line.split(/\s+/).filter(p => p);
                
                for (const part of parts) {
                    // Check if it's an X value (contains decimal point or is first value)
                    if (part.includes('.') || spectrum.length === 0) {
                        const x = parseFloat(part);
                        if (!isNaN(x)) {
                            // This is an X value, next values will be Y until next X
                            const xValue = x * xFactor;
                            // Store for next Y values
                            if (!this.currentX) this.currentX = xValue;
                        }
                    } else {
                        // This is a Y value
                        const y = parseFloat(part);
                        if (!isNaN(y) && this.currentX !== undefined) {
                            spectrum.push({
                                wavenumber: this.currentX,
                                transmittance: this.valueToTransmittance(y * yFactor, metadata)
                            });
                            // Increment X for next point if we have deltaX
                            if (metadata.deltax) {
                                this.currentX += parseFloat(metadata.deltax) * xFactor;
                            }
                        }
                    }
                }
            }
        }

        // Reset currentX for next parse
        delete this.currentX;

        return spectrum;
    }

    /**
     * Convert Y value to transmittance based on Y units
     * 
     * @param {number} value - Y value from JCAMP file
     * @param {Object} metadata - File metadata
     * @returns {number} Transmittance percentage (0-100)
     * @private
     */
    static valueToTransmittance(value, metadata) {
        const yUnits = (metadata.yunits || metadata.yunit || '').toLowerCase();
        
        // Determine if value is absorbance or transmittance
        if (yUnits.includes('absorbance') || yUnits.includes('abs')) {
            // Convert absorbance to transmittance: T = 10^(-A) * 100
            return Math.pow(10, -value) * 100;
        } else if (yUnits.includes('transmittance') || yUnits.includes('trans') || yUnits.includes('%t')) {
            // Already transmittance
            return value;
        } else {
            // Default: assume transmittance if not specified
            // Check if values are in reasonable range for transmittance (0-100)
            if (value >= 0 && value <= 100) {
                return value;
            } else if (value >= 0 && value <= 1) {
                // Fractional transmittance (0-1)
                return value * 100;
            } else {
                // Assume absorbance for larger values
                return Math.pow(10, -value) * 100;
            }
        }
    }

    /**
     * Sanitize substance name for security
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
     * @throws {Error} If validation fails
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
}
