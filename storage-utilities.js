/**
 * Storage Utilities Module
 *
 * Purpose: Provides localStorage-based utilities for persistent data
 *
 * Dependencies:
 * - Logger (for error logging)
 * - Toast (for user notifications)
 *
 * Exports:
 * - Favorites object with methods for managing favorite substances
 *
 * Usage:
 * ```javascript
 * // Add a favorite
 * Favorites.add('MDMA');
 *
 * // Check if favorite
 * if (Favorites.isFavorite('Cocaine')) { ... }
 *
 * // Get all favorites
 * const all = Favorites.getAll(); // Returns array of strings
 * ```
 *
 * Storage:
 * - Uses localStorage with key 'spectral-synth-favorites'
 * - Data is JSON-serialized array of substance names
 * - Handles storage errors gracefully
 */

// Utility: Favorites manager using localStorage
const Favorites = {
    STORAGE_KEY: 'spectral-synth-favorites',

    load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            Logger.error('Failed to load favorites:', error);
            return [];
        }
    },

    save(favorites) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favorites));
        } catch (error) {
            Logger.error('Failed to save favorites:', error);
            Toast.error('Failed to save favorites');
        }
    },

    add(substanceName) {
        const favorites = this.load();
        if (!favorites.includes(substanceName)) {
            favorites.push(substanceName);
            this.save(favorites);
            Toast.success(`Added "${substanceName}" to favorites`, 2000);
        }
    },

    remove(substanceName) {
        let favorites = this.load();
        favorites = favorites.filter(name => name !== substanceName);
        this.save(favorites);
        Toast.info(`Removed "${substanceName}" from favorites`, 2000);
    },

    toggle(substanceName) {
        const favorites = this.load();
        if (favorites.includes(substanceName)) {
            this.remove(substanceName);
            return false;
        } else {
            this.add(substanceName);
            return true;
        }
    },

    isFavorite(substanceName) {
        return this.load().includes(substanceName);
    },

    getAll() {
        return this.load();
    }
};
