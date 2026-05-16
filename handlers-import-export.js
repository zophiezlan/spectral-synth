/**
 * Import/Export Handlers
 *
 * Wired by event-handlers.js (setupImportExportListeners). Operate on globals
 * (libraryData, audioEngine, currentPeaks, durationSlider, substanceSelect) and
 * delegate selector population to FilterManager.
 */

/* global libraryData, audioEngine, currentPeaks, durationSlider, substanceSelect,
          CSVImporter, JCAMPImporter, FilterManager, LoadingOverlay, Toast,
          ErrorHandler, MicroInteractions, handleSubstanceChange, lamejs */

/**
 * Enable a button by id, if present.
 */
function enableExportButton(id) {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = false;
}

/**
 * Handle CSV import (file input 'change')
 * @param {Event} e
 */
async function handleCSVImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        LoadingOverlay.show(`Importing ${file.name}...`);

        const data = await CSVImporter.parseCSV(file);
        CSVImporter.validate(data);

        libraryData.push(data);
        FilterManager.setLibrary(libraryData);

        substanceSelect.value = libraryData.length - 1;
        handleSubstanceChange();

        enableExportButton('export-wav');

        LoadingOverlay.hide();
        Toast.success(`Successfully imported: ${data.name} (${data.metadata.finalPoints} data points)`);
    } catch (error) {
        LoadingOverlay.hide();
        ErrorHandler.handle(
            error,
            `Failed to import CSV: ${error.message}\n\nPlease ensure your CSV has two columns:\nwavenumber,transmittance\n\nDownload the template for an example.`
        );
    }

    e.target.value = '';
}

/**
 * Handle JCAMP-DX import (file input 'change')
 * @param {Event} e
 */
async function handleJCAMPImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        LoadingOverlay.show(`Importing JCAMP-DX: ${file.name}...`);

        const data = await JCAMPImporter.parseJCAMP(file);
        JCAMPImporter.validate(data);

        data.id = libraryData.length.toString();
        libraryData.push(data);
        FilterManager.setLibrary(libraryData);

        substanceSelect.value = data.id;
        handleSubstanceChange();

        enableExportButton('export-wav');
        enableExportButton('export-mp3');

        LoadingOverlay.hide();
        Toast.success(`Successfully imported JCAMP-DX: ${data.name} (${data.metadata.finalPoints} data points)`);
    } catch (error) {
        LoadingOverlay.hide();
        ErrorHandler.handle(
            error,
            `Failed to import JCAMP-DX: ${error.message}\n\nPlease ensure your file is a valid JCAMP-DX format (.jdx, .dx, or .jcamp).`
        );
    }

    e.target.value = '';
}

/**
 * Render an export-button busy/done cycle.
 * @param {string} id Export button DOM id
 * @param {string} busyLabel Label while operation runs
 * @param {string} idleLabel Label after operation completes
 * @param {() => Promise<void>} run Async operation
 * @param {string} errorPrefix User-facing prefix for errors
 */
async function withExportButton(id, busyLabel, idleLabel, run, errorPrefix) {
    const btn = document.getElementById(id);
    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = busyLabel;
        }
        await run();
    } catch (error) {
        ErrorHandler.handle(error, `${errorPrefix}: ${error.message}`);
    } finally {
        LoadingOverlay.hide();
        if (btn) {
            btn.disabled = false;
            btn.textContent = idleLabel;
        }
    }
}

/**
 * Handle WAV export (button click)
 */
async function handleExportWAV() {
    if (!currentPeaks || currentPeaks.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    const duration = parseFloat(durationSlider.value);
    const substanceName = substanceSelect.options[substanceSelect.selectedIndex].text;
    const filename = `${substanceName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${duration}s.wav`;

    await withExportButton(
        'export-wav',
        '⏳ Exporting...',
        '💾 Export WAV',
        async () => {
            LoadingOverlay.show(`Rendering audio: ${filename}`);
            await audioEngine.exportWAV(currentPeaks, duration, filename);
            MicroInteractions.celebrate(`First export! Successfully exported: ${filename}`);
        },
        'Failed to export audio'
    );
}

/**
 * Handle MP3 export (button click). Requires lamejs to be loaded.
 */
async function handleExportMP3() {
    if (!currentPeaks || currentPeaks.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    if (typeof lamejs === 'undefined') {
        Toast.error('MP3 export requires the lamejs library. Please ensure the library is loaded.', 5000);
        return;
    }

    const duration = parseFloat(durationSlider.value);
    const substanceName = substanceSelect.options[substanceSelect.selectedIndex].text;
    const filename = `${substanceName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${duration}s.mp3`;

    await withExportButton(
        'export-mp3',
        '⏳ Encoding MP3...',
        '🎵 Export MP3',
        async () => {
            LoadingOverlay.show(`Encoding MP3: ${filename}`);
            await audioEngine.exportMP3(currentPeaks, duration, filename, 128);
            MicroInteractions.celebrate(`First MP3 export! Successfully exported: ${filename}`);
        },
        'Failed to export MP3'
    );
}
