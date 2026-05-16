/**
 * MIDI Handlers
 *
 * Wired by event-handlers.js (setupMIDIListeners). Operate on globals
 * (midiOutput, currentPeaks, substanceSelect, audioEngine).
 */

/* global midiOutput, currentPeaks, substanceSelect, audioEngine,
          Toast, ErrorHandler, MicroInteractions */

/**
 * Refresh the MIDI device list and repopulate the dropdown.
 */
async function refreshMIDIDevices() {
    const midiDeviceSelect = document.getElementById('midi-device-select');
    if (!midiDeviceSelect) return;

    if (!midiOutput || !midiOutput.isSupported()) {
        Toast.warning('Web MIDI API is not supported in your browser', 4000);
        return;
    }

    try {
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
            return;
        }

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- Select MIDI Device --';
        midiDeviceSelect.appendChild(placeholder);

        devices.forEach((device) => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = `${device.name} (${device.manufacturer})`;
            midiDeviceSelect.appendChild(option);
        });

        Toast.success(`Found ${devices.length} MIDI device(s)`, 2000);
    } catch (error) {
        ErrorHandler.handle(error, `Failed to access MIDI devices: ${error.message}`);
    }
}

/**
 * Update enabled state of the send-MIDI and export-MIDI buttons based on
 * whether peaks are loaded and a device is selected.
 */
function updateMIDISendButton() {
    const sendButton = document.getElementById('send-midi-notes');
    const exportButton = document.getElementById('export-midi-file');
    const hasPeaks = !!(currentPeaks && currentPeaks.length > 0);

    if (sendButton) {
        sendButton.disabled = !hasPeaks || !midiOutput || !midiOutput.hasSelectedDevice();
    }

    // MIDI file export doesn't require a connected device.
    if (exportButton) {
        exportButton.disabled = !hasPeaks || !midiOutput;
    }
}

/**
 * Send the current peaks as a MIDI chord to the selected device.
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

    const sendButton = document.getElementById('send-midi-notes');
    try {
        if (sendButton) sendButton.disabled = true;

        await midiOutput.sendPeaks(currentPeaks, 'chord');

        Toast.success(`Sent ${currentPeaks.length} MIDI notes to device`, 2000);

        setTimeout(() => {
            if (sendButton) sendButton.disabled = false;
        }, midiOutput.noteDuration + 100);
    } catch (error) {
        if (sendButton) sendButton.disabled = false;
        ErrorHandler.handle(error, `Failed to send MIDI notes: ${error.message}`);
    }
}

/**
 * Export the current peaks as a Standard MIDI File (.mid).
 * Uses the active audio playback mode and the MIDI tempo slider.
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

    const exportButton = document.getElementById('export-midi-file');
    try {
        if (exportButton) {
            exportButton.disabled = true;
            exportButton.textContent = '⏳ Exporting...';
        }

        const mode = audioEngine.getPlaybackMode();
        const tempoSlider = document.getElementById('midi-tempo');
        const tempo = tempoSlider ? parseInt(tempoSlider.value, 10) : 120;
        const substanceName = substanceSelect.options[substanceSelect.selectedIndex].text;
        const filename = `${substanceName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${mode}.mid`;

        midiOutput.exportMIDIFile(currentPeaks, mode, tempo, filename);

        Toast.success(`Exported MIDI file: ${filename}`, 3000);
        MicroInteractions.celebrate(`First MIDI export! Successfully exported: ${filename}`);
    } catch (error) {
        ErrorHandler.handle(error, `Failed to export MIDI file: ${error.message}`);
    } finally {
        if (exportButton) {
            exportButton.disabled = false;
            exportButton.textContent = '💾 Export MIDI File';
        }
    }
}
