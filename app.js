/**
 * Main Application - Spectral Synthesizer
 *
 * Coordinates between UI, data, audio engine, and visualization.
 * This is the main entry point that ties together all the modules.
 *
 * Utility modules (LoadingOverlay, Toast, ErrorHandler, etc.) are now
 * loaded from separate files for better maintainability.
 */

/* global handlePeakSelectionChange, setupThemeToggle, LibraryLoader, PerformanceMonitor, SpectrumCodec */

// Global instances
let audioEngine;
let visualizer;
let frequencyMapper;
let midiOutput;
let midiInput;
let currentSpectrum = null;
let currentPeaks = null;
let libraryData = null;
let libraryIndex = null; // Library index for lazy loading

// DOM elements are now loaded from dom-elements.js

// Filter state is owned by FilterManager (filter-manager.js)

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
        if (typeof PerformanceMonitor !== 'undefined') {
            PerformanceMonitor.init();
            PerformanceMonitor.mark('init-start');
        }

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

        // Create MIDI instances (optional, may not be supported)
        try {
            if (typeof MIDIOutput !== 'undefined') {
                midiOutput = new MIDIOutput();
                if (typeof MIDIInput !== 'undefined') {
                    midiInput = new MIDIInput({
                        audioEngine,
                        getPeaks: () => currentPeaks,
                    });
                }
                // Try to initialize MIDI (don't fail if not supported)
                try {
                    await midiOutput.init();
                    if (midiInput) {
                        await midiInput.init(midiOutput.midiAccess);
                    }
                    refreshMIDIDevices();
                } catch (midiError) {
                    Logger.info('MIDI not available:', midiError.message);
                }
            }
        } catch (error) {
            Logger.info('MIDI Output not loaded');
        }

        // Create visualizer for single mode
        visualizer = new Visualizer(ftirCanvas, audioCanvas);
        visualizer.setAudioEngine(audioEngine);
        visualizer.onPeakSelectionChange = handlePeakSelectionChange;

        // Initialize library loader
        libraryIndex = await LibraryLoader.init();

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

        // Mark initialization complete
        if (typeof PerformanceMonitor !== 'undefined') {
            PerformanceMonitor.mark('init-complete');
            PerformanceMonitor.measure('initialization-time', 'init-start', 'init-complete');
        }

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
 * Load FTIR library from JSON
 *
 * Fetches the FTIR spectral database and populates the substance selectors.
 * Uses lazy loading if available, otherwise falls back to monolithic file.
 *
 * @throws {Error} If library fails to load
 */
async function loadLibrary() {
    const startTime = typeof PerformanceMonitor !== 'undefined' ? window.performance.now() : 0;

    try {
        if (LibraryLoader.isLazyLoadingEnabled()) {
            // Lazy loading mode: initially load all categories to maintain compatibility
            // In the future, we can load only on-demand based on category selection
            LoadingOverlay.show('Loading FTIR library index...');
            Logger.log('Loading FTIR library with lazy loading...');

            libraryData = await LibraryLoader.loadAll();

            Logger.log(`✓ Loaded ${libraryData.length} spectra from ENFSI library (lazy loaded)`);

            // Track performance
            if (typeof PerformanceMonitor !== 'undefined') {
                PerformanceMonitor.trackLibraryLoad('lazy', 'all', startTime);
            }
        } else {
            // Fallback to monolithic file
            LoadingOverlay.show('Loading FTIR library...');
            Logger.log('Loading FTIR library...');

            const response = await fetch(CONFIG.library.LIBRARY_FILE);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            libraryData = SpectrumCodec.decodeLibrary(await response.json());

            Logger.log(`✓ Loaded ${libraryData.length} spectra from ENFSI library`);

            // Track performance
            if (typeof PerformanceMonitor !== 'undefined') {
                PerformanceMonitor.trackLibraryLoad('monolithic', null, startTime);
            }
        }

        // Hand the library off to FilterManager, which owns the selector + filter UI.
        FilterManager.init(libraryData);

        // Visual library browser (sparkline grid)
        if (typeof BrowseManager !== 'undefined') {
            BrowseManager.init({
                getLibrary: () => libraryData,
                onSelect: (substance) => {
                    substanceSelect.value = substance.id;
                    if (substanceSelect.value !== substance.id) {
                        // Active filters hide this substance — clear them and retry
                        FilterManager.clearAll();
                        substanceSelect.value = substance.id;
                    }
                    handleSubstanceChange();
                },
            });
        }
    } catch (error) {
        ErrorHandler.handle(
            error,
            'Failed to load FTIR library. Please check your connection and refresh the page.'
        );
        throw error; // Re-throw to stop initialization
    }
}

// categorizeSubstance is now loaded from substance-utilities.js

// Filtering, selector population, filter-status UI, and filter-clear handlers
// are owned by FilterManager (filter-manager.js). FilterManager.init() in
// loadLibrary() wires the search input, category select, favorites buttons,
// per-filter remove buttons, and the clear-all/clear-search buttons.

// setupEventListeners is now loaded from event-handlers.js

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
    });
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

// handleSearch and handleCategoryChange are owned by FilterManager.

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
        if (selectAllButton) selectAllButton.disabled = true;
        if (clearSelectionButton) clearSelectionButton.disabled = true;
        ['export-wav', 'export-peaks-csv', 'export-peaks-json', 'export-spectrum-csv'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = true;
        });
        // Hide favorite button
        const favoriteButton = document.getElementById('favorite-toggle');
        if (favoriteButton) {
            favoriteButton.classList.add('hidden');
        }
        selectionCount.textContent = 'Click peaks on the FTIR spectrum to select them';
        const defaultMessage = '<p>Select a substance to see how infrared frequencies map to audio frequencies.</p>';
        if (mappingInfo) {
            mappingInfo.innerHTML = defaultMessage;
        }
        if (mappingInfoModal) {
            mappingInfoModal.innerHTML = defaultMessage;
        }
        return;
    }

    // Find spectrum in library
    const data = libraryData.find(item => item.id === substanceId);
    if (!data) {
        Logger.error('Spectrum not found:', substanceId);
        return;
    }

    currentSpectrum = data.spectrum;

    // Extract peaks for sonification
    currentPeaks = frequencyMapper.extractPeaks(currentSpectrum);

    Logger.log(`Loaded ${data.name}:`, currentPeaks.length, 'peaks detected');

    // Clear any previous selection
    visualizer.clearSelection();

    // Update visualizations
    visualizer.drawFTIRSpectrum(currentSpectrum, currentPeaks);

    // Show peak selection hint for first-time users
    showPeakSelectionHint();

    // Update mapping info with annotations
    updateMappingInfo(data, currentPeaks);

    // Enable playback and selection controls
    playButton.disabled = false;
    if (selectAllButton) selectAllButton.disabled = false;
    if (clearSelectionButton) clearSelectionButton.disabled = false;

    // Enable export buttons
    const exportMP3 = document.getElementById('export-mp3');
    if (exportMP3) {
        exportMP3.disabled = false;
    }
    ['export-wav', 'export-peaks-csv', 'export-peaks-json', 'export-spectrum-csv'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = false;
    });

    // Update MIDI send button
    updateMIDISendButton();

    // Update favorite button
    const favoriteButton = document.getElementById('favorite-toggle');
    if (favoriteButton) {
        favoriteButton.classList.remove('hidden');
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
        if (mappingInfo) {
            mappingInfo.innerHTML = noPeaksMessage;
        }
        if (mappingInfoModal) {
            mappingInfoModal.innerHTML = noPeaksMessage;
        }
        return;
    }

    let html = `<p><strong>${data.name}</strong></p>`;
    html += `<p>${data.description}</p>`;
    html += `<p>Detected ${peaks.length} significant absorption peaks <span style="font-size: 0.85em; color: #888;">(click a row to hear that peak)</span>:</p>`;
    html += '<table style="width: 100%; margin-top: 10px; font-size: 0.9em;">';
    html += '<tr style="border-bottom: 1px solid #444;">';
    html += '<th style="text-align: left; padding: 5px;">IR (cm⁻¹)</th>';
    html += '<th style="text-align: left; padding: 5px;">Audio (Hz)</th>';
    html += '<th style="text-align: left; padding: 5px;">Intensity</th>';
    html += '<th style="text-align: left; padding: 5px;">Width</th>';
    html += '<th style="text-align: left; padding: 5px;">Functional Group</th>';
    html += '</tr>';

    peaks.slice(0, 10).forEach((peak, idx) => {
        const wavenumberStr = peak.wavenumber.toFixed(0);
        const audioFreqStr = peak.audioFreq.toFixed(1);
        const intensityPercent = (peak.absorbance * 100).toFixed(0);
        const widthStr = peak.width !== undefined ? peak.width.toFixed(0) : '—';
        const functionalGroup = frequencyMapper.getFunctionalGroup(peak.wavenumber);

        html += `<tr class="peak-row" data-peak-idx="${idx}" title="Click to audition this peak" style="border-bottom: 1px solid #333; cursor: pointer;">`;
        html += `<td style="padding: 5px;">${wavenumberStr}</td>`;
        html += `<td style="padding: 5px;">${audioFreqStr}</td>`;
        html += `<td style="padding: 5px;">${intensityPercent}%</td>`;
        html += `<td style="padding: 5px;">${widthStr}</td>`;
        html += `<td style="padding: 5px; color: #a78bfa;">${functionalGroup}</td>`;
        html += '</tr>';
    });

    html += '</table>';

    if (peaks.length > 10) {
        html += `<p style="margin-top: 10px; font-size: 0.9em; color: #888;">... and ${peaks.length - 10} more peaks</p>`;
    }

    html += '<p style="margin-top: 15px; font-size: 0.9em;">';
    html += `Mapping: ${frequencyMapper.IR_MIN}-${frequencyMapper.IR_MAX} cm⁻¹ → `;
    html += `${frequencyMapper.AUDIO_MIN}-${frequencyMapper.AUDIO_MAX} Hz (logarithmic scale)`;
    html += '</p>';

    if (mappingInfo) {
        mappingInfo.innerHTML = html;
    }
    if (mappingInfoModal) {
        mappingInfoModal.innerHTML = html;
    }
}

/**
 * Handle play button click
 *
 * Toggles between play and stop.
 * Automatically uses selected peaks if any exist, otherwise uses all peaks.
 * Updates button text to reflect current state.
 */
// Playback functions moved to playback-controller.js
// Functions: handlePlay, handleStop, handlePeakSelectionChange, handleClearSelection, handleSelectAll

// Import/Export handlers moved to handlers-import-export.js
// Functions: handleCSVImport, handleJCAMPImport, handleExportWAV, handleExportMP3

// MIDI handlers moved to handlers-midi.js
// Functions: refreshMIDIDevices, updateMIDISendButton, handleSendMIDI, handleExportMIDIFile

/**
 * Set up click-to-audition on the peak table rows.
 * Rows in the mapping info tables carry data-peak-idx into currentPeaks.
 */
function setupPeakAudition() {
    [mappingInfo, mappingInfoModal].forEach(container => {
        if (!container) return;
        container.addEventListener('click', async (e) => {
            const row = e.target.closest('tr[data-peak-idx]');
            if (!row || !currentPeaks) return;
            const peak = currentPeaks[Number(row.dataset.peakIdx)];
            if (!peak) return;

            try {
                await audioEngine.init();
                // Single-peak voice, boosted since one oscillator carries the sound
                const voice = audioEngine.startVoice([peak], { gainScale: 1.5 });
                if (voice) {
                    setTimeout(() => voice.release(), 700);
                }
            } catch (error) {
                Logger.debug('Peak audition failed:', error.message);
            }
        });
    });
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

    if (!onboardingModal || !closeButton || !startTourButton || !skipTourButton || !dontShowCheckbox) {
        return;
    }

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
    const mappingInfoBtn = document.getElementById('mapping-info-btn');
    const helpClose = document.getElementById('help-close');
    const helpOk = document.getElementById('help-ok');
    const restartTutorial = document.getElementById('restart-tutorial');

    const openHelp = () => {
        helpModal.classList.remove('hidden');
        helpModal.style.display = 'flex';
    };

    const closeHelp = () => {
        helpModal.classList.add('hidden');
        helpModal.style.display = 'none';
    };

    if (helpBtn && helpModal) {
        helpBtn.addEventListener('click', openHelp);

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

    // Mapping info button (opens help modal)
    if (mappingInfoBtn && helpModal) {
        mappingInfoBtn.addEventListener('click', openHelp);
    }

    // Favorites Modal
    const favoritesModal = document.getElementById('favorites-modal');
    const favoritesBtn = document.getElementById('favorites-menu-btn');
    const favoritesClose = document.getElementById('favorites-close');
    const favoritesOk = document.getElementById('favorites-ok');

    if (favoritesBtn && favoritesModal) {
        favoritesBtn.addEventListener('click', () => {
            updateFavoritesList();
            favoritesModal.classList.remove('hidden');
            favoritesModal.style.display = 'flex';
        });

        const closeFavorites = () => {
            favoritesModal.classList.add('hidden');
            favoritesModal.style.display = 'none';
        };

        if (favoritesClose) favoritesClose.addEventListener('click', closeFavorites);
        if (favoritesOk) favoritesOk.addEventListener('click', closeFavorites);

        favoritesModal.addEventListener('click', (e) => {
            if (e.target === favoritesModal) closeFavorites();
        });
    }
}

/**
 * Update the favorites list in the modal
 */
function updateFavoritesList() {
    const favoritesList = document.getElementById('favorites-list');
    if (!favoritesList) return;

    const favorites = Favorites.getAll();

    if (favorites.length === 0) {
        favoritesList.innerHTML = '<p class="empty-favorites">No favorites yet. Click the ⭐ button next to any substance to add it to your favorites.</p>';
        return;
    }

    // Build the list
    const listHTML = favorites.map(substanceName => {
        // Find the substance in the library to get its ID
        const substance = libraryData.find(item => item.name === substanceName);
        const substanceId = substance ? substance.id : null;

        return `
            <div class="favorite-item">
                <span class="favorite-name">${substanceName}</span>
                <div class="favorite-actions">
                    <button class="favorite-load-btn" data-id="${substanceId}" data-name="${substanceName}">Load</button>
                    <button class="favorite-remove-btn" data-name="${substanceName}">Remove</button>
                </div>
            </div>
        `;
    }).join('');

    favoritesList.innerHTML = listHTML;

    // Add event listeners
    favoritesList.querySelectorAll('.favorite-load-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const substanceId = btn.dataset.id;
            if (substanceId && substanceSelect) {
                substanceSelect.value = substanceId;
                handleSubstanceChange();
                // Close the modal
                const favoritesModal = document.getElementById('favorites-modal');
                if (favoritesModal) {
                    favoritesModal.classList.add('hidden');
                    favoritesModal.style.display = 'none';
                }
            }
        });
    });

    favoritesList.querySelectorAll('.favorite-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const substanceName = btn.dataset.name;
            Favorites.remove(substanceName);
            updateFavoritesList();
            // Update the favorite toggle button if this substance is currently selected
            const currentSubstanceName = substanceSelect.options[substanceSelect.selectedIndex]?.text;
            if (currentSubstanceName === substanceName) {
                const favoriteToggle = document.getElementById('favorite-toggle');
                if (favoriteToggle) {
                    favoriteToggle.textContent = '☆';
                    favoriteToggle.setAttribute('aria-label', 'Add to favorites');
                }
            }
        });
    });
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
 * Check if we should show Quick Start panel
 */
function checkAndShowQuickStart() {
    const hasSeenQuickStart = localStorage.getItem('quick-start-completed');
    const hasSeenOnboarding = localStorage.getItem('onboarding-completed');

    // Show Quick Start if user hasn't seen it and hasn't seen onboarding
    if (!hasSeenQuickStart && !hasSeenOnboarding) {
        setTimeout(() => {
            const quickStartPanel = document.getElementById('quick-start-panel');
            if (quickStartPanel) {
                quickStartPanel.classList.remove('hidden');
            }
        }, 500);
    } else if (!hasSeenOnboarding) {
        // If they've seen Quick Start but not onboarding, show onboarding
        checkAndShowOnboarding();
    }

    setupQuickStartHandlers();
}

/**
 * Set up Quick Start panel event handlers
 */
function setupQuickStartHandlers() {
    const hideButton = document.getElementById('hide-quick-start');
    const tryCaffeineButton = document.getElementById('try-caffeine');
    const startTourButton = document.getElementById('start-tour-from-quickstart');
    const quickStartPanel = document.getElementById('quick-start-panel');

    if (hideButton && quickStartPanel) {
        hideButton.addEventListener('click', () => {
            quickStartPanel.classList.add('hidden');
            localStorage.setItem('quick-start-completed', 'true');
        });
    }

    if (tryCaffeineButton) {
        tryCaffeineButton.addEventListener('click', () => {
            // Hide Quick Start panel
            if (quickStartPanel) {
                quickStartPanel.classList.add('hidden');
                localStorage.setItem('quick-start-completed', 'true');
            }

            // Select caffeine
            selectSubstanceByName('caffeine');

            // Scroll to substance selector
            setTimeout(() => {
                substanceSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        });
    }

    if (startTourButton) {
        startTourButton.addEventListener('click', () => {
            // Hide Quick Start panel
            if (quickStartPanel) {
                quickStartPanel.classList.add('hidden');
                localStorage.setItem('quick-start-completed', 'true');
            }

            // Start the guided tour
            startGuidedTour();
        });
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
        Logger.error('Tutorial path modal not found');
        return;
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // Setup path selection handlers (only once)
    if (!modal.dataset.initialized) {
        const closeButton = document.getElementById('tutorial-path-close');
        const pathCards = modal.querySelectorAll('.tutorial-path-card');

        closeButton.addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }
        });

        pathCards.forEach(card => {
            card.addEventListener('click', () => {
                const path = card.getAttribute('data-path');
                modal.classList.add('hidden');
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

// Note: setupShortcutsOverlay and showShortcutsOverlay have been moved to keyboard-shortcuts.js
// The shortcuts overlay is now managed by ModalManager and KeyboardShortcuts module

/**
 * Set up theme toggle
 */
// Theme functions moved to theme-manager.js
// Functions: setupThemeToggle, setTheme

// handleFavoritesFilterChange replaced by FilterManager.setShowFavoritesOnly(bool).

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
// calculateSpectralSimilarity is now loaded from analysis-utilities.js

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

/**
 * Show peak selection hint for first-time users
 */
function showPeakSelectionHint() {
    const hasSeenHint = localStorage.getItem('peak-selection-hint-seen');

    if (!hasSeenHint) {
        // Wait 2 seconds before showing hint
        setTimeout(() => {
            // Add pulse animation to FTIR canvas
            const ftirCanvas = document.getElementById('ftir-canvas');
            if (ftirCanvas) {
                ftirCanvas.classList.add('peak-hint-pulse');

                // Remove pulse after 3 seconds
                setTimeout(() => {
                    ftirCanvas.classList.remove('peak-hint-pulse');
                }, 3000);
            }

            // Show informative toast
            Toast.info('💡 Tip: Click on peaks in the FTIR spectrum to select specific frequencies!', 5000);

            // Mark as seen
            localStorage.setItem('peak-selection-hint-seen', 'true');
        }, 2000);
    }
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
    frequencyMapper,
    getCurrentPeaks: () => currentPeaks,
    getCurrentSpectrum: () => currentSpectrum
};
