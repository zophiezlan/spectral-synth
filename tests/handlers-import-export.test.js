/**
 * Unit Tests for handlers-import-export.js
 *
 * Covers the helpers (enableExportButton, withExportButton) and the early-exit
 * paths of the public handlers. The happy paths involve CSVImporter,
 * JCAMPImporter, audioEngine.exportWAV/MP3, FilterManager.setLibrary and
 * handleSubstanceChange — those are exercised in higher-level integration tests
 * (and in their own unit files: csv-importer, jcamp-importer, audio-engine).
 */

const { loadBrowserModule } = require('./test-helpers');

function loadHandlers({ peaks = null, lamejsDefined = false } = {}) {
    const Toast = {
        info: jest.fn(),
        success: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
    };
    const ErrorHandler = { handle: jest.fn() };
    const MicroInteractions = { celebrate: jest.fn() };
    const LoadingOverlay = { show: jest.fn(), hide: jest.fn() };

    const globals = {
        document,
        window,
        Event,
        currentPeaks: peaks,
        durationSlider: document.getElementById('duration'),
        substanceSelect: document.getElementById('substance'),
        Toast,
        ErrorHandler,
        MicroInteractions,
        LoadingOverlay,
    };
    if (lamejsDefined) {
        globals.lamejs = {};
    }

    const exported = loadBrowserModule('handlers-import-export.js', globals);
    return { ...exported, Toast, ErrorHandler, MicroInteractions, LoadingOverlay };
}

function setupDOM() {
    document.body.innerHTML = `
        <input id="duration" type="range" value="2" />
        <select id="substance">
            <option value="">--</option>
            <option value="0" selected>Caffeine</option>
        </select>
        <button id="export-wav" disabled>💾 Export WAV</button>
        <button id="export-mp3" disabled>🎵 Export MP3</button>
    `;
}

describe('enableExportButton', () => {
    beforeEach(setupDOM);

    it('enables the button when it exists', () => {
        const { enableExportButton } = loadHandlers();
        enableExportButton('export-wav');
        expect(document.getElementById('export-wav').disabled).toBe(false);
    });

    it('is a no-op when the button is missing', () => {
        const { enableExportButton } = loadHandlers();
        expect(() => enableExportButton('does-not-exist')).not.toThrow();
    });
});

describe('withExportButton', () => {
    beforeEach(setupDOM);

    it('cycles the button label busy → idle around a successful run', async () => {
        const { withExportButton, ErrorHandler } = loadHandlers();
        const btn = document.getElementById('export-wav');
        const run = jest.fn().mockResolvedValue();

        await withExportButton('export-wav', '⏳ Exporting', '💾 Done', run, 'oops');

        expect(run).toHaveBeenCalled();
        expect(btn.textContent).toBe('💾 Done');
        expect(btn.disabled).toBe(false);
        expect(ErrorHandler.handle).not.toHaveBeenCalled();
    });

    it('restores the button label and reports through ErrorHandler on failure', async () => {
        const { withExportButton, ErrorHandler } = loadHandlers();
        const btn = document.getElementById('export-wav');
        const boom = new Error('boom');
        const run = jest.fn().mockRejectedValue(boom);

        await withExportButton('export-wav', '⏳ Exporting', '💾 Done', run, 'failed');

        expect(btn.disabled).toBe(false);
        expect(btn.textContent).toBe('💾 Done');
        expect(ErrorHandler.handle).toHaveBeenCalledWith(boom, expect.stringContaining('failed'));
    });

    it('always hides the loading overlay', async () => {
        const { withExportButton, LoadingOverlay } = loadHandlers();
        await withExportButton('export-wav', 'a', 'b', async () => { throw new Error('x'); }, 'pre');
        expect(LoadingOverlay.hide).toHaveBeenCalled();
    });

    it('handles a missing button without throwing', async () => {
        const { withExportButton } = loadHandlers();
        const run = jest.fn().mockResolvedValue();

        await withExportButton('ghost', 'a', 'b', run, 'pre');

        expect(run).toHaveBeenCalled();
    });
});

describe('handleExportWAV — early exits', () => {
    beforeEach(setupDOM);

    it('warns and returns when no peaks are loaded', async () => {
        const { handleExportWAV, Toast } = loadHandlers({ peaks: null });

        await handleExportWAV();

        expect(Toast.warning).toHaveBeenCalledWith('Please select a substance first');
    });

    it('warns when peaks is empty array', async () => {
        const { handleExportWAV, Toast } = loadHandlers({ peaks: [] });

        await handleExportWAV();

        expect(Toast.warning).toHaveBeenCalled();
    });
});

describe('handleExportMP3 — early exits', () => {
    beforeEach(setupDOM);

    it('warns when no peaks are loaded', async () => {
        const { handleExportMP3, Toast } = loadHandlers({ peaks: null, lamejsDefined: true });

        await handleExportMP3();

        expect(Toast.warning).toHaveBeenCalledWith('Please select a substance first');
    });

    it('errors when lamejs is missing', async () => {
        const { handleExportMP3, Toast } = loadHandlers({
            peaks: [{ frequency: 1000, intensity: 0.5 }],
            lamejsDefined: false,
        });

        await handleExportMP3();

        expect(Toast.error).toHaveBeenCalledWith(
            expect.stringContaining('lamejs'),
            expect.any(Number)
        );
    });
});
