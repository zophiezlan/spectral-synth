/**
 * Visualizer - Canvas-based visualization for FTIR and audio FFT
 */

class Visualizer {
    constructor(ftirCanvas, audioCanvas) {
        this.ftirCanvas = ftirCanvas;
        this.audioCanvas = audioCanvas;

        this.ftirCtx = ftirCanvas.getContext('2d');
        this.audioCtx = audioCanvas.getContext('2d');

        this.animationId = null;
        this.audioEngine = null;
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

        // Scale functions
        const scaleX = (wavenumber) => {
            return ((wavenumber - minWavenumber) / (maxWavenumber - minWavenumber)) * (width - 40) + 20;
        };

        const scaleY = (transmittance) => {
            return height - 20 - ((transmittance / 100) * (height - 40));
        };

        // Draw spectrum line
        ctx.beginPath();
        ctx.strokeStyle = '#8b5cf6';
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
            peaks.forEach(peak => {
                const x = scaleX(peak.wavenumber);
                const y = scaleY((1 - peak.absorbance) * 100);

                // Draw peak marker
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#ec4899';
                ctx.fill();

                // Draw vertical line to peak
                ctx.beginPath();
                ctx.strokeStyle = '#ec489944';
                ctx.lineWidth = 1;
                ctx.moveTo(x, height - 20);
                ctx.lineTo(x, y);
                ctx.stroke();
            });
        }

        // Draw axes labels
        this.drawFTIRAxes(ctx, width, height, minWavenumber, maxWavenumber);
    }

    /**
     * Draw audio FFT visualization
     */
    drawAudioFFT() {
        const canvas = this.audioCanvas;
        const ctx = this.audioCtx;
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);

        if (!this.audioEngine) return;

        // Get frequency data
        const frequencyData = this.audioEngine.getFrequencyData();
        if (!frequencyData) return;

        // Draw grid
        this.drawGrid(ctx, width, height);

        const bufferLength = frequencyData.length;
        const sampleRate = this.audioEngine.getSampleRate();

        // Only show frequencies up to 10kHz for clarity
        const maxFreq = 10000;
        const maxBin = Math.floor((maxFreq / sampleRate) * bufferLength * 2);

        const barWidth = (width - 40) / maxBin;
        let x = 20;

        // Draw frequency bars
        for (let i = 0; i < maxBin; i++) {
            const barHeight = (frequencyData[i] / 255) * (height - 40);

            // Color gradient based on frequency
            const hue = (i / maxBin) * 280; // Blue to purple
            ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;

            ctx.fillRect(x, height - 20 - barHeight, barWidth, barHeight);

            x += barWidth;
        }

        // Draw axes labels
        this.drawAudioAxes(ctx, width, height, maxFreq);

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

        // Clear canvas
        const ctx = this.audioCtx;
        const width = this.audioCanvas.width;
        const height = this.audioCanvas.height;

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);

        this.drawGrid(ctx, width, height);
        this.drawAudioAxes(ctx, width, height, 10000);
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
