/**
 * Import/Export Handlers Module
 * 
 * Handles all import and export operations:
 * - CSV import
 * - JCAMP-DX import
 * - WAV export
 * - MP3 export
 * 
 * Dependencies: CSVImporter, JCAMPImporter, MP3Encoder, audioEngine, 
 *               LoadingOverlay, Toast, ErrorHandler, MicroInteractions
 */

/**
 * Handle CSV import
 * @param {Event} e - File input change event
 * @param {Object} context - Application context with libraryData, selectors, and handlers
 */
async function handleCSVImport(e, context) {
    const file = e.target.files[0];
    if (!file) return;

    const { libraryData, substanceSelect, populateSubstanceSelector, handleSubstanceChange } = context;

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
 * Handle JCAMP-DX import
 * @param {Event} e - File input change event
 * @param {Object} context - Application context
 */
async function handleJCAMPImport(e, context) {
    const file = e.target.files[0];
    if (!file) return;

    const { libraryData, substanceSelect, populateSubstanceSelector, handleSubstanceChange } = context;

    try {
        LoadingOverlay.show(`Importing ${file.name}...`);

        const data = await JCAMPImporter.parseJCAMP(file);
        JCAMPImporter.validate(data);

        // Add to library
        libraryData.push(data);

        // Repopulate selector
        populateSubstanceSelector();

        // Auto-select the imported substance
        substanceSelect.value = libraryData.length - 1;
        handleSubstanceChange();

        LoadingOverlay.hide();
        Toast.success(`Successfully imported: ${data.name} (${data.spectrum.length} data points)`);
    } catch (error) {
        LoadingOverlay.hide();
        ErrorHandler.handle(
            error,
            `Failed to import JCAMP-DX: ${error.message}\n\nPlease ensure the file is in JCAMP-DX format.`
        );
    }

    // Clear the file input so the same file can be imported again
    e.target.value = '';
}

/**
 * Handle WAV export
 * @param {Object} context - Application context with currentPeaks, audioEngine, etc.
 */
async function handleExportWAV(context) {
    const { currentPeaks, durationSlider, substanceSelect, audioEngine } = context;

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
 * Handle MP3 export
 * @param {Object} context - Application context
 */
async function handleExportMP3(context) {
    const { currentPeaks, durationSlider, substanceSelect, audioEngine } = context;

    if (!currentPeaks || currentPeaks.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    // Check if MP3Encoder is available
    if (typeof MP3Encoder === 'undefined') {
        Toast.error('MP3 encoder not loaded. Please refresh the page.');
        return;
    }

    const duration = parseFloat(durationSlider.value);
    const substanceName = substanceSelect.options[substanceSelect.selectedIndex].text;
    const filename = `${substanceName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${duration}s.mp3`;

    try {
        const exportButton = document.getElementById('export-mp3');
        exportButton.disabled = true;
        exportButton.textContent = '⏳ Encoding...';

        LoadingOverlay.show(`Encoding MP3: ${filename}`);

        // Render audio to buffer first
        const audioBuffer = await audioEngine.renderToBuffer(currentPeaks, duration);

        // Encode to MP3
        const mp3Blob = await MP3Encoder.encode(audioBuffer);

        // Download
        const url = URL.createObjectURL(mp3Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        LoadingOverlay.hide();
        exportButton.disabled = false;
        exportButton.textContent = '🎵 Export MP3';

        Toast.success(`Successfully exported: ${filename}`);
    } catch (error) {
        LoadingOverlay.hide();
        const exportButton = document.getElementById('export-mp3');
        exportButton.disabled = false;
        exportButton.textContent = '🎵 Export MP3';

        ErrorHandler.handle(error, `Failed to export MP3: ${error.message}`);
    }
}
