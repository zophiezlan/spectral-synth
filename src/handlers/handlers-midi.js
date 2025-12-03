/**
 * MIDI Handlers Module
 *
 * Handles all MIDI-related operations:
 * - Device refresh and selection
 * - MIDI note sending
 * - MIDI file export
 *
 * Dependencies: midiOutput, Toast, ErrorHandler, LoadingOverlay
 */

/**
 * Refresh MIDI devices list
 * @param {Object} context - Application context with midiOutput
 */
async function refreshMIDIDevices(context) {
    const { midiOutput } = context;

    if (!midiOutput) {
        Toast.warning('MIDI not supported in this browser');
        return;
    }

    try {
        await midiOutput.refreshDevices();

        const devices = midiOutput.getOutputDevices();
        const deviceSelect = document.getElementById('midi-device-select');

        if (!deviceSelect) {
            return;
        }

        // Clear existing options
        deviceSelect.innerHTML = '<option value="">Select MIDI device...</option>';

        // Add devices
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = `${device.name} ${device.manufacturer ? `(${device.manufacturer})` : ''}`;
            deviceSelect.appendChild(option);
        });

        if (devices.length === 0) {
            Toast.info('No MIDI devices found. Please connect a MIDI device and refresh.');
        } else {
            Toast.success(`Found ${devices.length} MIDI device(s)`);
        }

        updateMIDISendButton(context);
    } catch (error) {
        ErrorHandler.handle(error, 'Failed to refresh MIDI devices');
    }
}

/**
 * Update MIDI send button state
 * @param {Object} context - Application context
 */
function updateMIDISendButton(context) {
    const { midiOutput } = context;
    const sendButton = document.getElementById('send-midi-notes');

    if (!sendButton) {
        return;
    }

    if (midiOutput && midiOutput.isOutputSelected()) {
        sendButton.disabled = false;
        sendButton.textContent = '🎹 Send MIDI Notes';
    } else {
        sendButton.disabled = true;
        sendButton.textContent = '🎹 Send MIDI Notes (Select device first)';
    }
}

/**
 * Handle sending MIDI notes
 * @param {Object} context - Application context
 */
async function handleSendMIDI(context) {
    const { midiOutput, currentPeaks } = context;

    if (!midiOutput || !midiOutput.isOutputSelected()) {
        Toast.warning('Please select a MIDI device first');
        return;
    }

    if (!currentPeaks || currentPeaks.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    try {
        const sendButton = document.getElementById('send-midi-notes');
        sendButton.disabled = true;
        sendButton.textContent = '⏳ Sending...';

        await midiOutput.sendPeaksAsMIDI(currentPeaks);

        sendButton.disabled = false;
        sendButton.textContent = '🎹 Send MIDI Notes';

        Toast.success(`Sent ${currentPeaks.length} MIDI notes`);
    } catch (error) {
        const sendButton = document.getElementById('send-midi-notes');
        sendButton.disabled = false;
        sendButton.textContent = '🎹 Send MIDI Notes';

        ErrorHandler.handle(error, 'Failed to send MIDI notes');
    }
}

/**
 * Handle MIDI file export
 * @param {Object} context - Application context
 */
async function handleExportMIDIFile(context) {
    const { midiOutput, currentPeaks, substanceSelect } = context;

    if (!midiOutput) {
        Toast.warning('MIDI not available');
        return;
    }

    if (!currentPeaks || currentPeaks.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    try {
        const exportButton = document.getElementById('export-midi-file');
        exportButton.disabled = true;
        exportButton.textContent = '⏳ Exporting...';

        const substanceName = substanceSelect.options[substanceSelect.selectedIndex].text;
        const filename = `${substanceName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mid`;

        // Get tempo from slider
        const midiTempoSlider = document.getElementById('midi-tempo');
        const tempo = midiTempoSlider ? parseInt(midiTempoSlider.value) : 120;

        await midiOutput.exportMIDIFile(currentPeaks, filename, tempo);

        exportButton.disabled = false;
        exportButton.textContent = '📁 Export MIDI File';

        Toast.success(`Successfully exported: ${filename}`);
    } catch (error) {
        const exportButton = document.getElementById('export-midi-file');
        exportButton.disabled = false;
        exportButton.textContent = '📁 Export MIDI File';

        ErrorHandler.handle(error, 'Failed to export MIDI file');
    }
}
