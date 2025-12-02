/**
 * Main Application - Spectral Synthesizer
 *
 * Coordinates between UI, data, audio engine, and visualization
 */

// Global instances
let audioEngine;
let visualizer;
let frequencyMapper;
let currentSpectrum = null;
let currentPeaks = null;

// DOM elements
const substanceSelect = document.getElementById('substance');
const playButton = document.getElementById('play');
const stopButton = document.getElementById('stop');
const durationSlider = document.getElementById('duration');
const durationValue = document.getElementById('duration-value');
const volumeSlider = document.getElementById('volume');
const volumeValue = document.getElementById('volume-value');
const mappingInfo = document.getElementById('mapping-info');
const ftirCanvas = document.getElementById('ftir-canvas');
const audioCanvas = document.getElementById('audio-canvas');

/**
 * Initialize application
 */
function init() {
    // Create instances
    audioEngine = new AudioEngine();
    visualizer = new Visualizer(ftirCanvas, audioCanvas);
    visualizer.setAudioEngine(audioEngine);
    frequencyMapper = new FrequencyMapper();

    // Set up event listeners
    setupEventListeners();

    console.log('🎵 Spectral Synthesizer initialized');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Substance selection
    substanceSelect.addEventListener('change', handleSubstanceChange);

    // Playback controls
    playButton.addEventListener('click', handlePlay);
    stopButton.addEventListener('click', handleStop);

    // Sliders
    durationSlider.addEventListener('input', (e) => {
        durationValue.textContent = parseFloat(e.target.value).toFixed(1);
    });

    volumeSlider.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value) / 100;
        volumeValue.textContent = e.target.value;
        audioEngine.setVolume(volume);
    });
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
        playButton.disabled = true;
        stopButton.disabled = true;
        mappingInfo.innerHTML = '<p>Select a substance to see how infrared frequencies map to audio frequencies.</p>';
        return;
    }

    // Load spectrum data
    const data = getSpectrum(substanceId);
    if (!data) {
        console.error('Spectrum not found:', substanceId);
        return;
    }

    currentSpectrum = data.spectrum;

    // Extract peaks for sonification
    currentPeaks = frequencyMapper.extractPeaks(currentSpectrum);

    console.log(`Loaded ${data.name}:`, currentPeaks.length, 'peaks detected');

    // Update visualizations
    visualizer.drawFTIRSpectrum(currentSpectrum, currentPeaks);

    // Update mapping info with annotations
    updateMappingInfo(data, currentPeaks);

    // Enable playback
    playButton.disabled = false;
    stopButton.disabled = false;
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

    console.log('Playback stopped');
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
