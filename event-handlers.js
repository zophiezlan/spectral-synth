/**
 * Event Handlers Module
 * 
 * Centralizes event listener setup for better organization and maintainability.
 * Breaks down the monolithic setupEventListeners into logical groups.
 * 
 * Note: This module depends on DOM elements, audioEngine, and handler functions
 * being available in the global scope or passed as parameters.
 */

/**
 * Setup mode switching event listeners
 */
function setupModeListeners() {
    if (singleModeButton) {
        singleModeButton.addEventListener('click', () => switchMode(false));
    }
    if (comparisonModeButton) {
        comparisonModeButton.addEventListener('click', () => switchMode(true));
    }
}

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

    // Comparison mode substance selection
    if (substanceSelectA) {
        substanceSelectA.addEventListener('change', () => handleComparisonSubstanceChange('A'));
    }
    if (substanceSelectB) {
        substanceSelectB.addEventListener('change', () => handleComparisonSubstanceChange('B'));
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
    if (stopButton) {
        stopButton.addEventListener('click', handleStop);
    }

    // Peak selection
    if (clearSelectionButton) {
        clearSelectionButton.addEventListener('click', handleClearSelection);
    }

    // Comparison mode playback
    if (playAButton) {
        playAButton.addEventListener('click', () => handleComparisonPlay('A'));
    }
    if (playBButton) {
        playBButton.addEventListener('click', () => handleComparisonPlay('B'));
    }
    if (playBothSeqButton) {
        playBothSeqButton.addEventListener('click', handleComparisonPlaySequential);
    }
    if (playBothSimButton) {
        playBothSimButton.addEventListener('click', handleComparisonPlaySimultaneous);
    }
    if (playBlendButton) {
        playBlendButton.addEventListener('click', handlePlayBlend);
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
        });
    }

    // Reverb slider
    if (reverbSlider && reverbValue) {
        reverbSlider.addEventListener('input', (e) => {
            const reverb = parseInt(e.target.value) / 100;
            reverbValue.textContent = e.target.value;
            audioEngine.setReverb(reverb);
        });
    }

    // Filter frequency slider
    if (filterFreqSlider && filterFreqValue) {
        filterFreqSlider.addEventListener('input', (e) => {
            const freq = parseInt(e.target.value);
            filterFreqValue.textContent = freq;
            audioEngine.setFilterFrequency(freq);
        });
    }

    // Blend ratio slider
    if (blendRatioSlider && blendRatioValue) {
        blendRatioSlider.addEventListener('input', (e) => {
            blendRatio = parseInt(e.target.value) / 100;
            blendRatioValue.textContent = e.target.value;
        });
    }

    // Comparison duration slider
    if (comparisonDurationSlider && comparisonDurationValue) {
        comparisonDurationSlider.addEventListener('input', (e) => {
            comparisonDurationValue.textContent = parseFloat(e.target.value).toFixed(1);
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

        playbackModeSelect.addEventListener('change', (e) => {
            try {
                audioEngine.setPlaybackMode(e.target.value);
                console.log(`Playback mode changed to: ${e.target.value}`);
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
 * Setup favorites and keyboard shortcuts
 */
function setupUIEnhancementListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcut);

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
 * Main function to setup all event listeners
 * Replaces the monolithic setupEventListeners function
 */
function setupEventListeners() {
    setupModeListeners();
    setupSubstanceListeners();
    setupPlaybackListeners();
    setupSliderListeners();
    setupADSRListeners();
    setupAudioModeListeners();
    setupImportExportListeners();
    setupMIDIListeners();
    setupUIEnhancementListeners();
}
