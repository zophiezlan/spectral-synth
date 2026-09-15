/**
 * Event Handlers Module
 *
 * Purpose: Centralizes event listener setup for better organization
 *
 * Dependencies:
 * - DOM elements (from dom-elements.js)
 * - audioEngine (global)
 * - CONFIG (for default values)
 * - ErrorHandler (for error handling)
 * - Logger (for debugging)
 *
 * Exports:
 * - setupSubstanceListeners() - Substance selection and filtering
 * - setupPlaybackListeners() - Play/stop controls
 * - setupSliderListeners() - Volume, duration, reverb, filter sliders
 * - setupADSRListeners() - ADSR envelope controls
 * - setupEffectPresetListeners() - Audio effect preset dropdown
 * - setupPlaybackModeListeners() - Playback mode selection
 * - setupImportExportListeners() - File import/export handlers
 * - setupMIDIListeners() - MIDI device and output handlers
 * - setupFavoritesListeners() - Favorite toggle functionality
 * - setupEventListeners() - Master function that calls all above
 *
 * Usage:
 * Called once during app initialization to wire up all UI interactions.
 * Individual setup functions can be called separately if needed.
 *
 * Pattern:
 * Each function checks for element existence before adding listeners
 * to prevent errors when elements are not present in the DOM.
 */


import { ctx } from '../core/context.js';
import { CONFIG } from '../core/config.js';
import { Logger } from '../core/logger.js';
import { dom } from './dom.js';
import { Toast, ErrorHandler } from './ui-utilities.js';
import { CSVImporter } from '../data/csv-importer.js';
import { handlePlay, handleClearSelection, handleSelectAll } from '../audio/playback-controller.js';
import { handleCSVImport, handleJCAMPImport, handleExportWAV, handleExportMP3, handleExportPeaksCSV, handleExportPeaksJSON, handleExportSpectrumCSV } from './import-export-handlers.js';
import { refreshMIDIDevices, handleMIDIInputEnabled, handleSendMIDI, handleExportMIDIFile, updateMIDISendButton } from '../midi/midi-handlers.js';
import { handleSubstanceChange, handleFavoriteToggle } from './substance-selection.js';

/**
 * Setup substance selection listener.
 * Search input + category select are wired by FilterManager.
 */
function setupSubstanceListeners() {
    if (dom.substanceSelect) {
        dom.substanceSelect.addEventListener('change', handleSubstanceChange);
    }
}

/**
 * Setup playback control listeners
 */
function setupPlaybackListeners() {
    // Single mode playback
    if (dom.playButton) {
        dom.playButton.addEventListener('click', handlePlay);
    }

    // Peak selection - clear selection
    if (dom.clearSelectionButton) {
        dom.clearSelectionButton.addEventListener('click', handleClearSelection);
    }

    // Peak selection - select all
    if (dom.selectAllButton) {
        dom.selectAllButton.addEventListener('click', handleSelectAll);
    }
}

/**
 * Setup slider event listeners
 */
function setupSliderListeners() {
    // Duration slider
    if (dom.durationSlider && dom.durationValue) {
        dom.durationSlider.addEventListener('input', (e) => {
            dom.durationValue.textContent = parseFloat(e.target.value).toFixed(1);
        });
    }

    // Volume slider
    if (dom.volumeSlider && dom.volumeValue) {
        dom.volumeSlider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value) / 100;
            dom.volumeValue.textContent = e.target.value;
            ctx.audioEngine.setVolume(volume);

            // Visual feedback
            showSliderFeedback(dom.volumeSlider, dom.volumeValue);
        });
    }

    // Reverb slider
    if (dom.reverbSlider && dom.reverbValue) {
        dom.reverbSlider.addEventListener('input', (e) => {
            const reverb = parseInt(e.target.value) / 100;
            dom.reverbValue.textContent = e.target.value;
            ctx.audioEngine.setReverb(reverb);

            // Visual feedback
            showSliderFeedback(dom.reverbSlider, dom.reverbValue);
        });
    }

    // Filter frequency slider
    if (dom.filterFreqSlider && dom.filterFreqValue) {
        dom.filterFreqSlider.addEventListener('input', (e) => {
            const freq = parseInt(e.target.value);
            dom.filterFreqValue.textContent = freq;
            ctx.audioEngine.setFilterFrequency(freq);

            // Visual feedback
            showSliderFeedback(dom.filterFreqSlider, dom.filterFreqValue);
        });
    }

}

/**
 * Setup ADSR envelope control listeners
 */
function setupADSRListeners() {
    // Attack slider
    if (dom.attackSlider && dom.attackValue) {
        dom.attackSlider.addEventListener('input', (e) => {
            const timeMs = parseInt(e.target.value);
            const timeSec = timeMs / 1000;
            dom.attackValue.textContent = timeMs;
            ctx.audioEngine.setAttackTime(timeSec);
        });
    }

    // Decay slider
    if (dom.decaySlider && dom.decayValue) {
        dom.decaySlider.addEventListener('input', (e) => {
            const timeMs = parseInt(e.target.value);
            const timeSec = timeMs / 1000;
            dom.decayValue.textContent = timeMs;
            ctx.audioEngine.setDecayTime(timeSec);
        });
    }

    // Sustain slider
    if (dom.sustainSlider && dom.sustainValue) {
        dom.sustainSlider.addEventListener('input', (e) => {
            const level = parseInt(e.target.value) / 100;
            dom.sustainValue.textContent = e.target.value;
            ctx.audioEngine.setSustainLevel(level);
        });
    }

    // Release slider
    if (dom.releaseSlider && dom.releaseValue) {
        dom.releaseSlider.addEventListener('input', (e) => {
            const timeMs = parseInt(e.target.value);
            const timeSec = timeMs / 1000;
            dom.releaseValue.textContent = timeMs;
            ctx.audioEngine.setReleaseTime(timeSec);
        });
    }

    // ADSR curve selector
    if (dom.adsrCurveSelect) {
        // Populate ADSR curve options
        const curves = ctx.audioEngine.getADSRCurves();
        Object.keys(curves).forEach(key => {
            const curve = curves[key];
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${curve.name} - ${curve.description}`;
            dom.adsrCurveSelect.appendChild(option);
        });

        // Set default curve
        dom.adsrCurveSelect.value = CONFIG.adsr.DEFAULT_CURVE;

        dom.adsrCurveSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                try {
                    ctx.audioEngine.setADSRCurve(e.target.value);
                } catch (error) {
                    ErrorHandler.handle(error, 'Failed to set ADSR curve');
                }
            }
        });
    }
}

/**
 * Setup preset and playback mode selectors
 */
function setupAudioModeListeners() {
    // Preset selector
    const presetSelect = document.getElementById('preset-select');
    if (presetSelect) {
        // Populate preset options
        const presets = ctx.audioEngine.getPresets();
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
                    ctx.audioEngine.applyPreset(e.target.value);
                    // Update UI to reflect preset values
                    dom.reverbSlider.value = Math.round(ctx.audioEngine.getReverb() * 100);
                    dom.reverbValue.textContent = dom.reverbSlider.value;
                    dom.filterFreqSlider.value = ctx.audioEngine.getFilterFrequency();
                    dom.filterFreqValue.textContent = dom.filterFreqSlider.value;

                    // Visual feedback
                    const presets = ctx.audioEngine.getPresets();
                    const preset = presets[e.target.value];
                    if (preset) {
                        Toast.success(`Preset applied: ${preset.name}`, 2000);
                    }
                } catch (error) {
                    ErrorHandler.handle(error, 'Failed to apply preset');
                }
            }
        });
    }

    // Playback mode selector
    const playbackModeSelect = document.getElementById('playback-mode-select');
    if (playbackModeSelect) {
        // Populate playback mode options
        const modes = ctx.audioEngine.getPlaybackModes();
        Object.keys(modes).forEach(key => {
            const mode = modes[key];
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${mode.name} - ${mode.description}`;
            playbackModeSelect.appendChild(option);
        });

        // Set default to sequential to match the audio engine default
        playbackModeSelect.value = 'sequential';

        playbackModeSelect.addEventListener('change', (e) => {
            try {
                ctx.audioEngine.setPlaybackMode(e.target.value);
                Logger.log(`Playback mode changed to: ${e.target.value}`);
            } catch (error) {
                ErrorHandler.handle(error, 'Failed to set playback mode');
            }
        });
    }

    // Loop toggle
    const loopToggle = document.getElementById('loop-toggle');
    if (loopToggle) {
        // Set initial state to match the audio engine default
        loopToggle.checked = ctx.audioEngine.getLoopEnabled();

        loopToggle.addEventListener('change', (e) => {
            try {
                ctx.audioEngine.setLoopEnabled(e.target.checked);
                Logger.log(`Loop arpeggios: ${e.target.checked ? 'enabled' : 'disabled'}`);
            } catch (error) {
                ErrorHandler.handle(error, 'Failed to set loop enabled');
            }
        });
    }
}

/**
 * Setup import/export event listeners
 */
function setupImportExportListeners() {
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

    // Data exports (peak table / peak analysis / spectrum)
    const exportPeaksCSV = document.getElementById('export-peaks-csv');
    if (exportPeaksCSV) {
        exportPeaksCSV.addEventListener('click', handleExportPeaksCSV);
    }

    const exportPeaksJSON = document.getElementById('export-peaks-json');
    if (exportPeaksJSON) {
        exportPeaksJSON.addEventListener('click', handleExportPeaksJSON);
    }

    const exportSpectrumCSV = document.getElementById('export-spectrum-csv');
    if (exportSpectrumCSV) {
        exportSpectrumCSV.addEventListener('click', handleExportSpectrumCSV);
    }
}

/**
 * Setup MIDI event listeners
 */
function setupMIDIListeners() {
    const refreshMIDIButton = document.getElementById('refresh-midi-devices');
    if (refreshMIDIButton) {
        refreshMIDIButton.addEventListener('click', refreshMIDIDevices);
    }

    const midiDeviceSelect = document.getElementById('midi-device-select');
    if (midiDeviceSelect) {
        midiDeviceSelect.addEventListener('change', (e) => {
            if (ctx.midiOutput && e.target.value) {
                ctx.midiOutput.selectOutput(e.target.value);
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
            if (ctx.midiOutput) {
                ctx.midiOutput.setVelocity(velocity);
            }
        });
    }

    const midiNoteDurationSlider = document.getElementById('midi-note-duration');
    const midiNoteDurationValue = document.getElementById('midi-note-duration-value');
    if (midiNoteDurationSlider) {
        midiNoteDurationSlider.addEventListener('input', (e) => {
            const duration = parseInt(e.target.value);
            midiNoteDurationValue.textContent = duration;
            if (ctx.midiOutput) {
                ctx.midiOutput.setNoteDuration(duration);
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

    // MIDI input (play from keyboard)
    const midiInputSelect = document.getElementById('midi-input-select');
    if (midiInputSelect) {
        midiInputSelect.addEventListener('change', (e) => {
            if (ctx.midiInput) {
                ctx.midiInput.selectInput(e.target.value);
            }
        });
    }

    const midiInputEnabled = document.getElementById('midi-input-enabled');
    if (midiInputEnabled) {
        midiInputEnabled.addEventListener('change', handleMIDIInputEnabled);
    }

    // Pitch accuracy controls
    const midiPitchBend = document.getElementById('midi-pitch-bend');
    if (midiPitchBend) {
        midiPitchBend.addEventListener('change', (e) => {
            if (ctx.midiOutput) {
                ctx.midiOutput.setPitchBendEnabled(e.target.checked);
            }
        });
    }

    const midiBendRange = document.getElementById('midi-bend-range');
    const midiBendRangeValue = document.getElementById('midi-bend-range-value');
    if (midiBendRange) {
        midiBendRange.addEventListener('change', (e) => {
            const range = parseInt(e.target.value, 10);
            if (midiBendRangeValue) {
                midiBendRangeValue.textContent = range;
            }
            if (ctx.midiOutput) {
                ctx.midiOutput.setBendRange(range);
            }
        });
    }
}

/**
 * Setup favorite-toggle button.
 * Show-all / show-favorites filter buttons are wired by FilterManager.
 */
function setupUIEnhancementListeners() {
    const favoriteToggleButton = document.getElementById('favorite-toggle');
    if (favoriteToggleButton) {
        favoriteToggleButton.addEventListener('click', handleFavoriteToggle);
    }
}

/**
 * Setup sidebar navigation listeners
 */
function setupSidebarListeners() {
    const burgerBtn = document.getElementById('burger-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarClose = document.getElementById('sidebar-close');

    function openSidebar() {
        sidebar?.classList.remove('hidden');
        sidebar?.classList.add('visible');
        sidebarOverlay?.classList.remove('hidden');
        sidebarOverlay?.classList.add('visible');
        burgerBtn?.classList.add('active');
        burgerBtn?.setAttribute('aria-expanded', 'true');
        sidebar?.setAttribute('aria-hidden', 'false');
    }

    function closeSidebar() {
        sidebar?.classList.remove('visible');
        sidebarOverlay?.classList.remove('visible');
        burgerBtn?.classList.remove('active');
        burgerBtn?.setAttribute('aria-expanded', 'false');
        sidebar?.setAttribute('aria-hidden', 'true');
        // Wait for animation to complete before hiding
        setTimeout(() => {
            sidebar?.classList.add('hidden');
            sidebarOverlay?.classList.add('hidden');
        }, 300);
    }

    if (burgerBtn) {
        burgerBtn.addEventListener('click', () => {
            const isOpen = sidebar?.classList.contains('visible');
            if (isOpen) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Close sidebar when escape key is pressed
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar?.classList.contains('visible')) {
            closeSidebar();
        }
    });

    // Close sidebar when any menu button is clicked
    const menuButtons = document.querySelectorAll('.sidebar-button');
    menuButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Small delay to let the modal open before closing sidebar
            setTimeout(closeSidebar, 100);
        });
    });
}

/**
 * Main function to setup all event listeners
 * Replaces the monolithic setupEventListeners function
 */
export function setupEventListeners() {
    setupSidebarListeners();
    setupSubstanceListeners();
    setupPlaybackListeners();
    setupSliderListeners();
    setupADSRListeners();
    setupAudioModeListeners();
    setupImportExportListeners();
    setupMIDIListeners();
    setupUIEnhancementListeners();
}

/**
 * Show visual feedback when slider value changes
 * @param {HTMLElement} slider - The slider element
 * @param {HTMLElement} valueDisplay - The value display element
 */
function showSliderFeedback(slider, valueDisplay) {
    // Add flash class to value display
    valueDisplay.classList.add('value-flash');

    // Remove after animation completes
    setTimeout(() => {
        valueDisplay.classList.remove('value-flash');
    }, 300);

    // Add brief highlight to slider
    slider.classList.add('slider-changed');

    setTimeout(() => {
        slider.classList.remove('slider-changed');
    }, 200);
}
