/**
 * Main Application - Spectral Synthesizer
 *
 * Coordinates between UI, data, audio engine, and visualization.
 * This is the main entry point that ties together all the modules.
 * 
 * Utility modules (LoadingOverlay, Toast, ErrorHandler, etc.) are now
 * loaded from separate files for better maintainability.
 */

// Global instances
let audioEngine;
let visualizer;
let frequencyMapper;
let midiOutput;
let currentSpectrum = null;
let currentPeaks = null;
let libraryData = null;

// DOM elements are now loaded from dom-elements.js

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

        // Load FTIR library
        await loadLibrary();

        // Set up event listeners
        setupEventListeners();
        setupFilterStatusListeners();

        // Set up onboarding and shortcuts
        setupOnboarding();
        setupShortcutsOverlay();
        setupMenuModals();

        // Set up theme toggle
        setupThemeToggle();

        // Check if MP3 export is available
        checkMP3ExportAvailability();

        LoadingOverlay.hide();
        Toast.success('Spectral Synthesizer ready! 🎵');
        Logger.log('🎵 Spectral Synthesizer initialized');

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
 * 
 * @throws {Error} If library fails to load
 */
async function loadLibrary() {
    try {
        LoadingOverlay.show('Loading FTIR library (381 spectra)...');
        Logger.log('Loading FTIR library...');

        const response = await fetch(CONFIG.library.LIBRARY_FILE);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        libraryData = await response.json();

        Logger.log(`✓ Loaded ${libraryData.length} spectra from ENFSI library`);

        // Populate substance selector
        populateSubstanceSelector();
    } catch (error) {
        ErrorHandler.handle(
            error,
            'Failed to load FTIR library. Please check your connection and refresh the page.'
        );
        throw error; // Re-throw to stop initialization
    }
}

// categorizeSubstance is now loaded from substance-utilities.js

/**
 * Get filtered library based on search term and category
 * @returns {Array} Filtered library data
 */
function getFilteredLibrary() {
    const showFavoritesButton = document.getElementById('show-favorites');
    const showFavoritesOnly = showFavoritesButton?.classList.contains('active') || false;
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

    // Update filter status and show/hide no results
    updateFilterStatus(filteredData.length);
}



/**
 * Update filter status bar display
 * @param {number} resultCount - Number of results after filtering
 */
function updateFilterStatus(resultCount) {
    const activeFiltersContainer = document.getElementById('active-filters');
    const searchFilterTag = document.getElementById('search-filter-tag');
    const categoryFilterTag = document.getElementById('category-filter-tag');
    const favoritesFilterTag = document.getElementById('favorites-filter-tag');
    const noResultsDiv = document.getElementById('no-results');
    const substanceSelector = document.querySelector('.substance-selector');

    let hasActiveFilters = false;

    // Update search filter tag
    if (currentSearchTerm) {
        const searchTermDisplay = document.getElementById('search-term-display');
        searchTermDisplay.textContent = currentSearchTerm;
        searchFilterTag.classList.remove('hidden');
        hasActiveFilters = true;
    } else {
        searchFilterTag.classList.add('hidden');
    }

    // Update category filter tag
    if (currentCategory && currentCategory !== 'all') {
        const categoryNameDisplay = document.getElementById('category-name-display');
        const categorySelect = document.getElementById('category');
        const selectedOption = categorySelect.options[categorySelect.selectedIndex];
        categoryNameDisplay.textContent = selectedOption.text;
        categoryFilterTag.classList.remove('hidden');
        hasActiveFilters = true;
    } else {
        categoryFilterTag.classList.add('hidden');
    }

    // Update favorites filter tag
    const showFavoritesButton = document.getElementById('show-favorites');
    const showFavoritesOnly = showFavoritesButton?.classList.contains('active') || false;
    if (showFavoritesOnly) {
        favoritesFilterTag.classList.remove('hidden');
        hasActiveFilters = true;
    } else {
        favoritesFilterTag.classList.add('hidden');
    }

    // Show/hide active filters container
    if (hasActiveFilters) {
        activeFiltersContainer.classList.remove('hidden');
    } else {
        activeFiltersContainer.classList.add('hidden');
    }

    // Show/hide no results state
    if (resultCount === 0) {
        noResultsDiv.classList.remove('hidden');
        if (substanceSelector) {
            substanceSelector.style.display = 'none';
        }
    } else {
        noResultsDiv.classList.add('hidden');
        if (substanceSelector) {
            substanceSelector.style.display = 'block';
        }
    }
}

/**
 * Clear a specific filter
 * @param {string} filterType - Type of filter to clear ('search', 'category', 'favorites')
 */
function clearFilter(filterType) {
    switch (filterType) {
        case 'search':
            searchInput.value = '';
            currentSearchTerm = '';
            break;
        case 'category':
            categorySelect.value = 'all';
            currentCategory = 'all';
            break;
        case 'favorites':
            const showAllButton = document.getElementById('show-all');
            const showFavoritesButton = document.getElementById('show-favorites');
            if (showAllButton && showFavoritesButton) {
                showAllButton.classList.add('active');
                showAllButton.setAttribute('aria-pressed', 'true');
                showFavoritesButton.classList.remove('active');
                showFavoritesButton.setAttribute('aria-pressed', 'false');
            }
            break;
    }
    populateSubstanceSelector();
}

/**
 * Clear all active filters
 */
function clearAllFilters() {
    searchInput.value = '';
    currentSearchTerm = '';
    categorySelect.value = 'all';
    currentCategory = 'all';

    const showAllButton = document.getElementById('show-all');
    const showFavoritesButton = document.getElementById('show-favorites');
    if (showAllButton && showFavoritesButton) {
        showAllButton.classList.add('active');
        showAllButton.setAttribute('aria-pressed', 'true');
        showFavoritesButton.classList.remove('active');
        showFavoritesButton.setAttribute('aria-pressed', 'false');
    }

    populateSubstanceSelector();
    Toast.info('All filters cleared');
}

/**
 * Set up filter status bar event listeners
 */
function setupFilterStatusListeners() {
    // Individual filter remove buttons
    const filterRemoveButtons = document.querySelectorAll('.filter-remove');
    filterRemoveButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filterType = button.getAttribute('data-filter');
            clearFilter(filterType);
        });
    });

    // Clear all filters button
    const clearAllButton = document.getElementById('clear-all-filters');
    if (clearAllButton) {
        clearAllButton.addEventListener('click', clearAllFilters);
    }

    // Clear search button in no results state
    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearAllFilters);
    }
}

/**
 * Set up event listeners
 */
// setupEventListeners is now loaded from event-handlers.js

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

    // Keyboard shortcuts
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
        selectAllButton.disabled = true;
        clearSelectionButton.disabled = true;
        // Note: playSelectedButton removed - main Play button handles selected peaks automatically
        const exportWAV = document.getElementById('export-wav');
        if (exportWAV) {
            exportWAV.disabled = true;
        }
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
async function handlePlay() {
    // If currently playing, stop instead
    if (audioEngine.isPlaying) {
        audioEngine.stop();
        visualizer.stopAudioAnimation();
        playButton.textContent = '▶ Play Sound';
        playButton.disabled = false;
        ScreenReader.announce('Playback stopped');
        Logger.log('Playback stopped');
        return;
    }

    if (!currentPeaks || currentPeaks.length === 0) {
        Logger.warn('No peaks to play');
        Toast.warning('No peaks detected for this substance');
        return;
    }

    // Use selected peaks if any exist, otherwise use all peaks
    const selectedPeaks = visualizer.getSelectedPeaks();
    const peaksToPlay = (selectedPeaks && selectedPeaks.length > 0) ? selectedPeaks : currentPeaks;

    const duration = parseFloat(durationSlider.value);

    if (isNaN(duration) || duration <= 0) {
        Logger.error('Invalid duration:', duration);
        ErrorHandler.handle(
            new Error('Invalid duration'),
            'Invalid duration value. Please refresh the page.'
        );
        return;
    }

    try {
        // Update button to show stop
        playButton.textContent = '■ Stop';

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

        Logger.log(`Playing ${peaksToPlay.length} frequencies${(selectedPeaks && selectedPeaks.length > 0) ? ' (selected)' : ''} for ${duration}s`);

        // Reset button after duration (with buffer for audio to fully stop)
        const playbackBuffer = typeof CONSTANTS !== 'undefined'
            ? CONSTANTS.TIMING.PLAYBACK_END_BUFFER
            : 100;
        setTimeout(() => {
            playButton.textContent = '▶ Play Sound';
            visualizer.stopAudioAnimation();
            ScreenReader.announce('Playback finished');
        }, duration * 1000 + playbackBuffer);

    } catch (error) {
        playButton.textContent = '▶ Play Sound';
        visualizer.stopAudioAnimation();

        ErrorHandler.handle(
            error,
            `Error playing audio: ${error.message || 'Unknown error'}. Please try again or refresh the page.`
        );
    }
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

    Logger.log(`Peak selection changed: ${count} peaks selected`);
}

/**
 * Handle clear selection button
 * Clears all selected peaks and returns to playing all peaks.
 */
function handleClearSelection() {
    visualizer.clearSelection();
}

/**
 * Handle select all peaks button
 * Selects all detected peaks in the current spectrum.
 */
function handleSelectAll() {
    if (!visualizer || !currentPeaks || currentPeaks.length === 0) {
        Logger.warn('No peaks to select');
        return;
    }
    visualizer.selectAllPeaks();
    Logger.log(`Selected all ${currentPeaks.length} peaks`);
}

/**
 * Handle stop button click
 */
function handleStop() {
    if (audioEngine.isPlaying) {
        audioEngine.stop();
        visualizer.stopAudioAnimation();
        playButton.textContent = '▶ Play Sound';
        ScreenReader.announce('Playback stopped');
        Logger.log('Playback stopped');
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

        // Repopulate selector
        populateSubstanceSelector();

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

        // Repopulate selector
        populateSubstanceSelector();

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

/**
 * Set up keyboard shortcuts overlay
 */
function setupShortcutsOverlay() {
    const shortcutsOverlay = document.getElementById('shortcuts-overlay');
    const closeButton = document.getElementById('shortcuts-close');
    const okButton = document.getElementById('shortcuts-ok');

    // Early return if elements don't exist (feature may have been removed)
    if (!shortcutsOverlay || !closeButton || !okButton) {
        return;
    }

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
    if (shortcutsOverlay) {
        shortcutsOverlay.style.display = 'flex';
    }
}

/**
 * Set up theme toggle
 */
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');

    if (!themeToggle) {
        return;
    }

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
 * @param {boolean} showFavoritesOnly - Whether to show only favorites
 */
function handleFavoritesFilterChange(showFavoritesOnly) {
    // Update button states
    const showAllButton = document.getElementById('show-all');
    const showFavoritesButton = document.getElementById('show-favorites');

    if (showAllButton && showFavoritesButton) {
        if (showFavoritesOnly) {
            showAllButton.classList.remove('active');
            showAllButton.setAttribute('aria-pressed', 'false');
            showFavoritesButton.classList.add('active');
            showFavoritesButton.setAttribute('aria-pressed', 'true');
        } else {
            showAllButton.classList.add('active');
            showAllButton.setAttribute('aria-pressed', 'true');
            showFavoritesButton.classList.remove('active');
            showFavoritesButton.setAttribute('aria-pressed', 'false');
        }
    }

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
