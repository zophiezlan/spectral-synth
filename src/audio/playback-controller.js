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


import { ctx } from '../core/context.js';
import { Logger } from '../core/logger.js';
import { dom } from '../ui/dom.js';
import { Toast, ScreenReader, ErrorHandler, MicroInteractions, iOSAudioHelper } from '../ui/ui-utilities.js';

/**
 * Handle play button click
 * Plays audio based on current spectrum peaks or selected peaks
 */
export async function handlePlay() {
    // If currently playing, stop instead
    if (ctx.audioEngine.isPlaying) {
        ctx.audioEngine.stop();
        ctx.visualizer.stopAudioAnimation();
        dom.playButton.textContent = '▶ Play Sound';
        dom.playButton.disabled = false;
        ScreenReader.announce('Playback stopped');
        Logger.log('Playback stopped');
        return;
    }

    if (!ctx.currentPeaks || ctx.currentPeaks.length === 0) {
        Logger.warn('No peaks to play');
        Toast.warning('No peaks detected for this substance');
        return;
    }

    // Use selected peaks if any exist, otherwise use all peaks
    const selectedPeaks = ctx.visualizer.getSelectedPeaks();
    const peaksToPlay = (selectedPeaks && selectedPeaks.length > 0) ? selectedPeaks : ctx.currentPeaks;

    const duration = parseFloat(dom.durationSlider.value);

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
        dom.playButton.textContent = '■ Stop';

        // Add pulse effect to play button
        MicroInteractions.pulse(dom.playButton, duration * 1000);

        // Ensure audio context is active (especially for iOS)
        await iOSAudioHelper.ensureAudioContext(ctx.audioEngine);

        // Reset UI when playback actually ends. A fixed duration timer is
        // wrong here: looping arpeggios keep playing past `duration`, which
        // used to freeze the FFT after the first cycle while audio continued.
        ctx.audioEngine.onPlaybackEnded = () => {
            dom.playButton.textContent = '▶ Play Sound';
            ctx.visualizer.stopAudioAnimation();
            ScreenReader.announce('Playback finished');
        };

        // Start audio with selected or all peaks
        await ctx.audioEngine.play(peaksToPlay, duration);

        // Start visualization animation
        ctx.visualizer.startAudioAnimation();

        // Announce to screen reader
        const substanceName = dom.substanceSelect.options[dom.substanceSelect.selectedIndex].text;
        const peakCountMsg = (selectedPeaks && selectedPeaks.length > 0) ?
            `${selectedPeaks.length} selected peaks` : `${ctx.currentPeaks.length} peaks`;
        ScreenReader.announce(
            `Playing ${substanceName}, ${peakCountMsg}, duration ${duration} seconds`
        );

        Logger.log(`Playing ${peaksToPlay.length} frequencies${(selectedPeaks && selectedPeaks.length > 0) ? ' (selected)' : ''} for ${duration}s`);
    } catch (error) {
        dom.playButton.textContent = '▶ Play Sound';
        ctx.visualizer.stopAudioAnimation();

        ErrorHandler.handle(
            error,
            `Error playing audio: ${error.message || 'Unknown error'}. Please try again or refresh the page.`
        );
    }
}

/**
 * Handle stop button click
 */
export function handleStop() {
    if (ctx.audioEngine.isPlaying) {
        ctx.audioEngine.stop();
        ctx.visualizer.stopAudioAnimation();
        dom.playButton.textContent = '▶ Play Sound';
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
export function handlePeakSelectionChange(selectedPeaks) {
    const count = selectedPeaks.length;
    const clearBtn = dom.clearSelectionButton;

    if (count === 0) {
        dom.selectionCount.textContent = 'Click peaks to isolate them';
        if (clearBtn) clearBtn.classList.add('hidden');
    } else {
        dom.selectionCount.textContent = `${count} peak${count !== 1 ? 's' : ''} selected`;
        if (clearBtn) clearBtn.classList.remove('hidden');
    }

    Logger.log(`Peak selection changed: ${count} peaks selected`);
}

/**
 * Handle clear selection button
 * Clears all selected peaks and returns to playing all peaks.
 */
export function handleClearSelection() {
    ctx.visualizer.clearSelection();
}

/**
 * Handle select all peaks button
 * Selects all detected peaks in the current spectrum.
 */
export function handleSelectAll() {
    if (!ctx.visualizer || !ctx.currentPeaks || ctx.currentPeaks.length === 0) {
        Logger.warn('No peaks to select');
        return;
    }
    ctx.visualizer.selectAllPeaks();
    Logger.log(`Selected all ${ctx.currentPeaks.length} peaks`);
}
