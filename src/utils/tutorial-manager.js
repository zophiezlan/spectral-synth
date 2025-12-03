/**
 * Tutorial Manager Module
 * 
 * Provides interactive tutorial/onboarding functionality
 */

// Utility: Interactive Tutorial Manager
export const TutorialManager = {
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
