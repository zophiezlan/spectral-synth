/**
 * Playback Controller Module
 *
 * Handles audio playback functionality including play, stop, and peak selection.
 * This module is extracted from app.js for better maintainability.
 *
 * Note: This module currently has high coupling with global dependencies.
 * Future refactoring could use dependency injection or a module pattern
 * to reduce coupling and improve testability.
 */

/* global audioEngine, visualizer, currentPeaks, playButton, durationSlider, substanceSelect,
          selectionCount, clearSelectionButton, Logger, Toast, ScreenReader, ErrorHandler,
          MicroInteractions, iOSAudioHelper, CONSTANTS */

/**
 * Handle play button click
 * Plays audio based on current spectrum peaks or selected peaks
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
