/**
 * MIDI Handlers
 *
 * Wired by event-handlers.js (setupMIDIListeners). Operate on globals
 * (midiOutput, midiInput, currentPeaks, substanceSelect, audioEngine).
 */


import { ctx } from '../core/context.js';
import { dom } from '../ui/dom.js';
import { Toast, ErrorHandler, MicroInteractions } from '../ui/ui-utilities.js';

/**
 * Fill a device dropdown with options.
 * @param {HTMLSelectElement} select
 * @param {Array} devices - {id, name, manufacturer} entries
 * @param {string} placeholderText
 */
function populateDeviceSelect(select, devices, placeholderText) {
    const previous = select.value;
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = devices.length === 0 ? '-- No MIDI devices found --' : placeholderText;
    select.appendChild(placeholder);

    devices.forEach((device) => {
        const option = document.createElement('option');
        option.value = device.id;
        option.textContent = `${device.name} (${device.manufacturer})`;
        select.appendChild(option);
    });

    // Keep the previous selection if the device is still present
    if (previous && devices.some(d => d.id === previous)) {
        select.value = previous;
    }
}

/**
 * Refresh the MIDI device lists (output + input) and repopulate the dropdowns.
 */
export async function refreshMIDIDevices() {
    const midiDeviceSelect = document.getElementById('midi-device-select');
    if (!midiDeviceSelect) return;

    if (!ctx.midiOutput || !ctx.midiOutput.isSupported()) {
        Toast.warning('Web MIDI API is not supported in your browser', 4000);
        return;
    }

    try {
        if (!ctx.midiOutput.midiAccess) {
            await ctx.midiOutput.init();
        }

        const devices = ctx.midiOutput.getOutputDevices();
        populateDeviceSelect(midiDeviceSelect, devices, '-- Select MIDI Device --');

        // Input devices (MIDI keyboard) share the same MIDIAccess
        let inputCount = 0;
        const midiInputSelect = document.getElementById('midi-input-select');
        if (midiInputSelect && ctx.midiInput) {
            if (!ctx.midiInput.midiAccess) {
                await ctx.midiInput.init(ctx.midiOutput.midiAccess);
            }
            const inputDevices = ctx.midiInput.getInputDevices();
            inputCount = inputDevices.length;
            populateDeviceSelect(midiInputSelect, inputDevices, '-- Select MIDI Input --');
        }

        if (devices.length === 0 && inputCount === 0) {
            Toast.info('No MIDI devices found. Connect a MIDI device and refresh.', 3000);
            return;
        }

        Toast.success(`Found ${devices.length} output and ${inputCount} input MIDI device(s)`, 2000);
    } catch (error) {
        ErrorHandler.handle(error, `Failed to access MIDI devices: ${error.message}`);
    }
}

/**
 * Handle the MIDI-input enable checkbox.
 * Initializes the audio engine on first enable (user gesture unlocks audio).
 * @param {Event} e
 */
export async function handleMIDIInputEnabled(e) {
    if (!ctx.midiInput) return;

    if (e.target.checked) {
        try {
            await ctx.audioEngine.init();
            if (!ctx.midiInput.midiAccess) {
                if (!ctx.midiOutput.midiAccess) await ctx.midiOutput.init();
                await ctx.midiInput.init(ctx.midiOutput.midiAccess);
            }
            ctx.midiInput.setEnabled(true);
            if (!ctx.midiInput.hasSelectedDevice()) {
                Toast.info('MIDI input enabled — select an input device to start playing', 3000);
            } else {
                Toast.success('MIDI input enabled. C4 plays the spectrum at native pitch.', 3000);
            }
        } catch (error) {
            e.target.checked = false;
            ErrorHandler.handle(error, `Failed to enable MIDI input: ${error.message}`);
        }
    } else {
        ctx.midiInput.setEnabled(false);
    }
}

/**
 * Update enabled state of the send-MIDI and export-MIDI buttons based on
 * whether peaks are loaded and a device is selected.
 */
export function updateMIDISendButton() {
    const sendButton = document.getElementById('send-midi-notes');
    const exportButton = document.getElementById('export-midi-file');
    const hasPeaks = !!(ctx.currentPeaks && ctx.currentPeaks.length > 0);

    if (sendButton) {
        sendButton.disabled = !hasPeaks || !ctx.midiOutput || !ctx.midiOutput.hasSelectedDevice();
    }

    // MIDI file export doesn't require a connected device.
    if (exportButton) {
        exportButton.disabled = !hasPeaks || !ctx.midiOutput;
    }
}

/**
 * Send the current peaks as a MIDI chord to the selected device.
 */
export async function handleSendMIDI() {
    if (!ctx.midiOutput || !ctx.midiOutput.hasSelectedDevice()) {
        Toast.warning('Please select a MIDI output device first');
        return;
    }

    if (!ctx.currentPeaks || ctx.currentPeaks.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    const sendButton = document.getElementById('send-midi-notes');
    try {
        if (sendButton) sendButton.disabled = true;

        await ctx.midiOutput.sendPeaks(ctx.currentPeaks, 'chord');

        Toast.success(`Sent ${ctx.currentPeaks.length} MIDI notes to device`, 2000);

        setTimeout(() => {
            if (sendButton) sendButton.disabled = false;
        }, ctx.midiOutput.noteDuration + 100);
    } catch (error) {
        if (sendButton) sendButton.disabled = false;
        ErrorHandler.handle(error, `Failed to send MIDI notes: ${error.message}`);
    }
}

/**
 * Export the current peaks as a Standard MIDI File (.mid).
 * Uses the active audio playback mode and the MIDI tempo slider.
 */
export async function handleExportMIDIFile() {
    if (!ctx.currentPeaks || ctx.currentPeaks.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    if (!ctx.midiOutput) {
        Toast.error('MIDI output not available');
        return;
    }

    const exportButton = document.getElementById('export-midi-file');
    try {
        if (exportButton) {
            exportButton.disabled = true;
            exportButton.textContent = '⏳ Exporting...';
        }

        const mode = ctx.audioEngine.getPlaybackMode();
        const tempoSlider = document.getElementById('midi-tempo');
        const tempo = tempoSlider ? parseInt(tempoSlider.value, 10) : 120;
        const substanceName = dom.substanceSelect.options[dom.substanceSelect.selectedIndex].text;
        const filename = `${substanceName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${mode}.mid`;

        ctx.midiOutput.exportMIDIFile(ctx.currentPeaks, mode, tempo, filename);

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
