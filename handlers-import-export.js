/**
 * Import/Export Handlers
 *
 * Wired by event-handlers.js (setupImportExportListeners). Operate on globals
 * (libraryData, audioEngine, currentPeaks, durationSlider, substanceSelect) and
 * delegate selector population to FilterManager.
 */

/* global libraryData, audioEngine, currentPeaks, currentSpectrum, durationSlider,
          substanceSelect, frequencyMapper, midiOutput,
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
 * Trigger a browser download of generated content.
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Filesystem-safe slug of the selected substance's display name.
 * @returns {string}
 */
function selectedSubstanceSlug() {
    const name = substanceSelect.options[substanceSelect.selectedIndex].text;
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Find the full library record for the selected substance (null for
 * cleared selection).
 * @returns {Object|null}
 */
function selectedSubstanceRecord() {
    const id = substanceSelect.value;
    if (!id || !libraryData) return null;
    return libraryData.find(item => item.id === id) || null;
}

/**
 * Build the peak table rows shared by the CSV and JSON data exports.
 * @returns {Array<Object>}
 */
function buildPeakTable() {
    return currentPeaks.map(peak => {
        const midi = midiOutput
            ? midiOutput.frequencyToMIDI(peak.audioFreq)
            : { note: null, cents: null };
        return {
            wavenumber_cm1: Number(peak.wavenumber.toFixed(2)),
            absorbance: Number(peak.absorbance.toFixed(4)),
            prominence: peak.prominence !== undefined ? Number(peak.prominence.toFixed(4)) : null,
            width_cm1: peak.width !== undefined ? Number(peak.width.toFixed(2)) : null,
            audio_freq_hz: Number(peak.audioFreq.toFixed(2)),
            midi_note: midi.note,
            cents_offset: midi.cents !== null ? Number(midi.cents.toFixed(1)) : null,
            functional_group: frequencyMapper.getFunctionalGroup(peak.wavenumber)
        };
    });
}

/**
 * Export the current peak table as CSV.
 */
function handleExportPeaksCSV() {
    if (!currentPeaks || currentPeaks.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    try {
        const rows = buildPeakTable();
        const columns = Object.keys(rows[0]);
        const csv = [
            columns.join(','),
            ...rows.map(row => columns.map(c => {
                const v = row[c];
                if (v === null) return '';
                // Quote the functional group — it can contain commas
                return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v;
            }).join(','))
        ].join('\n');

        const filename = `${selectedSubstanceSlug()}_peaks.csv`;
        downloadFile(csv, filename, 'text/csv');
        Toast.success(`Exported peak table: ${filename}`, 3000);
    } catch (error) {
        ErrorHandler.handle(error, `Failed to export peak table: ${error.message}`);
    }
}

/**
 * Export the current peak analysis as JSON with full provenance:
 * substance metadata, mapping parameters, and detection settings, so the
 * result is reproducible and citable.
 */
function handleExportPeaksJSON() {
    if (!currentPeaks || currentPeaks.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    try {
        const record = selectedSubstanceRecord();
        const payload = {
            exportedBy: 'Spectral Synthesizer',
            exportedAt: new Date().toISOString(),
            substance: record ? {
                id: record.id,
                name: record.name,
                formula: record.formula || null,
                mw: record.mw || null,
                casName: record.casName || null,
                category: record.category || null,
                source: record.source || null
            } : { name: substanceSelect.options[substanceSelect.selectedIndex].text },
            mapping: {
                irRange_cm1: [frequencyMapper.IR_MIN, frequencyMapper.IR_MAX],
                audioRange_hz: [frequencyMapper.AUDIO_MIN, frequencyMapper.AUDIO_MAX],
                scale: 'logarithmic'
            },
            peakDetection: {
                threshold: frequencyMapper.DEFAULT_THRESHOLD,
                maxPeaks: frequencyMapper.DEFAULT_MAX_PEAKS,
                minProminence: frequencyMapper.MIN_PROMINENCE,
                method: 'prominence-based local maxima, width at half prominence'
            },
            peaks: buildPeakTable()
        };

        const filename = `${selectedSubstanceSlug()}_peaks.json`;
        downloadFile(JSON.stringify(payload, null, 2), filename, 'application/json');
        Toast.success(`Exported peak analysis: ${filename}`, 3000);
    } catch (error) {
        ErrorHandler.handle(error, `Failed to export peak analysis: ${error.message}`);
    }
}

/**
 * Export the current spectrum as CSV (wavenumber,transmittance) —
 * round-trippable with the CSV importer.
 */
function handleExportSpectrumCSV() {
    if (!currentSpectrum || currentSpectrum.length === 0) {
        Toast.warning('Please select a substance first');
        return;
    }

    try {
        const csv = [
            'wavenumber,transmittance',
            ...currentSpectrum.map(p => `${Number(p.wavenumber.toFixed(2))},${Number(p.transmittance.toFixed(2))}`)
        ].join('\n');

        const filename = `${selectedSubstanceSlug()}_spectrum.csv`;
        downloadFile(csv, filename, 'text/csv');
        Toast.success(`Exported spectrum: ${filename}`, 3000);
    } catch (error) {
        ErrorHandler.handle(error, `Failed to export spectrum: ${error.message}`);
    }
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
