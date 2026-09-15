/**
 * Menu Modals
 *
 * Open/close wiring for the sidebar's Settings, Import/Export, MIDI, Help
 * and Favourites dialogs.
 */

import { updateFavoritesList } from './favorites-modal.js';
import { startGuidedTour } from './onboarding.js';

/**
 * Set up menu modals (Settings, Import/Export, MIDI, Help)
 */
export function setupMenuModals() {
    // Settings Modal
    const settingsModal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-menu-btn');
    const settingsClose = document.getElementById('settings-close');
    const settingsOk = document.getElementById('settings-ok');

    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.remove('hidden');
            settingsModal.style.display = 'flex';
        });

        const closeSettings = () => {
            settingsModal.classList.add('hidden');
            settingsModal.style.display = 'none';
        };

        if (settingsClose) settingsClose.addEventListener('click', closeSettings);
        if (settingsOk) settingsOk.addEventListener('click', closeSettings);

        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeSettings();
        });
    }

    // Import/Export Modal
    const importExportModal = document.getElementById('import-export-modal');
    const importExportBtn = document.getElementById('import-export-menu-btn');
    const importExportClose = document.getElementById('import-export-close');
    const importExportOk = document.getElementById('import-export-ok');

    if (importExportBtn && importExportModal) {
        importExportBtn.addEventListener('click', () => {
            importExportModal.classList.remove('hidden');
            importExportModal.style.display = 'flex';
        });

        const closeImportExport = () => {
            importExportModal.classList.add('hidden');
            importExportModal.style.display = 'none';
        };

        if (importExportClose) importExportClose.addEventListener('click', closeImportExport);
        if (importExportOk) importExportOk.addEventListener('click', closeImportExport);

        importExportModal.addEventListener('click', (e) => {
            if (e.target === importExportModal) closeImportExport();
        });
    }

    // MIDI Modal
    const midiModal = document.getElementById('midi-modal');
    const midiBtn = document.getElementById('midi-menu-btn');
    const midiClose = document.getElementById('midi-close');
    const midiOk = document.getElementById('midi-ok');

    if (midiBtn && midiModal) {
        midiBtn.addEventListener('click', () => {
            midiModal.classList.remove('hidden');
            midiModal.style.display = 'flex';
        });

        const closeMidi = () => {
            midiModal.classList.add('hidden');
            midiModal.style.display = 'none';
        };

        if (midiClose) midiClose.addEventListener('click', closeMidi);
        if (midiOk) midiOk.addEventListener('click', closeMidi);

        midiModal.addEventListener('click', (e) => {
            if (e.target === midiModal) closeMidi();
        });
    }

    // Help Modal
    const helpModal = document.getElementById('help-modal');
    const helpBtn = document.getElementById('help-menu-btn');
    const mappingInfoBtn = document.getElementById('mapping-info-btn');
    const helpClose = document.getElementById('help-close');
    const helpOk = document.getElementById('help-ok');
    const restartTutorial = document.getElementById('restart-tutorial');

    const openHelp = () => {
        helpModal.classList.remove('hidden');
        helpModal.style.display = 'flex';
    };

    const closeHelp = () => {
        helpModal.classList.add('hidden');
        helpModal.style.display = 'none';
    };

    if (helpBtn && helpModal) {
        helpBtn.addEventListener('click', openHelp);

        if (helpClose) helpClose.addEventListener('click', closeHelp);
        if (helpOk) helpOk.addEventListener('click', closeHelp);

        if (restartTutorial) {
            restartTutorial.addEventListener('click', () => {
                closeHelp();
                startGuidedTour();
            });
        }

        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) closeHelp();
        });
    }

    // Mapping info button (opens help modal)
    if (mappingInfoBtn && helpModal) {
        mappingInfoBtn.addEventListener('click', openHelp);
    }

    // Favorites Modal
    const favoritesModal = document.getElementById('favorites-modal');
    const favoritesBtn = document.getElementById('favorites-menu-btn');
    const favoritesClose = document.getElementById('favorites-close');
    const favoritesOk = document.getElementById('favorites-ok');

    if (favoritesBtn && favoritesModal) {
        favoritesBtn.addEventListener('click', () => {
            updateFavoritesList();
            favoritesModal.classList.remove('hidden');
            favoritesModal.style.display = 'flex';
        });

        const closeFavorites = () => {
            favoritesModal.classList.add('hidden');
            favoritesModal.style.display = 'none';
        };

        if (favoritesClose) favoritesClose.addEventListener('click', closeFavorites);
        if (favoritesOk) favoritesOk.addEventListener('click', closeFavorites);

        favoritesModal.addEventListener('click', (e) => {
            if (e.target === favoritesModal) closeFavorites();
        });
    }
}
