/**
 * Storage Utilities Module
 * 
 * Provides localStorage-based utilities:
 * - Favorites management
 */

// Utility: Favorites manager using localStorage
export const Favorites = {
    STORAGE_KEY: 'spectral-synth-favorites',

    load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to load favorites:', error);
            return [];
        }
    },

    save(favorites) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favorites));
        } catch (error) {
            console.error('Failed to save favorites:', error);
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
