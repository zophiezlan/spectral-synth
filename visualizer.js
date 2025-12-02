/**
 * Visualizer - Canvas-based visualization for FTIR and audio FFT
 * 
 * Handles rendering of FTIR spectra and real-time audio FFT visualization.
 * Supports interactive peak selection for custom sonification.
 */

class Visualizer {
    /**
     * Create a new Visualizer instance
     * 
     * @param {HTMLCanvasElement} ftirCanvas - Canvas for FTIR spectrum display
     * @param {HTMLCanvasElement} audioCanvas - Canvas for audio FFT display
     * @throws {Error} If canvases are invalid
     */
    constructor(ftirCanvas, audioCanvas) {
        if (!ftirCanvas || !audioCanvas) {
            throw new Error('Invalid canvases: both ftirCanvas and audioCanvas are required');
        }

        this.ftirCanvas = ftirCanvas;
        this.audioCanvas = audioCanvas;

        this.ftirCtx = ftirCanvas.getContext('2d');
        this.audioCtx = audioCanvas.getContext('2d');

        if (!this.ftirCtx || !this.audioCtx) {
            throw new Error('Failed to get canvas 2D context');
        }

        this.animationId = null;
        this.audioEngine = null;

        // Peak selection state
        this.currentSpectrum = null;
        this.currentPeaks = null;
        this.selectedPeakIndices = new Set();
        this.peakPositions = []; // Store peak positions for click detection
        this.onPeakSelectionChange = null; // Callback for selection changes

        // Load visualization constants from global CONFIG object
        this.CLICK_RADIUS = CONFIG.visualization.CLICK_RADIUS;
        this.PEAK_MARKER_SIZE = CONFIG.visualization.PEAK_MARKER_SIZE;

        // Cached static elements for performance
        this.audioStaticCanvas = null;
        this.audioStaticCached = false;

        // Set up click handler
        this.setupClickHandler();
    }

    /**
     * Set up click handler for peak selection
     * 
     * Enables interactive peak selection by clicking on the FTIR spectrum.
     * Also changes cursor to pointer when hovering over peaks.
     */
    setupClickHandler() {
        this.ftirCanvas.addEventListener('click', (e) => {
            if (!this.currentPeaks || this.currentPeaks.length === 0) return;

            const rect = this.ftirCanvas.getBoundingClientRect();
            const clickX = ((e.clientX - rect.left) / rect.width) * this.ftirCanvas.width;
            const clickY = ((e.clientY - rect.top) / rect.height) * this.ftirCanvas.height;

            // Find closest peak
            let closestIndex = -1;
            let closestDistance = Infinity;

            this.peakPositions.forEach((pos, idx) => {
                const distance = Math.sqrt(
                    Math.pow(clickX - pos.x, 2) + Math.pow(clickY - pos.y, 2)
                );

                if (distance < this.CLICK_RADIUS && distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = idx;
                }
            });

            // Toggle peak selection
            if (closestIndex !== -1) {
                if (this.selectedPeakIndices.has(closestIndex)) {
                    this.selectedPeakIndices.delete(closestIndex);
                } else {
                    this.selectedPeakIndices.add(closestIndex);
                }

                // Redraw with updated selection
                this.drawFTIRSpectrum(this.currentSpectrum, this.currentPeaks);

                // Notify callback
                if (this.onPeakSelectionChange) {
                    this.onPeakSelectionChange(this.getSelectedPeaks());
                }
            }
        });

        // Change cursor to pointer and show tooltip when hovering over peaks
        this.ftirCanvas.addEventListener('mousemove', (e) => {
            if (!this.currentPeaks || this.currentPeaks.length === 0) {
                this.hideTooltip();
                return;
            }

            const rect = this.ftirCanvas.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * this.ftirCanvas.width;
            const mouseY = ((e.clientY - rect.top) / rect.height) * this.ftirCanvas.height;

            let closestIndex = -1;
            let closestDistance = Infinity;

            this.peakPositions.forEach((pos, idx) => {
                const distance = Math.sqrt(
                    Math.pow(mouseX - pos.x, 2) + Math.pow(mouseY - pos.y, 2)
                );
                if (distance < this.CLICK_RADIUS && distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = idx;
                }
            });

            if (closestIndex !== -1) {
                this.ftirCanvas.style.cursor = 'pointer';
                this.showTooltip(this.currentPeaks[closestIndex], e.clientX, e.clientY, closestIndex);
            } else {
                this.ftirCanvas.style.cursor = 'default';
                this.hideTooltip();
            }
        });

        // Hide tooltip when mouse leaves canvas
        this.ftirCanvas.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });
    }

    /**
     * Get currently selected peaks
     * @returns {Array} Selected peaks
     */
    getSelectedPeaks() {
        if (!this.currentPeaks) return [];
        return Array.from(this.selectedPeakIndices)
            .map(idx => this.currentPeaks[idx])
            .filter(p => p !== undefined);
    }

    /**
     * Clear peak selection
     */
    clearSelection() {
        this.selectedPeakIndices.clear();
        if (this.currentSpectrum && this.currentPeaks) {
            this.drawFTIRSpectrum(this.currentSpectrum, this.currentPeaks);
        }
        if (this.onPeakSelectionChange) {
            this.onPeakSelectionChange([]);
        }
    }

    /**
     * Select all peaks
     */
    selectAllPeaks() {
        if (!this.currentPeaks) return;
        this.selectedPeakIndices.clear();
        this.currentPeaks.forEach((_, idx) => {
            this.selectedPeakIndices.add(idx);
        });
        this.drawFTIRSpectrum(this.currentSpectrum, this.currentPeaks);
        if (this.onPeakSelectionChange) {
            this.onPeakSelectionChange(this.getSelectedPeaks());
        }
    }

    /**
     * Show tooltip for a peak
     * @param {Object} peak - Peak data {wavenumber, absorbance, audioFreq}
     * @param {number} x - Mouse X position
     * @param {number} y - Mouse Y position
     * @param {number} index - Peak index
     * @private
     */
    showTooltip(peak, x, y, index) {
        const tooltip = document.getElementById('peak-tooltip');
        if (!tooltip) return;

        const header = tooltip.querySelector('.tooltip-header');
        const content = tooltip.querySelector('.tooltip-content');

        const isSelected = this.selectedPeakIndices.has(index);
        const functionalGroup = this.getFunctionalGroup ? this.getFunctionalGroup(peak.wavenumber) : 'Unknown';

        header.textContent = `Peak ${index + 1}${isSelected ? ' ★' : ''}`;
        content.innerHTML = `
            <div><strong>Wavenumber:</strong> ${peak.wavenumber.toFixed(1)} cm⁻¹</div>
            <div><strong>Intensity:</strong> ${(peak.absorbance * 100).toFixed(1)}%</div>
            <div><strong>Audio Freq:</strong> ${peak.audioFreq.toFixed(1)} Hz</div>
            <div><strong>Group:</strong> ${functionalGroup}</div>
            <div style="margin-top: 0.5rem; font-size: 0.85em; color: #a78bfa;">Click to ${isSelected ? 'deselect' : 'select'}</div>
        `;

        // Position tooltip near cursor, but avoid edges
        const offset = 15;
        let tooltipX = x + offset;
        let tooltipY = y + offset;

        // Show tooltip to measure dimensions
        tooltip.style.display = 'block';
        const tooltipRect = tooltip.getBoundingClientRect();

        // Adjust if too close to right edge
        if (tooltipX + tooltipRect.width > window.innerWidth) {
            tooltipX = x - tooltipRect.width - offset;
        }

        // Adjust if too close to bottom edge
        if (tooltipY + tooltipRect.height > window.innerHeight) {
            tooltipY = y - tooltipRect.height - offset;
        }

        tooltip.style.left = tooltipX + 'px';
        tooltip.style.top = tooltipY + 'px';
    }

    /**
     * Hide tooltip
     * @private
     */
    hideTooltip() {
        const tooltip = document.getElementById('peak-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    /**
     * Get functional group for a wavenumber
     * @param {number} wavenumber - IR wavenumber
     * @returns {string} Functional group description
     * @private
     */
    getFunctionalGroup(wavenumber) {
        if (wavenumber > 3500 && wavenumber < 3700) return 'O-H stretch';
        if (wavenumber > 3200 && wavenumber < 3500) return 'N-H stretch';
        if (wavenumber > 3000 && wavenumber < 3100) return 'C-H aromatic';
        if (wavenumber > 2850 && wavenumber < 3000) return 'C-H aliphatic';
        if (wavenumber > 2100 && wavenumber < 2300) return 'C≡N / C≡C';
        if (wavenumber > 1650 && wavenumber < 1750) return 'C=O carbonyl';
        if (wavenumber > 1500 && wavenumber < 1650) return 'C=C aromatic';
        if (wavenumber > 1350 && wavenumber < 1500) return 'C-H bend';
        if (wavenumber > 1000 && wavenumber < 1300) return 'C-O stretch';
        if (wavenumber > 650 && wavenumber < 900) return 'C-H aromatic';
        return 'Fingerprint region';
    }

    /**
     * Set audio engine for FFT visualization
     * @param {AudioEngine} audioEngine - Audio engine instance
     */
    setAudioEngine(audioEngine) {
        this.audioEngine = audioEngine;
    }

    /**
     * Draw FTIR spectrum
     * @param {Array} spectrum - Array of {wavenumber, transmittance} objects
     * @param {Array} peaks - Highlighted peaks (optional)
     */
    drawFTIRSpectrum(spectrum, peaks = []) {
        const canvas = this.ftirCanvas;
        const ctx = this.ftirCtx;
        const width = canvas.width;
        const height = canvas.height;

        // Store current spectrum and peaks for selection
        this.currentSpectrum = spectrum;
        this.currentPeaks = peaks;
        this.peakPositions = [];

        // Clear canvas
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);

        if (!spectrum || spectrum.length === 0) return;

        // Draw grid
        this.drawGrid(ctx, width, height);

        // Sort spectrum by wavenumber for proper line drawing
        const sortedSpectrum = [...spectrum].sort((a, b) => b.wavenumber - a.wavenumber);

        // Find data ranges
        const wavenumbers = sortedSpectrum.map(p => p.wavenumber);
        const minWavenumber = Math.min(...wavenumbers);
        const maxWavenumber = Math.max(...wavenumbers);

        // Scale functions for mapping data coordinates to canvas pixels
        // X: Map wavenumber range to canvas width (with 20px margins)
        const scaleX = (wavenumber) => {
            return ((wavenumber - minWavenumber) / (maxWavenumber - minWavenumber)) * (width - 40) + 20;
        };

        // Y: Map transmittance percentage to canvas height (inverted, with margins)
        // High transmittance (100%) = top, low transmittance (0%) = bottom
        const scaleY = (transmittance) => {
            return height - 20 - ((transmittance / 100) * (height - 40));
        };

        // Draw spectrum line
        ctx.beginPath();
        ctx.strokeStyle = CONFIG.visualization.SPECTRUM_COLOR;
        ctx.lineWidth = 2;

        sortedSpectrum.forEach((point, idx) => {
            const x = scaleX(point.wavenumber);
            const y = scaleY(point.transmittance);

            if (idx === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // Highlight peaks
        if (peaks && peaks.length > 0) {
            peaks.forEach((peak, idx) => {
                const x = scaleX(peak.wavenumber);
                // Convert absorbance back to transmittance for Y coordinate
                // Absorbance = 1 - (Transmittance / 100), so Transmittance = (1 - Absorbance) * 100
                const y = scaleY((1 - peak.absorbance) * 100);

                // Store position for click detection
                this.peakPositions.push({ x, y });

                const isSelected = this.selectedPeakIndices.has(idx);

                // Draw vertical line to peak
                ctx.beginPath();
                // Add transparency to colors: selected is semi-transparent green, unselected is very transparent pink
                ctx.strokeStyle = isSelected ? (CONFIG.visualization.SELECTED_PEAK_COLOR + '88') : (CONFIG.visualization.PEAK_COLOR + '44');
                ctx.lineWidth = isSelected ? 2 : 1;
                ctx.moveTo(x, height - 20);
                ctx.lineTo(x, y);
                ctx.stroke();

                // Draw peak marker (slightly larger when selected)
                const markerSize = isSelected ? this.PEAK_MARKER_SIZE * 0.875 : this.PEAK_MARKER_SIZE * 0.625;
                ctx.beginPath();
                ctx.arc(x, y, markerSize, 0, Math.PI * 2);
                ctx.fillStyle = isSelected ? CONFIG.visualization.SELECTED_PEAK_COLOR : CONFIG.visualization.PEAK_COLOR;
                ctx.fill();

                // Add outline for selected peaks
                if (isSelected) {
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            });
        }

        // Draw axes labels
        this.drawFTIRAxes(ctx, width, height, minWavenumber, maxWavenumber);
    }

    /**
     * Cache static audio visualization elements (grid and axes)
     * @private
     */
    cacheAudioStatic() {
        const width = this.audioCanvas.width;
        const height = this.audioCanvas.height;

        // Create offscreen canvas for static elements
        this.audioStaticCanvas = document.createElement('canvas');
        this.audioStaticCanvas.width = width;
        this.audioStaticCanvas.height = height;
        const staticCtx = this.audioStaticCanvas.getContext('2d');

        // Draw background
        staticCtx.fillStyle = '#0a0a0a';
        staticCtx.fillRect(0, 0, width, height);

        // Draw grid
        this.drawGrid(staticCtx, width, height);

        // Draw axes labels
        this.drawAudioAxes(staticCtx, width, height, 10000);

        this.audioStaticCached = true;
    }

    /**
     * Draw audio FFT visualization (optimized with caching)
     */
    drawAudioFFT() {
        const canvas = this.audioCanvas;
        const ctx = this.audioCtx;
        const width = canvas.width;
        const height = canvas.height;

        // Cache static elements on first draw
        if (!this.audioStaticCached) {
            this.cacheAudioStatic();
        }

        // Draw cached static elements
        ctx.drawImage(this.audioStaticCanvas, 0, 0);

        if (!this.audioEngine) return;

        // Get frequency data
        const frequencyData = this.audioEngine.getFrequencyData();
        if (!frequencyData) return;

        const bufferLength = frequencyData.length;
        const sampleRate = this.audioEngine.getSampleRate();

        // Only show frequencies up to 10kHz for clarity
        const maxFreq = 10000;
        const maxBin = Math.floor((maxFreq / sampleRate) * bufferLength * 2);

        const barWidth = (width - 40) / maxBin;
        let x = 20;

        // Draw frequency bars only (dynamic content)
        for (let i = 0; i < maxBin; i++) {
            const barHeight = (frequencyData[i] / 255) * (height - 40);

            // Color gradient based on frequency
            const hue = (i / maxBin) * 280; // Blue to purple
            ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;

            ctx.fillRect(x, height - 20 - barHeight, barWidth, barHeight);

            x += barWidth;
        }

        // Continue animation if playing
        if (this.audioEngine.getIsPlaying()) {
            this.animationId = requestAnimationFrame(() => this.drawAudioFFT());
        }
    }

    /**
     * Start audio FFT animation
     */
    startAudioAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.drawAudioFFT();
    }

    /**
     * Stop audio FFT animation
     */
    stopAudioAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Use cached static elements if available
        if (this.audioStaticCached && this.audioStaticCanvas) {
            this.audioCtx.drawImage(this.audioStaticCanvas, 0, 0);
        } else {
            // Fallback to drawing directly
            const ctx = this.audioCtx;
            const width = this.audioCanvas.width;
            const height = this.audioCanvas.height;

            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, width, height);

            this.drawGrid(ctx, width, height);
            this.drawAudioAxes(ctx, width, height, 10000);
        }
    }

    /**
     * Draw grid lines
     */
    drawGrid(ctx, width, height) {
        ctx.strokeStyle = '#2a2a3a';
        ctx.lineWidth = 1;

        // Horizontal lines
        for (let i = 1; i < 5; i++) {
            const y = (height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(20, y);
            ctx.lineTo(width - 20, y);
            ctx.stroke();
        }

        // Vertical lines
        for (let i = 1; i < 5; i++) {
            const x = 20 + ((width - 40) / 5) * i;
            ctx.beginPath();
            ctx.moveTo(x, 20);
            ctx.lineTo(x, height - 20);
            ctx.stroke();
        }
    }

    /**
     * Draw FTIR axes labels
     */
    drawFTIRAxes(ctx, width, height, minWavenumber, maxWavenumber) {
        ctx.fillStyle = '#a0a0a0';
        ctx.font = '12px monospace';

        // X-axis labels (wavenumbers)
        const step = Math.ceil((maxWavenumber - minWavenumber) / 5);
        for (let i = 0; i <= 5; i++) {
            const wavenumber = Math.round(minWavenumber + (step * i));
            const x = 20 + ((width - 40) / 5) * i;
            ctx.fillText(wavenumber.toString(), x - 20, height - 5);
        }

        // Y-axis labels (transmittance %)
        for (let i = 0; i <= 5; i++) {
            const transmittance = (i * 20);
            const y = height - 20 - ((height - 40) / 5) * i;
            ctx.fillText(transmittance + '%', 5, y + 5);
        }
    }

    /**
     * Draw audio FFT axes labels
     */
    drawAudioAxes(ctx, width, height, maxFreq) {
        ctx.fillStyle = '#a0a0a0';
        ctx.font = '12px monospace';

        // X-axis labels (frequency in Hz)
        for (let i = 0; i <= 5; i++) {
            const freq = Math.round((maxFreq / 5) * i);
            const x = 20 + ((width - 40) / 5) * i;
            const label = freq >= 1000 ? (freq / 1000).toFixed(1) + 'k' : freq.toString();
            ctx.fillText(label, x - 15, height - 5);
        }

        // Y-axis label
        ctx.fillText('Amplitude', 5, 15);
    }

    /**
     * Clear all visualizations
     */
    clear() {
        this.stopAudioAnimation();

        [this.ftirCtx, this.audioCtx].forEach((ctx) => {
            const canvas = ctx.canvas;
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        });
    }
}
