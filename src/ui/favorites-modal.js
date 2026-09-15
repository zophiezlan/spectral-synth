/**
 * Favourites Modal
 *
 * Renders the saved-favourites list with Load / Remove actions.
 */

import { ctx } from '../core/context.js';
import { Favorites } from '../core/favorites.js';
import { dom } from './dom.js';
import { handleSubstanceChange } from './substance-selection.js';

/**
 * Update the favorites list in the modal
 */
export function updateFavoritesList() {
    const favoritesList = document.getElementById('favorites-list');
    if (!favoritesList) return;

    const favorites = Favorites.getAll();

    if (favorites.length === 0) {
        favoritesList.innerHTML = '<p class="empty-favorites">No favorites yet. Click the ⭐ button next to any substance to add it to your favorites.</p>';
        return;
    }

    // Build the list
    const listHTML = favorites.map(substanceName => {
        // Find the substance in the library to get its ID
        const substance = ctx.libraryData.find(item => item.name === substanceName);
        const substanceId = substance ? substance.id : null;

        return `
            <div class="favorite-item">
                <span class="favorite-name">${substanceName}</span>
                <div class="favorite-actions">
                    <button class="favorite-load-btn" data-id="${substanceId}" data-name="${substanceName}">Load</button>
                    <button class="favorite-remove-btn" data-name="${substanceName}">Remove</button>
                </div>
            </div>
        `;
    }).join('');

    favoritesList.innerHTML = listHTML;

    // Add event listeners
    favoritesList.querySelectorAll('.favorite-load-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const substanceId = btn.dataset.id;
            if (substanceId && dom.substanceSelect) {
                dom.substanceSelect.value = substanceId;
                handleSubstanceChange();
                // Close the modal
                const favoritesModal = document.getElementById('favorites-modal');
                if (favoritesModal) {
                    favoritesModal.classList.add('hidden');
                    favoritesModal.style.display = 'none';
                }
            }
        });
    });

    favoritesList.querySelectorAll('.favorite-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const substanceName = btn.dataset.name;
            Favorites.remove(substanceName);
            updateFavoritesList();
            // Update the favorite toggle button if this substance is currently selected
            const currentSubstanceName = dom.substanceSelect.options[dom.substanceSelect.selectedIndex]?.text;
            if (currentSubstanceName === substanceName) {
                const favoriteToggle = document.getElementById('favorite-toggle');
                if (favoriteToggle) {
                    favoriteToggle.textContent = '☆';
                    favoriteToggle.setAttribute('aria-label', 'Add to favorites');
                }
            }
        });
    });
}
