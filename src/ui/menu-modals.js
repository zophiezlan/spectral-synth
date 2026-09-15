/**
 * Menu Modals
 *
 * Registers the sidebar's Settings, Import/Export, MIDI, Help and
 * Favourites dialogs with ModalManager, which owns open/close, Escape,
 * overlay clicks and focus restoration.
 */

import { ModalManager } from './modal-manager.js';
import { updateFavoritesList } from './favorites-modal.js';
import { startGuidedTour } from './onboarding.js';

export function setupMenuModals() {
    ModalManager.register('settings', {
        modalId: 'settings-modal',
        triggerId: 'settings-menu-btn',
        closeIds: ['settings-close', 'settings-ok'],
    });

    ModalManager.register('import-export', {
        modalId: 'import-export-modal',
        triggerId: 'import-export-menu-btn',
        closeIds: ['import-export-close', 'import-export-ok'],
    });

    ModalManager.register('midi', {
        modalId: 'midi-modal',
        triggerId: 'midi-menu-btn',
        closeIds: ['midi-close', 'midi-ok'],
    });

    ModalManager.register('help', {
        modalId: 'help-modal',
        triggerId: 'help-menu-btn',
        closeIds: ['help-close', 'help-ok'],
    });

    ModalManager.register('favorites', {
        modalId: 'favorites-modal',
        triggerId: 'favorites-menu-btn',
        closeIds: ['favorites-close', 'favorites-ok'],
        onOpen: updateFavoritesList,
    });

    // The ⓘ button on the FTIR chart opens Help (the mapping table lives there)
    document.getElementById('mapping-info-btn')?.addEventListener('click', () => ModalManager.open('help'));

    // "Take the tutorial" inside Help
    document.getElementById('restart-tutorial')?.addEventListener('click', () => {
        ModalManager.close('help');
        startGuidedTour();
    });
}
