/**
 * Visualization Utilities Module
 *
 * Purpose: Provides visualization-related utilities for canvas rendering
 *
 * Dependencies:
 * - None (uses Canvas API)
 *
 * Exports:
 * - ThumbnailGenerator object - Generate spectrum thumbnails
 * - ResponsiveCanvas object - Handle DPI-aware canvas sizing
 *
 * Usage:
 * ```javascript
 * // Generate a spectrum thumbnail
 * const thumbnail = ThumbnailGenerator.generateSpectrumThumbnail(spectrum, 80, 40);
 * container.appendChild(thumbnail);
 *
 * // Setup responsive canvas
 * ResponsiveCanvas.setupCanvas(canvas, container);
 * ResponsiveCanvas.setupAllCanvases(); // Setup all canvases on page
 * ```
 *
 * Features:
 * - DPI-aware rendering (handles retina displays)
 * - Automatic resize handling
 * - Theme-aware colors (dark/light mode)
 * - Mobile optimizations
 *
 * Performance:
 * - Thumbnails use efficient single-pass rendering
 * - Canvas sizing uses device pixel ratio for crisp output
 * - Debounced resize handlers prevent excessive redraws
 */

// Utility: Waveform thumbnail generator
const ThumbnailGenerator = {
    /**
     * Generate a small canvas thumbnail of a spectrum
     * @param {Array} spectrum - Spectrum data points
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {HTMLCanvasElement} Canvas element with the thumbnail
     */
    generateSpectrumThumbnail(spectrum, width = 80, height = 40) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.className = 'spectrum-thumbnail';

        const ctx = canvas.getContext('2d');

        // Get theme colors
        const isDark = document.body.getAttribute('data-theme') !== 'light';
        const bgColor = isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.5)';
        const lineColor = isDark ? '#8b5cf6' : '#7c3aed';
        const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
        fillGradient.addColorStop(0, isDark ? 'rgba(139, 92, 246, 0.6)' : 'rgba(124, 58, 237, 0.6)');
        fillGradient.addColorStop(1, isDark ? 'rgba(236, 72, 153, 0.2)' : 'rgba(219, 39, 119, 0.2)');

        // Fill background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);

        if (!spectrum || spectrum.length === 0) {
            return canvas;
        }

        // Find min/max for scaling
        const minWavenumber = Math.min(...spectrum.map(p => p.wavenumber));
        const maxWavenumber = Math.max(...spectrum.map(p => p.wavenumber));
        const minTrans = Math.min(...spectrum.map(p => p.transmittance));
        const maxTrans = Math.max(...spectrum.map(p => p.transmittance));

        // Draw spectrum
        ctx.beginPath();
        ctx.moveTo(0, height);

        spectrum.forEach((point) => {
            const x = ((point.wavenumber - minWavenumber) / (maxWavenumber - minWavenumber)) * width;
            const y = height - ((point.transmittance - minTrans) / (maxTrans - minTrans)) * height;
            ctx.lineTo(x, y);
        });

        ctx.lineTo(width, height);
        ctx.closePath();

        // Fill gradient
        ctx.fillStyle = fillGradient;
        ctx.fill();

        // Stroke outline
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        return canvas;
    }
};

// Utility: Color mapping for frequency visualization
const ColorMapper = {
    /**
     * Map infrared frequency to visible color (like if you could "see" IR)
     * @param {number} wavenumber - Wavenumber in cm⁻¹
     * @returns {string} RGB color string
     */
    wavenumberToColor(wavenumber) {
        // Map IR range (400-4000 cm⁻¹) to visible spectrum-like colors
        // Lower wavenumbers (longer wavelengths) → Red
        // Higher wavenumbers (shorter wavelengths) → Violet

        const minWave = 400;
        const maxWave = 4000;
        const normalized = (wavenumber - minWave) / (maxWave - minWave);

        // Use HSL for smooth color transitions
        // Hue: 0 (red) to 280 (violet), avoiding full blue to keep it pleasant
        const hue = Math.floor(280 * (1 - normalized)); // Reverse so high freq = violet
        const saturation = 85;
        const lightness = 60;

        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    },

    /**
     * Map audio frequency to color
     * @param {number} audioFreq - Audio frequency in Hz
     * @returns {string} RGB color string
     */
    audioFreqToColor(audioFreq) {
        // Map audio range (20-8000 Hz) to colors
        const minFreq = 20;
        const maxFreq = 8000;
        const normalized = Math.log(audioFreq / minFreq) / Math.log(maxFreq / minFreq);

        // Similar hue mapping as IR
        const hue = Math.floor(280 * (1 - normalized));
        const saturation = 85;
        const lightness = 60;

        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
};

// Utility: Responsive canvas handler for mobile optimization
const ResponsiveCanvas = {
    /**
     * Setup responsive canvas sizing based on viewport
     * @param {HTMLCanvasElement} canvas - Canvas element to resize
     * @param {number} aspectRatio - Desired aspect ratio (width/height), default 2:1
     */
    setupCanvas(canvas, aspectRatio = 2) {
        if (!canvas) return;

        // Define redraw handlers once to avoid repeated object creation
        const redrawHandlers = {
            'ftir-canvas': () => {
                if (typeof visualizer !== 'undefined' && visualizer.currentSpectrum) {
                    visualizer.drawFTIRSpectrum(visualizer.currentSpectrum, visualizer.currentPeaks || []);
                }
            },
            'audio-canvas': () => {
                // Only redraw if visualizer exists and audio engine is initialized
                // Check for audioEngine property to ensure visualizer is fully initialized
                if (typeof visualizer !== 'undefined' && visualizer.audioEngine) {
                    // Clear audio canvas static cache and trigger immediate redraw
                    visualizer.audioStaticCached = false;
                    visualizer.stopAudioAnimation(); // Redraws with cleared cache
                }
            },
            'ftir-canvas-a': () => {
                if (typeof visualizerA !== 'undefined' && visualizerA.currentSpectrum) {
                    visualizerA.drawFTIRSpectrum(visualizerA.currentSpectrum, visualizerA.currentPeaks || []);
                }
            },
            'ftir-canvas-b': () => {
                if (typeof visualizerB !== 'undefined' && visualizerB.currentSpectrum) {
                    visualizerB.drawFTIRSpectrum(visualizerB.currentSpectrum, visualizerB.currentPeaks || []);
                }
            }
        };

        const resize = () => {
            const container = canvas.parentElement;
            if (!container) return;

            // Get container width
            const containerWidth = container.clientWidth;

            // Calculate dimensions based on screen size
            let canvasWidth, canvasHeight;

            if (window.innerWidth <= 768) {
                // Mobile: full container width, reduced height
                canvasWidth = Math.min(containerWidth - 32, 600); // Subtract padding
                canvasHeight = Math.min(canvasWidth / aspectRatio, 250);

                // Set canvas internal dimensions to match logical pixels
                // This ensures drawing code coordinates match the display size
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;

                // Set CSS size to match (no scaling needed)
                canvas.style.width = canvasWidth + 'px';
                canvas.style.height = canvasHeight + 'px';
            } else {
                // Desktop: standard size
                canvas.width = 600;
                canvas.height = 300;
                canvas.style.width = '100%';
                canvas.style.height = 'auto';
            }

            // Trigger redraw of current visualization after resize
            const handler = redrawHandlers[canvas.id];
            if (handler) {
                handler();
            }
        };

        // Initial resize
        resize();

        // Debounce resize events
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(resize, 250);
        });

        // Also handle orientation change on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(resize, 100);
        });
    },

    /**
     * Setup all canvases in the application
     */
    setupAllCanvases() {
        const ftirCanvas = document.getElementById('ftir-canvas');
        const audioCanvas = document.getElementById('audio-canvas');
        const ftirCanvasA = document.getElementById('ftir-canvas-a');
        const ftirCanvasB = document.getElementById('ftir-canvas-b');

        this.setupCanvas(ftirCanvas, 2);
        this.setupCanvas(audioCanvas, 2);
        this.setupCanvas(ftirCanvasA, 2);
        this.setupCanvas(ftirCanvasB, 2);
    }
};
