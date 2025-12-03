/**
 * Main Application - Spectral Synthesizer
 *
 * Coordinates between UI, data, audio engine, and visualization.
 * This is the main entry point that ties together all the modules.
 */

// Utility: Loading overlay
const LoadingOverlay = {
    show(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = overlay.querySelector('.loading-text');
        text.textContent = message;
        overlay.style.display = 'flex';
    },
    hide() {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = 'none';
    }
};

// Utility: Toast notifications (replaces alerts)
const Toast = {
    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    error(message, duration = 5000) {
        this.show(message, 'error', duration);
    },

    success(message, duration = 3000) {
        this.show(message, 'success', duration);
    },

    warning(message, duration = 4000) {
        this.show(message, 'warning', duration);
    },

    info(message, duration = 3000) {
        this.show(message, 'info', duration);
    }
};

// Utility: Screen reader announcements
const ScreenReader = {
    announce(message) {
        const status = document.getElementById('playback-status');
        if (status) {
            status.textContent = message;
            // Clear after 1 second to allow re-announcement
            setTimeout(() => status.textContent = '', 1000);
        }
    }
};

// Utility: Error handler
const ErrorHandler = {
    handle(error, userMessage, options = {}) {
        console.error('Error:', error);

        const severity = options.severity || 'error';
        const showToast = options.showToast !== false;

        if (showToast) {
            Toast[severity](userMessage);
        }

        // Optionally rethrow
        if (options.rethrow) {
            throw error;
        }
    }
};

// Utility: iOS Safari audio context helper
const iOSAudioHelper = {
    isIOS() {
        return /iPhone|iPad|iPod/.test(navigator.userAgent);
    },

    async ensureAudioContext(audioEngine) {
        if (!audioEngine || !audioEngine.audioContext) {
            return;
        }

        if (audioEngine.audioContext.state === 'suspended') {
            try {
                await audioEngine.audioContext.resume();
                console.log('✓ Audio context resumed');
            } catch (error) {
                console.error('Failed to resume audio context:', error);
                throw error;
            }
        }
    }
};

// Utility: Browser compatibility checker
const BrowserCompatibility = {
    check() {
        const required = {
            'Web Audio API': ('AudioContext' in window) || ('webkitAudioContext' in window),
            'Canvas API': !!document.createElement('canvas').getContext,
            'Fetch API': 'fetch' in window,
            'ES6 Classes': typeof (class {}) === 'function',
            'Async/Await': (async () => {}).constructor.name === 'AsyncFunction',
        };

        const unsupported = Object.entries(required)
            .filter(([name, supported]) => !supported)
            .map(([name]) => name);

        if (unsupported.length > 0) {
            return {
                compatible: false,
                unsupported: unsupported
            };
        }

        return { compatible: true, unsupported: [] };
    },

    showWarning(unsupportedFeatures) {
        const message = `Your browser is missing required features:\n\n${unsupportedFeatures.join('\n')}\n\nPlease use a modern browser (Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+).`;
        Toast.error(message, 10000); // Show for 10 seconds
        console.error('Unsupported features:', unsupportedFeatures);
    }
};

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

        spectrum.forEach((point, i) => {
            const x = ((point.wavenumber - minWavenumber) / (maxWavenumber - minWavenumber)) * width;
            const y = height - ((point.transmittance - minTrans) / (maxTrans - minTrans)) * height;

            if (i === 0) {
                ctx.lineTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
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

// Utility: Enhanced micro-interactions
const MicroInteractions = {
    /**
     * Add pulse animation to element
     * @param {HTMLElement} element - Element to animate
     * @param {number} duration - Duration in milliseconds
     */
    pulse(element, duration = 2000) {
        element.classList.add('pulsing');
        setTimeout(() => {
            element.classList.remove('pulsing');
        }, duration);
    },

    /**
     * Add success celebration effect
     * @param {string} message - Success message
     */
    celebrate(message) {
        // Check if this is first time for this action
        const key = `celebration_${message.replace(/\s/g, '_')}`;

        if (!localStorage.getItem(key)) {
            Toast.success(`🎉 ${message}`, 4000);
            localStorage.setItem(key, 'true');
        } else {
            Toast.success(message, 3000);
        }
    },

    /**
     * Add ripple effect to button click
     * @param {MouseEvent} event - Click event
     */
    ripple(event) {
        const button = event.currentTarget;
        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();

        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple-effect');

        button.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    }
};

// Utility: Interactive Tutorial Manager
const TutorialManager = {
    currentStep: 0,
    currentPath: null,
    isActive: false,
    overlay: null,
    tooltip: null,
    
    // Tutorial paths
    paths: {
        chemistry: [
            {
                target: '#substance',
                title: 'Select a Substance',
                description: 'Start by choosing one of 381 real FTIR spectra from forensic laboratories. Each substance has a unique molecular fingerprint.',
                action: null,
                position: 'bottom'
            },
            {
                target: '#ftir-canvas',
                title: 'The FTIR Spectrum',
                description: 'This shows the infrared absorption pattern. Each dip (peak) represents a molecular vibration—bonds stretching, bending, or twisting.',
                action: null,
                position: 'top'
            },
            {
                target: '#ftir-canvas',
                title: 'Understanding Peaks',
                description: 'Lower transmittance (deeper valleys) = stronger absorption. These characteristic peaks are what make each molecule unique, like a fingerprint.',
                action: null,
                position: 'top'
            },
            {
                target: '#peak-selection-content',
                title: 'Peak Selection',
                description: 'You can select individual peaks to hear. Each peak corresponds to a specific molecular vibration frequency. Click peaks directly on the FTIR spectrum above.',
                action: null,
                position: 'top'
            },
            {
                target: '#play',
                title: 'Hear the Molecule',
                description: 'Click Play to convert those molecular vibrations into audible sound. The IR frequencies are mapped down to the audible range.',
                action: () => document.getElementById('play')?.click(),
                position: 'top'
            },
            {
                target: '#audio-canvas',
                title: 'Audio Frequency Analysis',
                description: 'This FFT visualization shows the same Fourier transform math as the FTIR spectrum—just applied to audio instead of infrared light!',
                action: null,
                position: 'top'
            },
            {
                target: '#playback-mode-select',
                title: 'Playback Modes',
                description: 'Try different modes: Chord plays all peaks together, Arpeggio plays them in sequence, creating different musical interpretations.',
                action: null,
                position: 'top'
            },
            {
                target: '#audio-effects-content',
                title: 'Audio Effects',
                description: 'Experiment with reverb, filters, and ADSR envelope controls to shape the sound. Make chemistry musical!',
                action: null,
                position: 'top'
            }
        ],
        music: [
            {
                target: '#substance',
                title: 'Choose Your Sound Source',
                description: 'Each substance provides a unique set of frequencies to work with—think of it as a custom oscillator bank.',
                action: null,
                position: 'bottom'
            },
            {
                target: '#play',
                title: 'Generate Sound',
                description: 'Press Play to hear additive synthesis in action. Multiple sine wave oscillators combine to create complex timbres.',
                action: () => document.getElementById('play')?.click(),
                position: 'top'
            },
            {
                target: '#audio-canvas',
                title: 'Real-Time FFT',
                description: 'Watch the frequency spectrum in real-time. This FFT shows you exactly which frequencies are present in the sound.',
                action: null,
                position: 'top'
            },
            {
                target: '#playback-mode-select',
                title: 'Musical Modes',
                description: 'Switch between Chord (harmonic), Arpeggio (melodic), Sequential, or Random for different musical effects.',
                action: null,
                position: 'top'
            },
            {
                target: '.adsr-grid',
                title: 'ADSR Envelope',
                description: 'Shape your sound over time: Attack (rise), Decay (fall), Sustain (hold), Release (fade). Essential for expressive synthesis!',
                action: null,
                position: 'top'
            },
            {
                target: '#reverb',
                title: 'Spatial Effects',
                description: 'Add reverb for depth and atmosphere. The larger the value, the bigger the virtual space.',
                action: null,
                position: 'top'
            },
            {
                target: '#filter-freq',
                title: 'Frequency Filtering',
                description: 'Use the lowpass filter to shape the tone. Lower values = darker, warmer sound. Higher = brighter, sharper.',
                action: null,
                position: 'top'
            },
            {
                target: '#peak-selection-content',
                title: 'Frequency Selection',
                description: 'Select specific frequencies to create your own custom scales and harmonies. Click peaks on the canvas to select them. Very experimental!',
                action: null,
                position: 'top'
            }
        ]
    },
    
    /**
     * Start tutorial with selected path
     * @param {string} path - 'chemistry' or 'music'
     */
    start(path = 'chemistry') {
        this.currentPath = path;
        this.currentStep = 0;
        this.isActive = true;
        
        // Save state
        this.saveProgress();
        
        // Create overlay and tooltip
        this.createOverlay();
        this.createTooltip();
        
        // Show first step
        this.showStep();
    },
    
    /**
     * Resume tutorial from saved progress
     */
    resume() {
        const progress = this.loadProgress();
        if (progress && progress.path) {
            this.currentPath = progress.path;
            this.currentStep = progress.step || 0;
            this.start(this.currentPath);
        }
    },
    
    /**
     * Show current step
     */
    showStep() {
        if (!this.isActive || !this.currentPath) return;
        
        const steps = this.paths[this.currentPath];
        if (this.currentStep >= steps.length) {
            this.complete();
            return;
        }
        
        const step = steps[this.currentStep];
        const target = document.querySelector(step.target);
        
        if (!target) {
            // Skip to next step if target not found, but prevent infinite loop
            this.currentStep++;
            if (this.currentStep >= steps.length) {
                // If we've skipped all remaining steps, just complete the tutorial
                this.complete();
                return;
            }
            setTimeout(() => this.showStep(), 100);
            return;
        }
        
        // Position overlay spotlight
        this.positionSpotlight(target);
        
        // Position and show tooltip
        this.showTooltip(target, step);
        
        // Execute step action if any
        if (step.action && typeof step.action === 'function') {
            setTimeout(() => step.action(), 500);
        }
        
        // Save progress
        this.saveProgress();
    },
    
    /**
     * Next step
     */
    next() {
        this.currentStep++;
        this.showStep();
    },
    
    /**
     * Previous step
     */
    previous() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep();
        }
    },
    
    /**
     * Skip tutorial
     */
    skip() {
        if (confirm('Are you sure you want to skip the tutorial? You can restart it anytime from the help menu.')) {
            this.end(false);
        }
    },
    
    /**
     * Complete tutorial
     */
    complete() {
        this.end(true);
        Toast.success('🎉 Tutorial complete! Press ? anytime to see keyboard shortcuts');
        MicroInteractions.celebrate('Tutorial completed');
        
        // Mark as completed
        localStorage.setItem('tutorial-completed', 'true');
        localStorage.removeItem('tutorial-progress');
    },
    
    /**
     * End tutorial
     * @param {boolean} completed - Whether tutorial was completed
     */
    end(completed = false) {
        this.isActive = false;
        this.currentStep = 0;
        this.currentPath = null;
        
        // Remove overlay and tooltip
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
        
        // Remove spotlight styles
        const style = document.getElementById('tutorial-spotlight-styles');
        if (style) {
            style.remove();
        }
    },
    
    /**
     * Create overlay for spotlight effect
     */
    createOverlay() {
        if (this.overlay) {
            this.overlay.remove();
        }
        
        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.className = 'tutorial-overlay';
        overlay.setAttribute('role', 'presentation');
        document.body.appendChild(overlay);
        
        this.overlay = overlay;
    },
    
    /**
     * Create tooltip container
     */
    createTooltip() {
        if (this.tooltip) {
            this.tooltip.remove();
        }
        
        const tooltip = document.createElement('div');
        tooltip.id = 'tutorial-tooltip';
        tooltip.className = 'tutorial-tooltip';
        tooltip.setAttribute('role', 'dialog');
        tooltip.setAttribute('aria-live', 'polite');
        
        document.body.appendChild(tooltip);
        
        this.tooltip = tooltip;
    },
    
    /**
     * Position spotlight on target element
     * @param {HTMLElement} target - Target element
     */
    positionSpotlight(target) {
        const rect = target.getBoundingClientRect();
        const padding = 10;
        
        // Add spotlight styles
        let style = document.getElementById('tutorial-spotlight-styles');
        if (!style) {
            style = document.createElement('style');
            style.id = 'tutorial-spotlight-styles';
            document.head.appendChild(style);
        }
        
        // Use viewport dimensions instead of magic 9999px for better performance
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        
        style.textContent = `
            .tutorial-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 9998;
                pointer-events: none;
                box-shadow: 
                    0 0 0 ${rect.top - padding}px rgba(0, 0, 0, 0.7),
                    ${rect.right + padding}px 0 0 ${vw}px rgba(0, 0, 0, 0.7),
                    0 ${rect.bottom + padding}px 0 ${vh}px rgba(0, 0, 0, 0.7),
                    ${-(vw)}px 0 0 ${window.innerWidth - rect.left + padding}px rgba(0, 0, 0, 0.7);
            }
            
            .tutorial-spotlight-target {
                position: relative !important;
                z-index: 9999 !important;
                box-shadow: 0 0 0 3px #ec4899, 0 0 20px rgba(236, 72, 153, 0.6) !important;
                border-radius: 4px;
            }
        `;
        
        // Remove previous spotlight
        document.querySelectorAll('.tutorial-spotlight-target').forEach(el => {
            el.classList.remove('tutorial-spotlight-target');
        });
        
        // Add spotlight to target
        target.classList.add('tutorial-spotlight-target');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    
    /**
     * Show tooltip with step information
     * @param {HTMLElement} target - Target element
     * @param {Object} step - Step configuration
     */
    showTooltip(target, step) {
        const steps = this.paths[this.currentPath];
        const progress = `${this.currentStep + 1}/${steps.length}`;
        
        this.tooltip.innerHTML = `
            <div class="tutorial-tooltip-header">
                <h3>${step.title}</h3>
                <button class="tutorial-close" aria-label="Close tutorial">&times;</button>
            </div>
            <div class="tutorial-tooltip-body">
                <p>${step.description}</p>
            </div>
            <div class="tutorial-tooltip-footer">
                <span class="tutorial-progress">${progress}</span>
                <div class="tutorial-buttons">
                    ${this.currentStep > 0 ? '<button class="tutorial-btn tutorial-prev">Previous</button>' : ''}
                    <button class="tutorial-btn tutorial-skip">Skip</button>
                    <button class="tutorial-btn tutorial-next primary">${this.currentStep === steps.length - 1 ? 'Finish' : 'Next'}</button>
                </div>
            </div>
        `;
        
        // Make tooltip visible but off-screen to get accurate dimensions
        this.tooltip.style.display = 'block';
        this.tooltip.style.visibility = 'hidden';
        this.tooltip.style.left = '-9999px';
        
        // Force layout reflow to ensure dimensions are calculated
        void this.tooltip.offsetHeight;
        
        // Position tooltip
        const rect = target.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        
        let top, left;
        
        switch (step.position) {
            case 'top':
                top = rect.top - tooltipRect.height - 20;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = rect.bottom + 20;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.left - tooltipRect.width - 20;
                break;
            case 'right':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.right + 20;
                break;
            default:
                top = rect.bottom + 20;
                left = rect.left;
        }
        
        // Keep within viewport
        top = Math.max(10, Math.min(top, window.innerHeight - tooltipRect.height - 10));
        left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));
        
        // Position and make visible
        this.tooltip.style.top = top + 'px';
        this.tooltip.style.left = left + 'px';
        this.tooltip.style.visibility = 'visible';
        
        // Add event listeners
        this.tooltip.querySelector('.tutorial-close')?.addEventListener('click', () => this.skip());
        this.tooltip.querySelector('.tutorial-prev')?.addEventListener('click', () => this.previous());
        this.tooltip.querySelector('.tutorial-skip')?.addEventListener('click', () => this.skip());
        this.tooltip.querySelector('.tutorial-next')?.addEventListener('click', () => this.next());
    },
    
    /**
     * Save progress to localStorage
     */
    saveProgress() {
        if (this.isActive && this.currentPath) {
            localStorage.setItem('tutorial-progress', JSON.stringify({
                path: this.currentPath,
                step: this.currentStep,
                timestamp: Date.now()
            }));
        }
    },
    
    /**
     * Load progress from localStorage
     * @returns {Object|null} Progress object or null
     */
    loadProgress() {
        try {
            const progress = localStorage.getItem('tutorial-progress');
            return progress ? JSON.parse(progress) : null;
        } catch (e) {
            return null;
        }
    },
    
    /**
     * Check if tutorial has been completed
     * @returns {boolean}
     */
    isCompleted() {
        return localStorage.getItem('tutorial-completed') === 'true';
    },
    
    /**
     * Reset tutorial state
     */
    reset() {
        localStorage.removeItem('tutorial-completed');
        localStorage.removeItem('tutorial-progress');
        this.end(false);
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

// Utility: Favorites manager using localStorage
const Favorites = {
    STORAGE_KEY: 'spectral-synth-favorites',

    load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to load favorites:', error);
            return [];
        }
    },

    save(favorites) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favorites));
        } catch (error) {
            console.error('Failed to save favorites:', error);
            Toast.error('Failed to save favorites');
        }
    },

    add(substanceName) {
        const favorites = this.load();
        if (!favorites.includes(substanceName)) {
            favorites.push(substanceName);
            this.save(favorites);
            Toast.success(`Added "${substanceName}" to favorites`, 2000);
        }
    },

    remove(substanceName) {
        let favorites = this.load();
        favorites = favorites.filter(name => name !== substanceName);
        this.save(favorites);
        Toast.info(`Removed "${substanceName}" from favorites`, 2000);
    },

    toggle(substanceName) {
        const favorites = this.load();
        if (favorites.includes(substanceName)) {
            this.remove(substanceName);
            return false;
        } else {
            this.add(substanceName);
            return true;
        }
    },

    isFavorite(substanceName) {
        return this.load().includes(substanceName);
    },

    getAll() {
        return this.load();
    }
};

// Utility: Format time with dynamic units
const TimeFormatter = {
    format(ms) {
        if (ms < 1000) {
            return `${Math.round(ms)} ms`;
        } else {
            return `${(ms / 1000).toFixed(2)} s`;
        }
    }
};

// Global instances
let audioEngine;
let visualizer;
let visualizerA;
let visualizerB;
let frequencyMapper;
let midiOutput;
let currentSpectrum = null;
let currentPeaks = null;
let libraryData = null;

// Comparison mode state
let comparisonMode = false;
let substanceA = { spectrum: null, peaks: null, data: null };
let substanceB = { spectrum: null, peaks: null, data: null };
let blendRatio = 0.5; // 0 = pure A, 1 = pure B

// DOM elements - Mode selector
const singleModeButton = document.getElementById('single-mode');
const comparisonModeButton = document.getElementById('comparison-mode');

// DOM elements - Single mode
const singleControls = document.getElementById('single-controls');
const substanceSelect = document.getElementById('substance');
const searchInput = document.getElementById('search');
const categorySelect = document.getElementById('category');
const resultsCount = document.getElementById('results-count');
const playButton = document.getElementById('play');
const stopButton = document.getElementById('stop');
const clearSelectionButton = document.getElementById('clear-selection');
const selectionCount = document.getElementById('selection-count');
const durationSlider = document.getElementById('duration');
const durationValue = document.getElementById('duration-value');
const volumeSlider = document.getElementById('volume');
const volumeValue = document.getElementById('volume-value');
const reverbSlider = document.getElementById('reverb');
const reverbValue = document.getElementById('reverb-value');
const filterFreqSlider = document.getElementById('filter-freq');
const filterFreqValue = document.getElementById('filter-freq-value');
const attackSlider = document.getElementById('attack');
const attackValue = document.getElementById('attack-value');
const decaySlider = document.getElementById('decay');
const decayValue = document.getElementById('decay-value');
const sustainSlider = document.getElementById('sustain');
const sustainValue = document.getElementById('sustain-value');
const releaseSlider = document.getElementById('release');
const releaseValue = document.getElementById('release-value');
const adsrCurveSelect = document.getElementById('adsr-curve-select');
const mappingInfo = document.getElementById('mapping-info');
const mappingInfoModal = document.getElementById('mapping-info-modal');
const ftirCanvas = document.getElementById('ftir-canvas');
const audioCanvas = document.getElementById('audio-canvas');

// DOM elements - Comparison mode
const comparisonControls = document.getElementById('comparison-controls');
const comparisonVisualization = document.getElementById('comparison-visualization');
const substanceSelectA = document.getElementById('substance-a');
const substanceSelectB = document.getElementById('substance-b');
const playAButton = document.getElementById('play-a');
const playBButton = document.getElementById('play-b');
const playBothSeqButton = document.getElementById('play-both-sequential');
const playBothSimButton = document.getElementById('play-both-simultaneous');
const playBlendButton = document.getElementById('play-blend');
const blendRatioSlider = document.getElementById('blend-ratio');
const blendRatioValue = document.getElementById('blend-ratio-value');
const blendControls = document.getElementById('blend-controls');
const comparisonDurationSlider = document.getElementById('comparison-duration');
const comparisonDurationValue = document.getElementById('comparison-duration-value');
const ftirCanvasA = document.getElementById('ftir-canvas-a');
const ftirCanvasB = document.getElementById('ftir-canvas-b');

// Filter state
let currentSearchTerm = '';
let currentCategory = 'all';
let searchDebounceTimer = null;

/**
 * Initialize application
 *
 * Creates all necessary instances, loads data, and sets up event listeners.
 * This is the main initialization function called when the page loads.
 *
 * @throws {Error} If critical initialization fails
 */
async function init() {
    try {
        // Check browser compatibility first
        const compatibility = BrowserCompatibility.check();
        if (!compatibility.compatible) {
            BrowserCompatibility.showWarning(compatibility.unsupported);
            // Continue anyway but user has been warned
        }

        LoadingOverlay.show('Initializing Spectral Synthesizer...');

        // Setup responsive canvases first (before creating visualizers)
        ResponsiveCanvas.setupAllCanvases();

        // Create instances
        audioEngine = new AudioEngine();
        frequencyMapper = new FrequencyMapper();

        // Create MIDI output instance (optional, may not be supported)
        try {
            if (typeof MIDIOutput !== 'undefined') {
                midiOutput = new MIDIOutput();
                // Try to initialize MIDI (don't fail if not supported)
                try {
                    await midiOutput.init();
                    refreshMIDIDevices();
                } catch (midiError) {
                    console.log('MIDI not available:', midiError.message);
                }
            }
        } catch (error) {
            console.log('MIDI Output not loaded');
        }

        // Create visualizers for single mode
        visualizer = new Visualizer(ftirCanvas, audioCanvas);
        visualizer.setAudioEngine(audioEngine);
        visualizer.onPeakSelectionChange = handlePeakSelectionChange;

        // Create visualizers for comparison mode
        // Note: audio canvas not used in comparison mode
        visualizerA = new Visualizer(ftirCanvasA, document.createElement('canvas'));
        visualizerB = new Visualizer(ftirCanvasB, document.createElement('canvas'));

        // Load FTIR library
        await loadLibrary();

        // Set up event listeners
        setupEventListeners();

        // Set up onboarding and shortcuts
        setupOnboarding();
        setupShortcutsOverlay();
        setupMenuModals();

        // Set up theme toggle
        setupThemeToggle();

        LoadingOverlay.hide();
        Toast.success('Spectral Synthesizer ready! 🎵');
        console.log('🎵 Spectral Synthesizer initialized');

        // Show onboarding for first-time users
        checkAndShowOnboarding();
    } catch (error) {
        LoadingOverlay.hide();
        ErrorHandler.handle(
            error,
            'Failed to initialize the application. Please refresh the page and try again.',
            { rethrow: true }
        );
    }
}

/**
 * Load FTIR library from JSON
 * 
 * Fetches the FTIR spectral database and populates the substance selectors.
 * 
 * @throws {Error} If library fails to load
 */
async function loadLibrary() {
    try {
        LoadingOverlay.show('Loading FTIR library (381 spectra)...');
        console.log('Loading FTIR library...');

        const response = await fetch(CONFIG.library.LIBRARY_FILE);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        libraryData = await response.json();

        console.log(`✓ Loaded ${libraryData.length} spectra from ENFSI library`);

        // Populate substance selectors
        populateSubstanceSelector();
        populateComparisonSelectors();
    } catch (error) {
        ErrorHandler.handle(
            error,
            'Failed to load FTIR library. Please check your connection and refresh the page.'
        );
        throw error; // Re-throw to stop initialization
    }
}

/**
 * Categorize substance based on name and chemical properties
 * @param {Object} item - Substance data object
 * @returns {string} Category name
 */
function categorizeSubstance(item) {
    const name = item.name.toLowerCase();
    const formula = (item.formula || '').toLowerCase();

    // Opioids
    const opioidKeywords = ['morphine', 'heroin', 'codeine', 'fentanyl', 'oxycodone',
                            'hydrocodone', 'buprenorphine', 'methadone', 'tramadol',
                            'diacetylmorphine', 'acetylmorphine', 'alfentanil', 'sufentanil',
                            'remifentanil', 'carfentanil', 'acetylfentanyl', 'furanylfentanyl',
                            'acrylfentanyl', 'butyrfentanyl', 'valerylfentanyl'];
    if (opioidKeywords.some(keyword => name.includes(keyword))) {
        return 'opioids';
    }

    // Stimulants
    const stimulantKeywords = ['cocaine', 'amphetamine', 'methamphetamine', 'mdma',
                               'mephedrone', 'caffeine', 'methylphenidate', 'cathinone',
                               'methcathinone', 'ecstasy', 'speed', 'crystal',
                               'ethylone', 'methylone', 'butylone', 'pentedrone',
                               'ephidrine', 'pseudoephedrine', 'benzoylecgonine'];
    if (stimulantKeywords.some(keyword => name.includes(keyword))) {
        return 'stimulants';
    }

    // Benzodiazepines
    const benzoKeywords = ['diazepam', 'alprazolam', 'clonazepam', 'lorazepam',
                          'temazepam', 'oxazepam', 'nitrazepam', 'flunitrazepam',
                          'bromazepam', 'lormetazepam', 'etizolam', 'flubromazolam'];
    if (benzoKeywords.some(keyword => name.includes(keyword))) {
        return 'benzodiazepines';
    }

    // Psychedelics
    const psychedelicKeywords = ['lsd', 'lysergic', 'psilocybin', 'dmt', 'mescaline',
                                 '2c-b', '2c-i', '2c-e', 'nbome', 'dom', 'doi'];
    if (psychedelicKeywords.some(keyword => name.includes(keyword))) {
        return 'psychedelics';
    }

    // Cannabinoids
    const cannabinoidKeywords = ['thc', 'cbd', 'cannabinol', 'cannabidiol', 'cannabis',
                                 'jwh', 'am-2201', 'cp-47', 'hu-210'];
    if (cannabinoidKeywords.some(keyword => name.includes(keyword))) {
        return 'cannabinoids';
    }

    // Steroids
    const steroidKeywords = ['testosterone', 'stanozolol', 'nandrolone', 'methandienone',
                            'boldenone', 'trenbolone', 'oxandrolone', 'methenolone',
                            'drostanolone', 'mesterolone'];
    if (steroidKeywords.some(keyword => name.includes(keyword))) {
        return 'steroids';
    }

    return 'other';
}

/**
 * Get filtered library based on search term and category
 * @returns {Array} Filtered library data
 */
function getFilteredLibrary() {
    const showFavoritesOnly = document.getElementById('show-favorites')?.checked || false;
    const favoritesList = Favorites.getAll();

    return libraryData.filter(item => {
        // Favorites filter
        if (showFavoritesOnly && !favoritesList.includes(item.name)) {
            return false;
        }

        // Category filter
        const itemCategory = categorizeSubstance(item);
        const categoryMatch = currentCategory === 'all' || itemCategory === currentCategory;

        // Search filter
        const searchLower = currentSearchTerm.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(searchLower);
        const formulaMatch = (item.formula || '').toLowerCase().includes(searchLower);
        const searchMatch = !currentSearchTerm || nameMatch || formulaMatch;

        return categoryMatch && searchMatch;
    });
}

/**
 * Populate substance selector dropdown
 */
function populateSubstanceSelector() {
    const filteredData = getFilteredLibrary();

    // Clear existing options except the first one
    substanceSelect.innerHTML = '<option value="">-- Select a Substance --</option>';

    // Add filtered substances
    filteredData.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        substanceSelect.appendChild(option);
    });

    // Update results count
    resultsCount.textContent = `${filteredData.length} substance${filteredData.length !== 1 ? 's' : ''}`;
}

/**
 * Populate comparison substance selectors
 */
function populateComparisonSelectors() {
    // Populate both A and B selectors with all substances
    [substanceSelectA, substanceSelectB].forEach(select => {
        select.innerHTML = '<option value="">-- Select --</option>';

        libraryData.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            select.appendChild(option);
        });
    });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Mode switching
    singleModeButton.addEventListener('click', () => switchMode(false));
    comparisonModeButton.addEventListener('click', () => switchMode(true));

    // Single mode - Substance selection
    substanceSelect.addEventListener('change', handleSubstanceChange);

    // Single mode - Search and filter
    searchInput.addEventListener('input', handleSearch);
    categorySelect.addEventListener('change', handleCategoryChange);

    // Single mode - Playback controls
    playButton.addEventListener('click', handlePlay);
    stopButton.addEventListener('click', handleStop);

    // Peak selection
    if (clearSelectionButton) {
        clearSelectionButton.addEventListener('click', handleClearSelection);
    }

    // Single mode - Sliders
    durationSlider.addEventListener('input', (e) => {
        durationValue.textContent = parseFloat(e.target.value).toFixed(1);
    });

    volumeSlider.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value) / 100;
        volumeValue.textContent = e.target.value;
        audioEngine.setVolume(volume);
    });

    // Audio effects
    reverbSlider.addEventListener('input', (e) => {
        const reverb = parseInt(e.target.value) / 100;
        reverbValue.textContent = e.target.value;
        audioEngine.setReverb(reverb);
    });

    filterFreqSlider.addEventListener('input', (e) => {
        const freq = parseInt(e.target.value);
        filterFreqValue.textContent = freq;
        audioEngine.setFilterFrequency(freq);
    });

    // ADSR controls
    attackSlider.addEventListener('input', (e) => {
        const timeMs = parseInt(e.target.value);
        const timeSec = timeMs / 1000;
        attackValue.textContent = timeMs;
        audioEngine.setAttackTime(timeSec);
    });

    decaySlider.addEventListener('input', (e) => {
        const timeMs = parseInt(e.target.value);
        const timeSec = timeMs / 1000;
        decayValue.textContent = timeMs;
        audioEngine.setDecayTime(timeSec);
    });

    sustainSlider.addEventListener('input', (e) => {
        const level = parseInt(e.target.value) / 100;
        sustainValue.textContent = e.target.value;
        audioEngine.setSustainLevel(level);
    });

    releaseSlider.addEventListener('input', (e) => {
        const timeMs = parseInt(e.target.value);
        const timeSec = timeMs / 1000;
        releaseValue.textContent = timeMs;
        audioEngine.setReleaseTime(timeSec);
    });

    // ADSR curve selector
    if (adsrCurveSelect) {
        // Populate ADSR curve options
        const curves = audioEngine.getADSRCurves();
        Object.keys(curves).forEach(key => {
            const curve = curves[key];
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${curve.name} - ${curve.description}`;
            adsrCurveSelect.appendChild(option);
        });
        
        // Set default curve
        adsrCurveSelect.value = CONFIG.adsr.DEFAULT_CURVE;

        adsrCurveSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                try {
                    audioEngine.setADSRCurve(e.target.value);
                } catch (error) {
                    ErrorHandler.handle(error, 'Failed to set ADSR curve');
                }
            }
        });
    }

    // Preset selector
    const presetSelect = document.getElementById('preset-select');
    if (presetSelect) {
        // Populate preset options
        const presets = audioEngine.getPresets();
        Object.keys(presets).forEach(key => {
            const preset = presets[key];
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${preset.name} - ${preset.description}`;
            presetSelect.appendChild(option);
        });

        presetSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                try {
                    audioEngine.applyPreset(e.target.value);
                    // Update UI to reflect preset values
                    reverbSlider.value = Math.round(audioEngine.getReverb() * 100);
                    reverbValue.textContent = reverbSlider.value;
                    filterFreqSlider.value = audioEngine.getFilterFrequency();
                    filterFreqValue.textContent = filterFreqSlider.value;
                } catch (error) {
                    ErrorHandler.handle(error, 'Failed to apply preset');
                }
            }
        });
    }

    // CSV Import
    const csvImport = document.getElementById('csv-import');
    if (csvImport) {
        csvImport.addEventListener('change', handleCSVImport);
    }

    // JCAMP-DX Import
    const jcampImport = document.getElementById('jcamp-import');
    if (jcampImport) {
        jcampImport.addEventListener('change', handleJCAMPImport);
    }

    // Download Template
    const downloadTemplate = document.getElementById('download-template');
    if (downloadTemplate) {
        downloadTemplate.addEventListener('click', () => {
            CSVImporter.downloadTemplate();
        });
    }

    // Export WAV
    const exportWAV = document.getElementById('export-wav');
    if (exportWAV) {
        exportWAV.addEventListener('click', handleExportWAV);
    }

    // Export MP3
    const exportMP3 = document.getElementById('export-mp3');
    if (exportMP3) {
        exportMP3.addEventListener('click', handleExportMP3);
    }

    // Playback mode selector
    const playbackModeSelect = document.getElementById('playback-mode-select');
    if (playbackModeSelect) {
        // Populate playback mode options
        const modes = audioEngine.getPlaybackModes();
        Object.keys(modes).forEach(key => {
            const mode = modes[key];
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${mode.name} - ${mode.description}`;
            playbackModeSelect.appendChild(option);
        });

        playbackModeSelect.addEventListener('change', (e) => {
            try {
                audioEngine.setPlaybackMode(e.target.value);
                console.log(`Playback mode changed to: ${e.target.value}`);
            } catch (error) {
                ErrorHandler.handle(error, 'Failed to set playback mode');
            }
        });
    }

    // Comparison mode - Substance selection
    substanceSelectA.addEventListener('change', () => handleComparisonSubstanceChange('A'));
    substanceSelectB.addEventListener('change', () => handleComparisonSubstanceChange('B'));

    // Comparison mode - Playback controls
    playAButton.addEventListener('click', () => handleComparisonPlay('A'));
    playBButton.addEventListener('click', () => handleComparisonPlay('B'));
    playBothSeqButton.addEventListener('click', handleComparisonPlaySequential);
    playBothSimButton.addEventListener('click', handleComparisonPlaySimultaneous);
    if (playBlendButton) {
        playBlendButton.addEventListener('click', handlePlayBlend);
    }

    // Blend controls
    if (blendRatioSlider) {
        blendRatioSlider.addEventListener('input', (e) => {
            blendRatio = parseInt(e.target.value) / 100;
            blendRatioValue.textContent = e.target.value;
        });
    }

    // Comparison mode - Duration slider
    comparisonDurationSlider.addEventListener('input', (e) => {
        comparisonDurationValue.textContent = parseFloat(e.target.value).toFixed(1);
    });

    // MIDI controls
    const refreshMIDIButton = document.getElementById('refresh-midi-devices');
    if (refreshMIDIButton) {
        refreshMIDIButton.addEventListener('click', refreshMIDIDevices);
    }

    const midiDeviceSelect = document.getElementById('midi-device-select');
    if (midiDeviceSelect) {
        midiDeviceSelect.addEventListener('change', (e) => {
            if (midiOutput && e.target.value) {
                midiOutput.selectOutput(e.target.value);
                updateMIDISendButton();
            }
        });
    }

    const sendMIDIButton = document.getElementById('send-midi-notes');
    if (sendMIDIButton) {
        sendMIDIButton.addEventListener('click', handleSendMIDI);
    }

    const midiVelocitySlider = document.getElementById('midi-velocity');
    const midiVelocityValue = document.getElementById('midi-velocity-value');
    if (midiVelocitySlider) {
        midiVelocitySlider.addEventListener('input', (e) => {
            const velocity = parseInt(e.target.value);
            midiVelocityValue.textContent = velocity;
            if (midiOutput) {
                midiOutput.setVelocity(velocity);
            }
        });
    }

    const midiNoteDurationSlider = document.getElementById('midi-note-duration');
    const midiNoteDurationValue = document.getElementById('midi-note-duration-value');
    if (midiNoteDurationSlider) {
        midiNoteDurationSlider.addEventListener('input', (e) => {
            const duration = parseInt(e.target.value);
            midiNoteDurationValue.textContent = duration;
            if (midiOutput) {
                midiOutput.setNoteDuration(duration);
            }
        });
    }

    const exportMIDIButton = document.getElementById('export-midi-file');
    if (exportMIDIButton) {
        exportMIDIButton.addEventListener('click', handleExportMIDIFile);
    }

    const midiTempoSlider = document.getElementById('midi-tempo');
    const midiTempoValue = document.getElementById('midi-tempo-value');
    if (midiTempoSlider) {
        midiTempoSlider.addEventListener('input', (e) => {
            midiTempoValue.textContent = e.target.value;
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcut);

    // Favorites toggle
    const showFavoritesCheckbox = document.getElementById('show-favorites');
    if (showFavoritesCheckbox) {
        showFavoritesCheckbox.addEventListener('change', handleFavoritesFilterChange);
    }

    // Favorite button
    const favoriteToggleButton = document.getElementById('favorite-toggle');
    if (favoriteToggleButton) {
        favoriteToggleButton.addEventListener('click', handleFavoriteToggle);
    }
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleKeyboardShortcut(e) {
    // Don't trigger shortcuts when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    // Show keyboard shortcuts help
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        showShortcutsOverlay();
        return;
    }

    // Prevent default for shortcuts we handle
    const handledKeys = [' ', 'ArrowUp', 'ArrowDown', 'Escape', 'a', 'c'];
    if (handledKeys.includes(e.key)) {
        e.preventDefault();
    }

    // Single mode shortcuts
    if (!comparisonMode) {
        switch (e.key) {
            case ' ': // Spacebar - Play/Stop
                if (!playButton.disabled) {
                    if (audioEngine.getIsPlaying()) {
                        handleStop();
                    } else {
                        handlePlay();
                    }
                }
                break;

            case 'ArrowUp': // Navigate to previous substance
                navigateSubstance(-1);
                break;

            case 'ArrowDown': // Navigate to next substance
                navigateSubstance(1);
                break;

            case 'a': // Select all peaks
                if (!selectAllButton.disabled) {
                    handleSelectAll();
                }
                break;

            case 'c': // Clear selection
                if (!clearSelectionButton.disabled) {
                    handleClearSelection();
                }
                break;

            case 'Escape': // Clear search/filters
                searchInput.value = '';
                categorySelect.value = 'all';
                handleSearch();
                break;
        }
    }
}

/**
 * Navigate to next/previous substance
 * @param {number} direction - -1 for previous, 1 for next
 */
function navigateSubstance(direction) {
    const options = Array.from(substanceSelect.options);
    const currentIndex = options.findIndex(opt => opt.value === substanceSelect.value);

    // Find next valid option (skip the first placeholder option)
    let newIndex = currentIndex + direction;
    if (newIndex < 1) newIndex = options.length - 1;
    if (newIndex >= options.length) newIndex = 1;

    if (newIndex >= 1 && newIndex < options.length) {
        substanceSelect.value = options[newIndex].value;
        handleSubstanceChange();
    }
}

/**
 * Handle search input with debouncing
 * 
 * Debounces search to avoid excessive filtering during typing.
 */
function handleSearch() {
    // Clear existing timer
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }
    
    // Set new timer
    searchDebounceTimer = setTimeout(() => {
        currentSearchTerm = searchInput.value.trim();
        populateSubstanceSelector();

        // Clear current selection if it's no longer in filtered results
        if (substanceSelect.value) {
            const filteredData = getFilteredLibrary();
            const stillExists = filteredData.some(item => item.id === substanceSelect.value);
            if (!stillExists) {
                substanceSelect.value = '';
                handleSubstanceChange();
            }
        }
    }, CONFIG.ui.DEBOUNCE_DELAY);
}

/**
 * Handle category filter change
 */
function handleCategoryChange() {
    currentCategory = categorySelect.value;
    populateSubstanceSelector();

    // Clear current selection if it's no longer in filtered results
    if (substanceSelect.value) {
        const filteredData = getFilteredLibrary();
        const stillExists = filteredData.some(item => item.id === substanceSelect.value);
        if (!stillExists) {
            substanceSelect.value = '';
            handleSubstanceChange();
        }
    }
}

/**
 * Handle substance selection change
 */
function handleSubstanceChange() {
    const substanceId = substanceSelect.value;

    if (!substanceId) {
        // Clear everything
        currentSpectrum = null;
        currentPeaks = null;
        visualizer.clear();
        visualizer.clearSelection();
        playButton.disabled = true;
        stopButton.disabled = true;
        selectAllButton.disabled = true;
        clearSelectionButton.disabled = true;
        playSelectedButton.disabled = true;
        const exportWAV = document.getElementById('export-wav');
        if (exportWAV) {
            exportWAV.disabled = true;
        }
        selectionCount.textContent = 'Click peaks on the FTIR spectrum to select them';
        const defaultMessage = '<p>Select a substance to see how infrared frequencies map to audio frequencies.</p>';
        mappingInfo.innerHTML = defaultMessage;
        if (mappingInfoModal) {
            mappingInfoModal.innerHTML = defaultMessage;
        }
        return;
    }

    // Find spectrum in library
    const data = libraryData.find(item => item.id === substanceId);
    if (!data) {
        console.error('Spectrum not found:', substanceId);
        return;
    }

    currentSpectrum = data.spectrum;

    // Extract peaks for sonification
    currentPeaks = frequencyMapper.extractPeaks(currentSpectrum);

    console.log(`Loaded ${data.name}:`, currentPeaks.length, 'peaks detected');

    // Clear any previous selection
    visualizer.clearSelection();

    // Update visualizations
    visualizer.drawFTIRSpectrum(currentSpectrum, currentPeaks);

    // Update mapping info with annotations
    updateMappingInfo(data, currentPeaks);

    // Enable playback and selection controls
    playButton.disabled = false;
    stopButton.disabled = false;
    selectAllButton.disabled = false;
    clearSelectionButton.disabled = false;

    // Enable export buttons
    const exportWAV = document.getElementById('export-wav');
    const exportMP3 = document.getElementById('export-mp3');
    if (exportWAV) {
        exportWAV.disabled = false;
    }
    if (exportMP3) {
        exportMP3.disabled = false;
    }

    // Update MIDI send button
    updateMIDISendButton();

    // Update favorite button
    const favoriteButton = document.getElementById('favorite-toggle');
    if (favoriteButton) {
        favoriteButton.style.display = 'inline-block';
        const isFavorite = Favorites.isFavorite(data.name);
        updateFavoriteButton(isFavorite);
    }

    // Show smart suggestions
    showSmartSuggestions(data);
}

/**
 * Update mapping information display
 */
function updateMappingInfo(data, peaks) {
    if (!peaks || peaks.length === 0) {
        const noPeaksMessage = '<p>No significant peaks detected.</p>';
        mappingInfo.innerHTML = noPeaksMessage;
        if (mappingInfoModal) {
            mappingInfoModal.innerHTML = noPeaksMessage;
        }
        return;
    }

    let html = `<p><strong>${data.name}</strong></p>`;
    html += `<p>${data.description}</p>`;
    html += `<p>Detected ${peaks.length} significant absorption peaks:</p>`;
    html += '<table style="width: 100%; margin-top: 10px; font-size: 0.9em;">';
    html += '<tr style="border-bottom: 1px solid #444;">';
    html += '<th style="text-align: left; padding: 5px;">IR (cm⁻¹)</th>';
    html += '<th style="text-align: left; padding: 5px;">Audio (Hz)</th>';
    html += '<th style="text-align: left; padding: 5px;">Intensity</th>';
    html += '<th style="text-align: left; padding: 5px;">Functional Group</th>';
    html += '</tr>';

    peaks.slice(0, 10).forEach(peak => {
        const wavenumberStr = peak.wavenumber.toFixed(0);
        const audioFreqStr = peak.audioFreq.toFixed(1);
        const intensityPercent = (peak.absorbance * 100).toFixed(0);
        const functionalGroup = frequencyMapper.getFunctionalGroup(peak.wavenumber);

        html += '<tr style="border-bottom: 1px solid #333;">';
        html += `<td style="padding: 5px;">${wavenumberStr}</td>`;
        html += `<td style="padding: 5px;">${audioFreqStr}</td>`;
        html += `<td style="padding: 5px;">${intensityPercent}%</td>`;
        html += `<td style="padding: 5px; color: #a78bfa;">${functionalGroup}</td>`;
        html += '</tr>';
    });

    html += '</table>';

    if (peaks.length > 10) {
        html += `<p style="margin-top: 10px; font-size: 0.9em; color: #888;">... and ${peaks.length - 10} more peaks</p>`;
    }

    html += `<p style="margin-top: 15px; font-size: 0.9em;">`;
    html += `Mapping: ${frequencyMapper.IR_MIN}-${frequencyMapper.IR_MAX} cm⁻¹ → `;
    html += `${frequencyMapper.AUDIO_MIN}-${frequencyMapper.AUDIO_MAX} Hz (logarithmic scale)`;
    html += `</p>`;

    mappingInfo.innerHTML = html;
    if (mappingInfoModal) {
        mappingInfoModal.innerHTML = html;
    }
}

/**
 * Handle play button click
 *
 * Plays audio synthesized from the current FTIR spectrum peaks.
 * Automatically uses selected peaks if any exist, otherwise uses all peaks.
 * Disables controls during playback to prevent concurrent play operations.
 */
async function handlePlay() {
    if (!currentPeaks || currentPeaks.length === 0) {
        console.warn('No peaks to play');
        Toast.warning('No peaks detected for this substance');
        return;
    }

    // Use selected peaks if any exist, otherwise use all peaks
    const selectedPeaks = visualizer.getSelectedPeaks();
    const peaksToPlay = (selectedPeaks && selectedPeaks.length > 0) ? selectedPeaks : currentPeaks;

    const duration = parseFloat(durationSlider.value);

    if (isNaN(duration) || duration <= 0) {
        console.error('Invalid duration:', duration);
        ErrorHandler.handle(
            new Error('Invalid duration'),
            'Invalid duration value. Please refresh the page.'
        );
        return;
    }

    try {
        // Disable play button during playback
        playButton.disabled = true;

        // Add pulse effect to play button
        MicroInteractions.pulse(playButton, duration * 1000);

        // Ensure audio context is active (especially for iOS)
        await iOSAudioHelper.ensureAudioContext(audioEngine);

        // Start audio with selected or all peaks
        await audioEngine.play(peaksToPlay, duration);

        // Start visualization animation
        visualizer.startAudioAnimation();

        // Announce to screen reader
        const substanceName = substanceSelect.options[substanceSelect.selectedIndex].text;
        const peakCountMsg = (selectedPeaks && selectedPeaks.length > 0) ?
            `${selectedPeaks.length} selected peaks` : `${currentPeaks.length} peaks`;
        ScreenReader.announce(
            `Playing ${substanceName}, ${peakCountMsg}, duration ${duration} seconds`
        );

        console.log(`Playing ${peaksToPlay.length} frequencies${(selectedPeaks && selectedPeaks.length > 0) ? ' (selected)' : ''} for ${duration}s`);

        // Re-enable play button after duration
        setTimeout(() => {
            playButton.disabled = false;
            visualizer.stopAudioAnimation();
            ScreenReader.announce('Playback finished');
        }, duration * 1000 + 100);

    } catch (error) {
        playButton.disabled = false;
        visualizer.stopAudioAnimation();

        ErrorHandler.handle(
            error,
            `Error playing audio: ${error.message || 'Unknown error'}. Please try again or refresh the page.`
        );
    }
}

/**
 * Handle stop button click
 */
function handleStop() {
    audioEngine.stop();
    visualizer.stopAudioAnimation();
    playButton.disabled = false;
    playSelectedButton.disabled = visualizer.getSelectedPeaks().length === 0;

    ScreenReader.announce('Playback stopped');
    console.log('Playback stopped');
}

/**
 * Handle peak selection change
 * Updates the selection status display and clear button visibility.
 * The main Play button automatically respects the selection.
 * @param {Array} selectedPeaks - Currently selected peaks
 */
function handlePeakSelectionChange(selectedPeaks) {
    const count = selectedPeaks.length;
    const clearBtn = clearSelectionButton;

    if (count === 0) {
        selectionCount.textContent = 'Click peaks to select specific frequencies';
        if (clearBtn) clearBtn.classList.add('hidden');
    } else {
        selectionCount.textContent = `${count} peak${count !== 1 ? 's' : ''} selected`;
        if (clearBtn) clearBtn.classList.remove('hidden');
    }

    console.log(`Peak selection changed: ${count} peaks selected`);
}

/**
 * Handle clear selection button
 * Clears all selected peaks and returns to playing all peaks.
 */
function handleClearSelection() {
    visualizer.clearSelection();
}

/**
 * Switch between single and comparison mode
 * 
 * @param {boolean} isComparison - True for comparison mode, false for single mode
 */
function switchMode(isComparison) {
    comparisonMode = isComparison;

    if (isComparison) {
        // Switch to comparison mode
        singleModeButton.classList.remove('active');
        comparisonModeButton.classList.add('active');
        
        // Update ARIA attributes for accessibility
        singleModeButton.setAttribute('aria-pressed', 'false');
        comparisonModeButton.setAttribute('aria-pressed', 'true');

        singleControls.style.display = 'none';
        document.querySelector('.single-visualization').style.display = 'none';

        comparisonControls.style.display = 'block';
        comparisonVisualization.style.display = 'block';

        console.log('Switched to comparison mode');
    } else {
        // Switch to single mode
        comparisonModeButton.classList.remove('active');
        singleModeButton.classList.add('active');
        
        // Update ARIA attributes for accessibility
        comparisonModeButton.setAttribute('aria-pressed', 'false');
        singleModeButton.setAttribute('aria-pressed', 'true');

        comparisonControls.style.display = 'none';
        comparisonVisualization.style.display = 'none';

        singleControls.style.display = 'block';
        document.querySelector('.single-visualization').style.display = 'grid';

        console.log('Switched to single mode');
    }
}

/**
 * Handle comparison mode substance selection
 * @param {string} side - 'A' or 'B'
 */
function handleComparisonSubstanceChange(side) {
    const select = side === 'A' ? substanceSelectA : substanceSelectB;
    const substanceId = select.value;
    const substance = side === 'A' ? substanceA : substanceB;
    const visualizer = side === 'A' ? visualizerA : visualizerB;
    const playButton = side === 'A' ? playAButton : playBButton;

    if (!substanceId) {
        substance.spectrum = null;
        substance.peaks = null;
        substance.data = null;
        visualizer.clear();
        playButton.disabled = true;
        updateComparisonButtons();
        return;
    }

    // Find spectrum in library
    const data = libraryData.find(item => item.id === substanceId);
    if (!data) {
        console.error('Spectrum not found:', substanceId);
        return;
    }

    // Store data
    substance.spectrum = data.spectrum;
    substance.peaks = frequencyMapper.extractPeaks(data.spectrum);
    substance.data = data;

    // Update visualization
    visualizer.drawFTIRSpectrum(substance.spectrum, substance.peaks);

    // Enable play button
    playButton.disabled = false;

    // Update combined play buttons
    updateComparisonButtons();

    console.log(`Loaded substance ${side}: ${data.name}`);
}

/**
 * Update comparison combined play buttons
 */
function updateComparisonButtons() {
    const bothLoaded = substanceA.peaks && substanceB.peaks;
    playBothSeqButton.disabled = !bothLoaded;
    playBothSimButton.disabled = !bothLoaded;
    
    if (playBlendButton) {
        playBlendButton.disabled = !bothLoaded;
    }
    
    // Show/hide blend controls
    if (blendControls) {
        blendControls.style.display = bothLoaded ? 'block' : 'none';
    }
}

/**
 * Handle comparison mode play individual substance
 * @param {string} side - 'A' or 'B'
 */
async function handleComparisonPlay(side) {
    const substance = side === 'A' ? substanceA : substanceB;
    const button = side === 'A' ? playAButton : playBButton;

    if (!substance.peaks || substance.peaks.length === 0) {
        console.warn(`No peaks to play for substance ${side}`);
        return;
    }

    const duration = parseFloat(comparisonDurationSlider.value);

    try {
        button.disabled = true;

        await audioEngine.play(substance.peaks, duration);

        console.log(`Playing substance ${side}: ${substance.data.name}`);

        setTimeout(() => {
            button.disabled = false;
        }, duration * 1000 + 100);

    } catch (error) {
        button.disabled = false;
        ErrorHandler.handle(error, 'Error playing audio. Please try again.');
    }
}

/**
 * Handle comparison play both substances sequentially
 */
async function handleComparisonPlaySequential() {
    if (!substanceA.peaks || !substanceB.peaks) {
        console.warn('Both substances must be loaded');
        return;
    }

    const duration = parseFloat(comparisonDurationSlider.value);

    try {
        playBothSeqButton.disabled = true;
        playBothSimButton.disabled = true;

        // Play A
        await audioEngine.play(substanceA.peaks, duration);
        console.log(`Playing A: ${substanceA.data.name}`);

        // Wait for A to finish
        await new Promise(resolve => setTimeout(resolve, duration * 1000));

        // Play B
        await audioEngine.play(substanceB.peaks, duration);
        console.log(`Playing B: ${substanceB.data.name}`);

        // Wait for B to finish
        setTimeout(() => {
            playBothSeqButton.disabled = false;
            playBothSimButton.disabled = false;
        }, duration * 1000 + 100);

    } catch (error) {
        playBothSeqButton.disabled = false;
        playBothSimButton.disabled = false;
        ErrorHandler.handle(error, 'Error playing audio. Please try again.');
    }
}

/**
 * Handle comparison play both substances simultaneously
 */
async function handleComparisonPlaySimultaneous() {
    if (!substanceA.peaks || !substanceB.peaks) {
        console.warn('Both substances must be loaded');
        return;
    }

    const duration = parseFloat(comparisonDurationSlider.value);

    try {
        playBothSeqButton.disabled = true;
        playBothSimButton.disabled = true;

        // Combine peaks from both substances
        const combinedPeaks = [...substanceA.peaks, ...substanceB.peaks];

        await audioEngine.play(combinedPeaks, duration);

        console.log(`Playing A + B simultaneously: ${substanceA.data.name} + ${substanceB.data.name}`);

        setTimeout(() => {
            playBothSeqButton.disabled = false;
            playBothSimButton.disabled = false;
        }, duration * 1000 + 100);

    } catch (error) {
        playBothSeqButton.disabled = false;
        playBothSimButton.disabled = false;
        ErrorHandler.handle(error, 'Error playing audio. Please try again.');
    }
}

/**
 * Handle CSV import
 * @param {Event} e - File input change event
 */
async function handleCSVImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        LoadingOverlay.show(`Importing ${file.name}...`);

        const data = await CSVImporter.parseCSV(file);
        CSVImporter.validate(data);

        // Add to library
        libraryData.push(data);

        // Repopulate selectors
        populateSubstanceSelector();
        populateComparisonSelectors();

        // Auto-select the imported substance
        substanceSelect.value = libraryData.length - 1;
        handleSubstanceChange();

        // Enable export button
        const exportWAV = document.getElementById('export-wav');
        if (exportWAV) {
            exportWAV.disabled = false;
        }

        LoadingOverlay.hide();
        Toast.success(`Successfully imported: ${data.name} (${data.metadata.finalPoints} data points)`);
    } catch (error) {
        LoadingOverlay.hide();
        ErrorHandler.handle(
            error,
            `Failed to import CSV: ${error.message}\n\nPlease ensure your CSV has two columns:\nwavenumber,transmittance\n\nDownload the template for an example.`
        );
    }

    // Clear the file input so the same file can be imported again
    e.target.value = '';
}

/**
 * Handle WAV export
 */
async function handleExportWAV() {
    if (!currentPeaks || currentPeaks.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    const duration = parseFloat(durationSlider.value);
    const substanceName = substanceSelect.options[substanceSelect.selectedIndex].text;
    const filename = `${substanceName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${duration}s.wav`;

    try {
        const exportButton = document.getElementById('export-wav');
        exportButton.disabled = true;
        exportButton.textContent = '⏳ Exporting...';

        LoadingOverlay.show(`Rendering audio: ${filename}`);

        await audioEngine.exportWAV(currentPeaks, duration, filename);

        LoadingOverlay.hide();
        exportButton.disabled = false;
        exportButton.textContent = '💾 Export WAV';

        MicroInteractions.celebrate(`First export! Successfully exported: ${filename}`);
    } catch (error) {
        LoadingOverlay.hide();
        const exportButton = document.getElementById('export-wav');
        exportButton.disabled = false;
        exportButton.textContent = '💾 Export WAV';

        ErrorHandler.handle(error, `Failed to export audio: ${error.message}`);
    }
}

/**
 * Handle JCAMP-DX import
 * @param {Event} e - File input change event
 */
async function handleJCAMPImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        LoadingOverlay.show(`Importing JCAMP-DX: ${file.name}...`);

        const data = await JCAMPImporter.parseJCAMP(file);
        JCAMPImporter.validate(data);

        // Add to library
        data.id = libraryData.length.toString();
        libraryData.push(data);

        // Repopulate selectors
        populateSubstanceSelector();
        populateComparisonSelectors();

        // Auto-select the imported substance
        substanceSelect.value = data.id;
        handleSubstanceChange();

        // Enable export buttons
        const exportWAV = document.getElementById('export-wav');
        const exportMP3 = document.getElementById('export-mp3');
        if (exportWAV) exportWAV.disabled = false;
        if (exportMP3) exportMP3.disabled = false;

        LoadingOverlay.hide();
        Toast.success(`Successfully imported JCAMP-DX: ${data.name} (${data.metadata.finalPoints} data points)`);
    } catch (error) {
        LoadingOverlay.hide();
        ErrorHandler.handle(
            error,
            `Failed to import JCAMP-DX: ${error.message}\n\nPlease ensure your file is a valid JCAMP-DX format (.jdx, .dx, or .jcamp).`
        );
    }

    // Clear the file input
    e.target.value = '';
}

/**
 * Handle MP3 export
 */
async function handleExportMP3() {
    if (!currentPeaks || currentPeaks.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    // Check if lamejs is loaded
    if (typeof lamejs === 'undefined') {
        Toast.error('MP3 export requires the lamejs library. Please ensure the library is loaded.', 5000);
        return;
    }

    const duration = parseFloat(durationSlider.value);
    const substanceName = substanceSelect.options[substanceSelect.selectedIndex].text;
    const filename = `${substanceName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${duration}s.mp3`;

    try {
        const exportButton = document.getElementById('export-mp3');
        exportButton.disabled = true;
        exportButton.textContent = '⏳ Encoding MP3...';

        LoadingOverlay.show(`Encoding MP3: ${filename}`);

        await audioEngine.exportMP3(currentPeaks, duration, filename, 128);

        LoadingOverlay.hide();
        exportButton.disabled = false;
        exportButton.textContent = '🎵 Export MP3';

        MicroInteractions.celebrate(`First MP3 export! Successfully exported: ${filename}`);
    } catch (error) {
        LoadingOverlay.hide();
        const exportButton = document.getElementById('export-mp3');
        exportButton.disabled = false;
        exportButton.textContent = '🎵 Export MP3';

        ErrorHandler.handle(error, `Failed to export MP3: ${error.message}`);
    }
}

/**
 * Handle play blend button (spectral blending)
 */
async function handlePlayBlend() {
    if (!substanceA.peaks || !substanceB.peaks) {
        Toast.warning('Please select both substances first');
        return;
    }

    const duration = parseFloat(comparisonDurationSlider.value);

    try {
        playBlendButton.disabled = true;
        playBothSeqButton.disabled = true;
        playBothSimButton.disabled = true;

        // Blend the peaks based on ratio
        const blendedPeaks = audioEngine.blendPeaks(substanceA.peaks, substanceB.peaks, blendRatio);

        await audioEngine.play(blendedPeaks, duration);

        const percentA = Math.round((1 - blendRatio) * 100);
        const percentB = Math.round(blendRatio * 100);
        console.log(`Playing blended spectrum: ${percentA}% ${substanceA.data.name} + ${percentB}% ${substanceB.data.name}`);

        setTimeout(() => {
            playBlendButton.disabled = false;
            playBothSeqButton.disabled = false;
            playBothSimButton.disabled = false;
        }, duration * 1000 + 100);

    } catch (error) {
        playBlendButton.disabled = false;
        playBothSeqButton.disabled = false;
        playBothSimButton.disabled = false;
        ErrorHandler.handle(error, 'Error playing blended audio. Please try again.');
    }
}

/**
 * Refresh MIDI device list
 */
async function refreshMIDIDevices() {
    const midiDeviceSelect = document.getElementById('midi-device-select');
    if (!midiDeviceSelect) return;

    if (!midiOutput || !midiOutput.isSupported()) {
        Toast.warning('Web MIDI API is not supported in your browser', 4000);
        return;
    }

    try {
        // Re-initialize MIDI to refresh device list
        if (!midiOutput.midiAccess) {
            await midiOutput.init();
        }

        const devices = midiOutput.getOutputDevices();
        
        midiDeviceSelect.innerHTML = '';
        
        if (devices.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '-- No MIDI devices found --';
            midiDeviceSelect.appendChild(option);
            Toast.info('No MIDI output devices found. Connect a MIDI device and refresh.', 3000);
        } else {
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = '-- Select MIDI Device --';
            midiDeviceSelect.appendChild(placeholderOption);

            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.id;
                option.textContent = `${device.name} (${device.manufacturer})`;
                midiDeviceSelect.appendChild(option);
            });

            Toast.success(`Found ${devices.length} MIDI device(s)`, 2000);
        }
    } catch (error) {
        ErrorHandler.handle(error, `Failed to access MIDI devices: ${error.message}`);
    }
}

/**
 * Update MIDI send button state
 */
function updateMIDISendButton() {
    const sendButton = document.getElementById('send-midi-notes');
    const exportButton = document.getElementById('export-midi-file');
    
    if (sendButton) {
        sendButton.disabled = !currentPeaks || currentPeaks.length === 0 || !midiOutput || !midiOutput.hasSelectedDevice();
    }
    
    // MIDI file export doesn't require a device
    if (exportButton) {
        exportButton.disabled = !currentPeaks || currentPeaks.length === 0 || !midiOutput;
    }
}

/**
 * Handle send MIDI notes
 */
async function handleSendMIDI() {
    if (!midiOutput || !midiOutput.hasSelectedDevice()) {
        Toast.warning('Please select a MIDI output device first');
        return;
    }

    if (!currentPeaks || currentPeaks.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    try {
        const sendButton = document.getElementById('send-midi-notes');
        sendButton.disabled = true;

        // Send peaks as chord (all notes simultaneously)
        await midiOutput.sendPeaks(currentPeaks, 'chord');

        Toast.success(`Sent ${currentPeaks.length} MIDI notes to device`, 2000);

        setTimeout(() => {
            sendButton.disabled = false;
        }, midiOutput.noteDuration + 100);

    } catch (error) {
        const sendButton = document.getElementById('send-midi-notes');
        sendButton.disabled = false;
        ErrorHandler.handle(error, `Failed to send MIDI notes: ${error.message}`);
    }
}

/**
 * Handle export MIDI file
 */
async function handleExportMIDIFile() {
    if (!currentPeaks || currentPeaks.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    if (!midiOutput) {
        Toast.error('MIDI output not available');
        return;
    }

    try {
        const exportButton = document.getElementById('export-midi-file');
        const tempoSlider = document.getElementById('midi-tempo');
        
        exportButton.disabled = true;
        exportButton.textContent = '⏳ Exporting...';

        // Use the global playback mode from audio engine
        const mode = audioEngine.getPlaybackMode();
        const tempo = tempoSlider ? parseInt(tempoSlider.value) : 120;
        const substanceName = substanceSelect.options[substanceSelect.selectedIndex].text;
        const filename = `${substanceName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${mode}.mid`;

        midiOutput.exportMIDIFile(currentPeaks, mode, tempo, filename);

        exportButton.disabled = false;
        exportButton.textContent = '💾 Export MIDI File';

        Toast.success(`Exported MIDI file: ${filename}`, 3000);
        MicroInteractions.celebrate(`First MIDI export! Successfully exported: ${filename}`);
    } catch (error) {
        const exportButton = document.getElementById('export-midi-file');
        exportButton.disabled = false;
        exportButton.textContent = '💾 Export MIDI File';

        ErrorHandler.handle(error, `Failed to export MIDI file: ${error.message}`);
    }
}

/**
 * Set up onboarding modal
 */
function setupOnboarding() {
    const onboardingModal = document.getElementById('onboarding-modal');
    const closeButton = document.getElementById('onboarding-close');
    const startTourButton = document.getElementById('start-tour');
    const skipTourButton = document.getElementById('skip-tour');
    const dontShowCheckbox = document.getElementById('dont-show-again');

    // Close modal handlers
    const closeModal = () => {
        if (dontShowCheckbox.checked) {
            localStorage.setItem('onboarding-completed', 'true');
        }
        onboardingModal.style.display = 'none';
    };

    closeButton.addEventListener('click', closeModal);
    skipTourButton.addEventListener('click', closeModal);

    // Close on overlay click
    onboardingModal.addEventListener('click', (e) => {
        if (e.target === onboardingModal) {
            closeModal();
        }
    });

    // Start tour button
    startTourButton.addEventListener('click', () => {
        closeModal();
        startGuidedTour();
    });

    // Suggestion pill handlers
    const suggestionPills = document.querySelectorAll('.suggestion-pill');
    suggestionPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const substanceId = pill.getAttribute('data-substance-id');
            closeModal();
            selectSubstanceByName(substanceId);
        });
    });
}

/**
 * Set up menu modals (Settings, Import/Export, MIDI, Help)
 */
function setupMenuModals() {
    // Settings Modal
    const settingsModal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-menu-btn');
    const settingsClose = document.getElementById('settings-close');
    const settingsOk = document.getElementById('settings-ok');

    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.remove('hidden');
            settingsModal.style.display = 'flex';
        });

        const closeSettings = () => {
            settingsModal.classList.add('hidden');
            settingsModal.style.display = 'none';
        };

        if (settingsClose) settingsClose.addEventListener('click', closeSettings);
        if (settingsOk) settingsOk.addEventListener('click', closeSettings);

        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeSettings();
        });
    }

    // Import/Export Modal
    const importExportModal = document.getElementById('import-export-modal');
    const importExportBtn = document.getElementById('import-export-menu-btn');
    const importExportClose = document.getElementById('import-export-close');
    const importExportOk = document.getElementById('import-export-ok');

    if (importExportBtn && importExportModal) {
        importExportBtn.addEventListener('click', () => {
            importExportModal.classList.remove('hidden');
            importExportModal.style.display = 'flex';
        });

        const closeImportExport = () => {
            importExportModal.classList.add('hidden');
            importExportModal.style.display = 'none';
        };

        if (importExportClose) importExportClose.addEventListener('click', closeImportExport);
        if (importExportOk) importExportOk.addEventListener('click', closeImportExport);

        importExportModal.addEventListener('click', (e) => {
            if (e.target === importExportModal) closeImportExport();
        });
    }

    // MIDI Modal
    const midiModal = document.getElementById('midi-modal');
    const midiBtn = document.getElementById('midi-menu-btn');
    const midiClose = document.getElementById('midi-close');
    const midiOk = document.getElementById('midi-ok');

    if (midiBtn && midiModal) {
        midiBtn.addEventListener('click', () => {
            midiModal.classList.remove('hidden');
            midiModal.style.display = 'flex';
        });

        const closeMidi = () => {
            midiModal.classList.add('hidden');
            midiModal.style.display = 'none';
        };

        if (midiClose) midiClose.addEventListener('click', closeMidi);
        if (midiOk) midiOk.addEventListener('click', closeMidi);

        midiModal.addEventListener('click', (e) => {
            if (e.target === midiModal) closeMidi();
        });
    }

    // Help Modal
    const helpModal = document.getElementById('help-modal');
    const helpBtn = document.getElementById('help-menu-btn');
    const helpClose = document.getElementById('help-close');
    const helpOk = document.getElementById('help-ok');
    const restartTutorial = document.getElementById('restart-tutorial');

    if (helpBtn && helpModal) {
        helpBtn.addEventListener('click', () => {
            helpModal.classList.remove('hidden');
            helpModal.style.display = 'flex';
        });

        const closeHelp = () => {
            helpModal.classList.add('hidden');
            helpModal.style.display = 'none';
        };

        if (helpClose) helpClose.addEventListener('click', closeHelp);
        if (helpOk) helpOk.addEventListener('click', closeHelp);

        if (restartTutorial) {
            restartTutorial.addEventListener('click', () => {
                closeHelp();
                startGuidedTour();
            });
        }

        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) closeHelp();
        });
    }
}

/**
 * Check if we should show onboarding
 */
function checkAndShowOnboarding() {
    const hasSeenOnboarding = localStorage.getItem('onboarding-completed');
    if (!hasSeenOnboarding) {
        setTimeout(() => {
            const onboardingModal = document.getElementById('onboarding-modal');
            onboardingModal.style.display = 'flex';
        }, 500);
    }
}

/**
 * Select substance by name (partial match)
 * @param {string} searchTerm - Substance name to search for
 */
function selectSubstanceByName(searchTerm) {
    if (!libraryData) return;

    const substance = libraryData.find(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (substance) {
        substanceSelect.value = substance.id;
        handleSubstanceChange();
        // Scroll to substance selector
        substanceSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Start guided tour - shows path selection modal
 */
function startGuidedTour() {
    const modal = document.getElementById('tutorial-path-modal');
    if (!modal) {
        console.error('Tutorial path modal not found');
        return;
    }
    
    modal.style.display = 'flex';
    
    // Setup path selection handlers (only once)
    if (!modal.dataset.initialized) {
        const closeButton = document.getElementById('tutorial-path-close');
        const pathCards = modal.querySelectorAll('.tutorial-path-card');
        
        closeButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        pathCards.forEach(card => {
            card.addEventListener('click', () => {
                const path = card.getAttribute('data-path');
                modal.style.display = 'none';
                
                // Auto-select first substance for tour
                if (libraryData && libraryData.length > 0) {
                    selectSubstanceByName('mdma');
                }
                
                // Start tutorial with selected path
                setTimeout(() => {
                    TutorialManager.start(path);
                }, 500);
            });
        });
        
        modal.dataset.initialized = 'true';
    }
}

/**
 * Highlight an element during tour
 * @param {HTMLElement} element - Element to highlight
 */
function highlightElement(element) {
    removeTourHighlight();

    element.classList.add('tour-highlight');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add temporary CSS for highlight
    if (!document.getElementById('tour-styles')) {
        const style = document.createElement('style');
        style.id = 'tour-styles';
        style.textContent = `
            .tour-highlight {
                outline: 3px solid #ec4899 !important;
                outline-offset: 5px !important;
                box-shadow: 0 0 20px rgba(236, 72, 153, 0.6) !important;
                position: relative !important;
                z-index: 9999 !important;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Remove tour highlight
 */
function removeTourHighlight() {
    document.querySelectorAll('.tour-highlight').forEach(el => {
        el.classList.remove('tour-highlight');
    });
}

/**
 * Set up keyboard shortcuts overlay
 */
function setupShortcutsOverlay() {
    const shortcutsOverlay = document.getElementById('shortcuts-overlay');
    const closeButton = document.getElementById('shortcuts-close');
    const okButton = document.getElementById('shortcuts-ok');

    const closeModal = () => {
        shortcutsOverlay.style.display = 'none';
    };

    closeButton.addEventListener('click', closeModal);
    okButton.addEventListener('click', closeModal);

    // Close on overlay click
    shortcutsOverlay.addEventListener('click', (e) => {
        if (e.target === shortcutsOverlay) {
            closeModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && shortcutsOverlay.style.display === 'flex') {
            closeModal();
        }
    });
}

/**
 * Show keyboard shortcuts overlay
 */
function showShortcutsOverlay() {
    const shortcutsOverlay = document.getElementById('shortcuts-overlay');
    shortcutsOverlay.style.display = 'flex';
}

/**
 * Set up theme toggle
 */
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('.theme-icon');

    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    // Toggle theme on click
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);

        // Show toast notification
        Toast.info(`Switched to ${newTheme} theme`, 2000);
    });
}

/**
 * Set theme
 * @param {string} theme - 'light' or 'dark'
 */
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    // Update theme color meta tag
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', theme === 'dark' ? '#8b5cf6' : '#7c3aed');
    }
}

/**
 * Handle favorites filter change
 */
function handleFavoritesFilterChange() {
    populateSubstanceSelector();
}

/**
 * Handle favorite toggle button
 */
function handleFavoriteToggle() {
    const substanceId = substanceSelect.value;
    if (!substanceId) return;

    const substance = libraryData.find(item => item.id === substanceId);
    if (!substance) return;

    const isFavorite = Favorites.toggle(substance.name);
    updateFavoriteButton(isFavorite);
}

/**
 * Update favorite button state
 * @param {boolean} isFavorite - Whether substance is favorited
 */
function updateFavoriteButton(isFavorite) {
    const favoriteButton = document.getElementById('favorite-toggle');
    if (favoriteButton) {
        favoriteButton.textContent = isFavorite ? '★' : '☆';
        favoriteButton.classList.toggle('active', isFavorite);
    }
}

/**
 * Calculate spectral similarity using cosine similarity
 * @param {Array} spectrum1 - First spectrum data
 * @param {Array} spectrum2 - Second spectrum data
 * @returns {number} Similarity score (0-1)
 */
function calculateSpectralSimilarity(spectrum1, spectrum2) {
    // Convert spectra to fixed-length vectors for comparison
    const minWavenumber = 400;
    const maxWavenumber = 4000;
    const bins = 100;
    const binSize = (maxWavenumber - minWavenumber) / bins;

    const vector1 = new Array(bins).fill(0);
    const vector2 = new Array(bins).fill(0);

    // Bin spectrum1
    spectrum1.forEach(point => {
        const binIndex = Math.floor((point.wavenumber - minWavenumber) / binSize);
        if (binIndex >= 0 && binIndex < bins) {
            vector1[binIndex] += (100 - point.transmittance) / 100; // Convert to absorbance
        }
    });

    // Bin spectrum2
    spectrum2.forEach(point => {
        const binIndex = Math.floor((point.wavenumber - minWavenumber) / binSize);
        if (binIndex >= 0 && binIndex < bins) {
            vector2[binIndex] += (100 - point.transmittance) / 100;
        }
    });

    // Calculate cosine similarity
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < bins; i++) {
        dotProduct += vector1[i] * vector2[i];
        magnitude1 += vector1[i] * vector1[i];
        magnitude2 += vector2[i] * vector2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Show smart substance suggestions
 * @param {Object} currentSubstance - Currently selected substance
 */
function showSmartSuggestions(currentSubstance) {
    const suggestionsContainer = document.getElementById('smart-suggestions');
    const suggestionsList = document.getElementById('suggestions-list');

    if (!libraryData || libraryData.length < 2) {
        suggestionsContainer.style.display = 'none';
        return;
    }

    // Calculate similarity scores for all substances
    const similarities = libraryData
        .filter(item => item.id !== currentSubstance.id)
        .map(item => ({
            substance: item,
            similarity: calculateSpectralSimilarity(currentSubstance.spectrum, item.spectrum)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5); // Top 5 similar substances

    // Clear previous suggestions
    suggestionsList.innerHTML = '';

    // Add suggestion items
    similarities.forEach(({ substance, similarity }) => {
        const item = document.createElement('button');
        item.className = 'suggestion-item';
        item.innerHTML = `
            <span class="suggestion-name">${substance.name}</span>
            <span class="similarity-score">${(similarity * 100).toFixed(0)}% similar</span>
        `;
        item.addEventListener('click', () => {
            substanceSelect.value = substance.id;
            handleSubstanceChange();
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        suggestionsList.appendChild(item);
    });

    suggestionsContainer.style.display = 'block';
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for debugging
window.spectralSynth = {
    audioEngine,
    visualizer,
    visualizerA,
    visualizerB,
    frequencyMapper,
    getCurrentPeaks: () => currentPeaks,
    getCurrentSpectrum: () => currentSpectrum,
    getComparisonMode: () => comparisonMode,
    getSubstanceA: () => substanceA,
    getSubstanceB: () => substanceB
};
