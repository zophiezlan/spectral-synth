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


/**
 * Setup substance selection and filtering listeners
 */
function setupSubstanceListeners() {
    // Single mode substance selection
    if (substanceSelect) {
        substanceSelect.addEventListener('change', handleSubstanceChange);
    }

    // Search and filter
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    if (categorySelect) {
        categorySelect.addEventListener('change', handleCategoryChange);
    }
}

/**
 * Setup playback control listeners
 */
function setupPlaybackListeners() {
    // Single mode playback
    if (playButton) {
        playButton.addEventListener('click', handlePlay);
    }

    // Peak selection - clear selection
    if (clearSelectionButton) {
        clearSelectionButton.addEventListener('click', handleClearSelection);
    }

    // Peak selection - select all
    if (selectAllButton) {
        selectAllButton.addEventListener('click', handleSelectAll);
    }
}

/**
 * Setup slider event listeners
 */
function setupSliderListeners() {
    // Duration slider
    if (durationSlider && durationValue) {
        durationSlider.addEventListener('input', (e) => {
            durationValue.textContent = parseFloat(e.target.value).toFixed(1);
        });
    }

    // Volume slider
    if (volumeSlider && volumeValue) {
        volumeSlider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value) / 100;
            volumeValue.textContent = e.target.value;
            audioEngine.setVolume(volume);

            // Visual feedback
            showSliderFeedback(volumeSlider, volumeValue);
        });
    }

    // Reverb slider
    if (reverbSlider && reverbValue) {
        reverbSlider.addEventListener('input', (e) => {
            const reverb = parseInt(e.target.value) / 100;
            reverbValue.textContent = e.target.value;
            audioEngine.setReverb(reverb);

            // Visual feedback
            showSliderFeedback(reverbSlider, reverbValue);
        });
    }

    // Filter frequency slider
    if (filterFreqSlider && filterFreqValue) {
        filterFreqSlider.addEventListener('input', (e) => {
            const freq = parseInt(e.target.value);
            filterFreqValue.textContent = freq;
            audioEngine.setFilterFrequency(freq);

            // Visual feedback
            showSliderFeedback(filterFreqSlider, filterFreqValue);
        });
    }

}

/**
 * Setup ADSR envelope control listeners
 */
function setupADSRListeners() {
    // Attack slider
    if (attackSlider && attackValue) {
        attackSlider.addEventListener('input', (e) => {
            const timeMs = parseInt(e.target.value);
            const timeSec = timeMs / 1000;
            attackValue.textContent = timeMs;
            audioEngine.setAttackTime(timeSec);
        });
    }

    // Decay slider
    if (decaySlider && decayValue) {
        decaySlider.addEventListener('input', (e) => {
            const timeMs = parseInt(e.target.value);
            const timeSec = timeMs / 1000;
            decayValue.textContent = timeMs;
            audioEngine.setDecayTime(timeSec);
        });
    }

    // Sustain slider
    if (sustainSlider && sustainValue) {
        sustainSlider.addEventListener('input', (e) => {
            const level = parseInt(e.target.value) / 100;
            sustainValue.textContent = e.target.value;
            audioEngine.setSustainLevel(level);
        });
    }

    // Release slider
    if (releaseSlider && releaseValue) {
        releaseSlider.addEventListener('input', (e) => {
            const timeMs = parseInt(e.target.value);
            const timeSec = timeMs / 1000;
            releaseValue.textContent = timeMs;
            audioEngine.setReleaseTime(timeSec);
        });
    }

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
}

/**
 * Setup preset and playback mode selectors
 */
function setupAudioModeListeners() {
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

                    // Visual feedback
                    const presets = audioEngine.getPresets();
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
        const modes = audioEngine.getPlaybackModes();
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
                audioEngine.setPlaybackMode(e.target.value);
                Logger.log(`Playback mode changed to: ${e.target.value}`);
            } catch (error) {
                ErrorHandler.handle(error, 'Failed to set playback mode');
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
}

/**
 * Setup favorites UI listeners
 * Note: Keyboard shortcuts are now handled by KeyboardShortcuts module (initialized in app.js)
 */
function setupUIEnhancementListeners() {
    // Favorites filter buttons
    const showAllButton = document.getElementById('show-all');
    const showFavoritesButton = document.getElementById('show-favorites');
    if (showAllButton && showFavoritesButton) {
        showAllButton.addEventListener('click', () => handleFavoritesFilterChange(false));
        showFavoritesButton.addEventListener('click', () => handleFavoritesFilterChange(true));
    }

    // Favorite button
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
function setupEventListeners() {
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
