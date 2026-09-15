/**
 * Spectral Synthesiser — application entry point
 *
 * Creates the long-lived instances (audio engine, visualiser, MIDI), loads
 * the FTIR library, and wires the UI modules together. Feature behaviour
 * lives in the modules under ui/, audio/, data/ and midi/.
 */

import { ctx } from './core/context.js';
import { CONFIG } from './core/config.js';
import { Logger } from './core/logger.js';
import { PerformanceMonitor } from './core/performance-monitor.js';
import { AudioEngine } from './audio/audio-engine.js';
import { FrequencyMapper } from './audio/frequency-mapper.js';
import { handlePlay, handleStop, handleSelectAll, handleClearSelection, handlePeakSelectionChange } from './audio/playback-controller.js';
import { SpectrumCodec } from './data/spectrum-codec.js';
import { LibraryLoader } from './data/library-loader.js';
import { MIDIOutput } from './midi/midi-output.js';
import { MIDIInput } from './midi/midi-input.js';
import { refreshMIDIDevices } from './midi/midi-handlers.js';
import { dom } from './ui/dom.js';
import { BrowserCompatibility, LoadingOverlay, Toast, ErrorHandler } from './ui/ui-utilities.js';
import { ResponsiveCanvas } from './ui/visualization-utilities.js';
import { Visualizer } from './ui/visualizer.js';
import { FilterManager } from './ui/filter-manager.js';
import { BrowseManager } from './ui/browse-manager.js';
import { KeyboardShortcuts } from './ui/keyboard-shortcuts.js';
import { ModalManager } from './ui/modal-manager.js';
import { setupEventListeners } from './ui/event-handlers.js';
import { setupMenuModals } from './ui/menu-modals.js';
import { setupThemeToggle } from './ui/theme-manager.js';
import { handleSubstanceChange, navigateSubstance, setupPeakAudition } from './ui/substance-selection.js';
import { setupOnboarding, checkAndShowQuickStart } from './ui/onboarding.js';
import './sw-register.js';

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
        // Initialize performance monitoring
        PerformanceMonitor.init();
        PerformanceMonitor.mark('init-start');

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
        ctx.audioEngine = new AudioEngine();
        ctx.frequencyMapper = new FrequencyMapper();

        // MIDI is optional — the browser may not support Web MIDI at all
        ctx.midiOutput = new MIDIOutput();
        ctx.midiInput = new MIDIInput({
            audioEngine: ctx.audioEngine,
            getPeaks: () => ctx.currentPeaks,
        });
        try {
            await ctx.midiOutput.init();
            await ctx.midiInput.init(ctx.midiOutput.midiAccess);
            refreshMIDIDevices();
        } catch (midiError) {
            Logger.info('MIDI not available:', midiError.message);
        }

        // Visualiser (FTIR spectrum + live FFT)
        ctx.visualizer = new Visualizer(dom.ftirCanvas, dom.audioCanvas);
        ctx.visualizer.setAudioEngine(ctx.audioEngine);
        ctx.visualizer.onPeakSelectionChange = handlePeakSelectionChange;
        ctx.visualizer.clear(); // draw the empty-state hints while the library loads

        // Initialize library loader
        ctx.libraryIndex = await LibraryLoader.init();

        // Load FTIR library (using lazy loading if available)
        await loadLibrary();

        // Preload popular categories in background (after initial render)
        setTimeout(() => {
            if (LibraryLoader.isLazyLoadingEnabled()) {
                LibraryLoader.preloadPopularCategories();
            }
        }, 2000);

        // Set up event listeners (FilterManager owns its own — wired in loadLibrary)
        setupEventListeners();
        setupPeakAudition();

        // Set up onboarding and keyboard shortcuts
        setupOnboarding();
        setupKeyboardShortcuts();
        setupMenuModals();

        // Set up theme toggle
        setupThemeToggle();

        // Check if MP3 export is available
        checkMP3ExportAvailability();

        LoadingOverlay.hide();
        Toast.success('Spectral Synthesizer ready! 🎵');
        Logger.log('🎵 Spectral Synthesizer initialized');

        PerformanceMonitor.mark('init-complete');
        PerformanceMonitor.measure('initialization-time', 'init-start', 'init-complete');

        // Show Quick Start panel or onboarding for first-time users
        checkAndShowQuickStart();
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
 * Uses lazy loading if available, otherwise falls back to monolithic file.
 *
 * @throws {Error} If library fails to load
 */
async function loadLibrary() {
    const startTime = window.performance.now();

    try {
        if (LibraryLoader.isLazyLoadingEnabled()) {
            // Lazy loading mode: initially load all categories to maintain compatibility
            // In the future, we can load only on-demand based on category selection
            LoadingOverlay.show('Loading FTIR library index...');
            Logger.log('Loading FTIR library with lazy loading...');

            ctx.libraryData = await LibraryLoader.loadAll();

            Logger.log(`✓ Loaded ${ctx.libraryData.length} spectra from ENFSI library (lazy loaded)`);

            PerformanceMonitor.trackLibraryLoad('lazy', 'all', startTime);
        } else {
            // Fallback to monolithic file
            LoadingOverlay.show('Loading FTIR library...');
            Logger.log('Loading FTIR library...');

            const response = await fetch(CONFIG.library.LIBRARY_FILE);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            ctx.libraryData = SpectrumCodec.decodeLibrary(await response.json());

            Logger.log(`✓ Loaded ${ctx.libraryData.length} spectra from ENFSI library`);

            PerformanceMonitor.trackLibraryLoad('monolithic', null, startTime);
        }

        // Hand the library off to FilterManager, which owns the selector + filter UI.
        FilterManager.init(ctx.libraryData, { onSelectionInvalid: handleSubstanceChange });

        // Visual library browser (sparkline grid)
        BrowseManager.init({
            getLibrary: () => ctx.libraryData,
            onSelect: (substance) => {
                dom.substanceSelect.value = substance.id;
                if (dom.substanceSelect.value !== substance.id) {
                    // Active filters hide this substance — clear them and retry
                    FilterManager.clearAll();
                    dom.substanceSelect.value = substance.id;
                }
                handleSubstanceChange();
            },
        });
    } catch (error) {
        ErrorHandler.handle(
            error,
            'Failed to load FTIR library. Please check your connection and refresh the page.'
        );
        throw error; // Re-throw to stop initialization
    }
}

/**
 * Check if MP3 export is available (requires lamejs library)
 * If not available, disable/hide the MP3 export button
 */
function checkMP3ExportAvailability() {
    const exportMP3 = document.getElementById('export-mp3');
    if (exportMP3) {
        if (typeof lamejs === 'undefined') {
            // Disable MP3 export if lamejs isn't loaded
            exportMP3.disabled = true;
            exportMP3.title = 'MP3 export requires lamejs library (not loaded). WAV export is available.';
            exportMP3.style.opacity = '0.5';
            Logger.info('⚠️ MP3 export disabled: lamejs library not loaded. Use WAV export instead.');
        } else {
            Logger.log('✓ MP3 export available');
        }
    }
}

/**
 * Set up keyboard shortcuts using the KeyboardShortcuts module
 */
function setupKeyboardShortcuts() {
    KeyboardShortcuts.init({
        onPlay: handlePlay,
        onStop: handleStop,
        onSelectAll: handleSelectAll,
        onClearSelection: handleClearSelection,
        onNavigate: navigateSubstance,
        onClearFilters: () => FilterManager.clearAll(),
        onHelp: () => ModalManager.open('help'),
        isBlocked: () => ModalManager.isAnyOpen(),
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for debugging in the console
window.spectralSynth = ctx;
