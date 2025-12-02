/**
 * Main Application - Spectral Synthesizer
 *
 * Coordinates between UI, data, audio engine, and visualization
 */

// Global instances
let audioEngine;
let visualizer;
let visualizerA;
let visualizerB;
let frequencyMapper;
let currentSpectrum = null;
let currentPeaks = null;
let libraryData = null;

// Comparison mode state
let comparisonMode = false;
let substanceA = { spectrum: null, peaks: null, data: null };
let substanceB = { spectrum: null, peaks: null, data: null };

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
const playSelectedButton = document.getElementById('play-selected');
const selectAllButton = document.getElementById('select-all');
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
const mappingInfo = document.getElementById('mapping-info');
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
const comparisonDurationSlider = document.getElementById('comparison-duration');
const comparisonDurationValue = document.getElementById('comparison-duration-value');
const ftirCanvasA = document.getElementById('ftir-canvas-a');
const ftirCanvasB = document.getElementById('ftir-canvas-b');

// Filter state
let currentSearchTerm = '';
let currentCategory = 'all';

/**
 * Initialize application
 */
async function init() {
    // Create instances
    audioEngine = new AudioEngine();
    frequencyMapper = new FrequencyMapper();

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

    console.log('🎵 Spectral Synthesizer initialized');
}

/**
 * Load FTIR library from JSON
 */
async function loadLibrary() {
    try {
        console.log('Loading FTIR library...');
        const response = await fetch('ftir-library.json');
        libraryData = await response.json();

        console.log(`✓ Loaded ${libraryData.length} spectra from ENFSI library`);

        // Populate substance selectors
        populateSubstanceSelector();
        populateComparisonSelectors();
    } catch (error) {
        console.error('Error loading library:', error);
        alert('Failed to load FTIR library. Please refresh the page.');
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
    return libraryData.filter(item => {
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
    playSelectedButton.addEventListener('click', handlePlaySelected);
    selectAllButton.addEventListener('click', handleSelectAll);
    clearSelectionButton.addEventListener('click', handleClearSelection);

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

    // Comparison mode - Substance selection
    substanceSelectA.addEventListener('change', () => handleComparisonSubstanceChange('A'));
    substanceSelectB.addEventListener('change', () => handleComparisonSubstanceChange('B'));

    // Comparison mode - Playback controls
    playAButton.addEventListener('click', () => handleComparisonPlay('A'));
    playBButton.addEventListener('click', () => handleComparisonPlay('B'));
    playBothSeqButton.addEventListener('click', handleComparisonPlaySequential);
    playBothSimButton.addEventListener('click', handleComparisonPlaySimultaneous);

    // Comparison mode - Duration slider
    comparisonDurationSlider.addEventListener('input', (e) => {
        comparisonDurationValue.textContent = parseFloat(e.target.value).toFixed(1);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcut);
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
 * Handle search input
 */
function handleSearch() {
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
        selectionCount.textContent = 'Click peaks on the FTIR spectrum to select them';
        mappingInfo.innerHTML = '<p>Select a substance to see how infrared frequencies map to audio frequencies.</p>';
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
}

/**
 * Update mapping information display
 */
function updateMappingInfo(data, peaks) {
    if (!peaks || peaks.length === 0) {
        mappingInfo.innerHTML = '<p>No significant peaks detected.</p>';
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
}

/**
 * Handle play button click
 */
async function handlePlay() {
    if (!currentPeaks || currentPeaks.length === 0) {
        console.warn('No peaks to play');
        return;
    }

    const duration = parseFloat(durationSlider.value);

    try {
        // Disable play button during playback
        playButton.disabled = true;

        // Start audio
        await audioEngine.play(currentPeaks, duration);

        // Start visualization animation
        visualizer.startAudioAnimation();

        console.log(`Playing ${currentPeaks.length} frequencies for ${duration}s`);

        // Re-enable play button after duration
        setTimeout(() => {
            playButton.disabled = false;
            visualizer.stopAudioAnimation();
        }, duration * 1000 + 100);

    } catch (error) {
        console.error('Playback error:', error);
        playButton.disabled = false;
        alert('Error playing audio. Please try again.');
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

    console.log('Playback stopped');
}

/**
 * Handle peak selection change
 * @param {Array} selectedPeaks - Currently selected peaks
 */
function handlePeakSelectionChange(selectedPeaks) {
    const count = selectedPeaks.length;

    if (count === 0) {
        selectionCount.textContent = 'Click peaks on the FTIR spectrum to select them';
        playSelectedButton.disabled = true;
    } else {
        selectionCount.textContent = `${count} peak${count !== 1 ? 's' : ''} selected`;
        playSelectedButton.disabled = false;
    }

    console.log(`Peak selection changed: ${count} peaks selected`);
}

/**
 * Handle play selected peaks button
 */
async function handlePlaySelected() {
    const selectedPeaks = visualizer.getSelectedPeaks();

    if (!selectedPeaks || selectedPeaks.length === 0) {
        console.warn('No peaks selected');
        return;
    }

    const duration = parseFloat(durationSlider.value);

    try {
        // Disable button during playback
        playSelectedButton.disabled = true;

        // Start audio with selected peaks only
        await audioEngine.play(selectedPeaks, duration);

        // Start visualization animation
        visualizer.startAudioAnimation();

        console.log(`Playing ${selectedPeaks.length} selected frequencies for ${duration}s`);

        // Re-enable button after duration
        setTimeout(() => {
            playSelectedButton.disabled = false;
            visualizer.stopAudioAnimation();
        }, duration * 1000 + 100);

    } catch (error) {
        console.error('Playback error:', error);
        playSelectedButton.disabled = false;
        alert('Error playing audio. Please try again.');
    }
}

/**
 * Handle select all peaks button
 */
function handleSelectAll() {
    visualizer.selectAllPeaks();
}

/**
 * Handle clear selection button
 */
function handleClearSelection() {
    visualizer.clearSelection();
}

/**
 * Switch between single and comparison mode
 * @param {boolean} isComparison - True for comparison mode, false for single mode
 */
function switchMode(isComparison) {
    comparisonMode = isComparison;

    if (isComparison) {
        // Switch to comparison mode
        singleModeButton.classList.remove('active');
        comparisonModeButton.classList.add('active');

        singleControls.style.display = 'none';
        document.querySelector('.single-visualization').style.display = 'none';

        comparisonControls.style.display = 'block';
        comparisonVisualization.style.display = 'block';

        console.log('Switched to comparison mode');
    } else {
        // Switch to single mode
        comparisonModeButton.classList.remove('active');
        singleModeButton.classList.add('active');

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
        console.error('Playback error:', error);
        button.disabled = false;
        alert('Error playing audio. Please try again.');
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
        console.error('Playback error:', error);
        playBothSeqButton.disabled = false;
        playBothSimButton.disabled = false;
        alert('Error playing audio. Please try again.');
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
        console.error('Playback error:', error);
        playBothSeqButton.disabled = false;
        playBothSimButton.disabled = false;
        alert('Error playing audio. Please try again.');
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
    visualizerA,
    visualizerB,
    frequencyMapper,
    getCurrentPeaks: () => currentPeaks,
    getCurrentSpectrum: () => currentSpectrum,
    getComparisonMode: () => comparisonMode,
    getSubstanceA: () => substanceA,
    getSubstanceB: () => substanceB
};
