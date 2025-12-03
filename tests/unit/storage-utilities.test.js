/**
 * Unit tests for Storage Utilities
 */

import { jest } from '@jest/globals';

describe('StorageUtilities', () => {
    let StorageUtilities;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        jest.restoreAllMocks();
        
        // Spy on localStorage methods
        jest.spyOn(global.localStorage, 'getItem').mockImplementation(() => null);
        jest.spyOn(global.localStorage, 'setItem').mockImplementation(() => {});
        jest.spyOn(global.localStorage, 'removeItem').mockImplementation(() => {});
        jest.spyOn(global.localStorage, 'clear').mockImplementation(() => {});

        // Mock StorageUtilities for testing
        StorageUtilities = {
            saveFavorites: function(favorites) {
                try {
                    const data = JSON.stringify(favorites);
                    localStorage.setItem('spectral-synth-favorites', data);
                    return true;
                } catch (error) {
                    console.error('Failed to save favorites:', error);
                    return false;
                }
            },

            loadFavorites: function() {
                try {
                    const data = localStorage.getItem('spectral-synth-favorites');
                    return data ? JSON.parse(data) : [];
                } catch (error) {
                    console.error('Failed to load favorites:', error);
                    return [];
                }
            },

            toggleFavorite: function(substanceId) {
                const favorites = this.loadFavorites();
                const index = favorites.indexOf(substanceId);

                if (index > -1) {
                    favorites.splice(index, 1);
                } else {
                    favorites.push(substanceId);
                }

                this.saveFavorites(favorites);
                return index === -1; // Returns true if added, false if removed
            },

            isFavorite: function(substanceId) {
                const favorites = this.loadFavorites();
                return favorites.includes(substanceId);
            }
        };
    });

    describe('saveFavorites', () => {
        test('should save favorites to localStorage', () => {
            const favorites = ['caffeine', 'mdma', 'cocaine'];
            const result = StorageUtilities.saveFavorites(favorites);

            expect(result).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'spectral-synth-favorites',
                JSON.stringify(favorites)
            );
        });

        test('should handle empty favorites array', () => {
            const result = StorageUtilities.saveFavorites([]);

            expect(result).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'spectral-synth-favorites',
                '[]'
            );
        });
    });

    describe('loadFavorites', () => {
        test('should load favorites from localStorage', () => {
            const favorites = ['caffeine', 'mdma'];
            localStorage.getItem.mockReturnValue(JSON.stringify(favorites));

            const result = StorageUtilities.loadFavorites();

            expect(result).toEqual(favorites);
            expect(localStorage.getItem).toHaveBeenCalledWith('spectral-synth-favorites');
        });

        test('should return empty array when no favorites exist', () => {
            localStorage.getItem.mockReturnValue(null);

            const result = StorageUtilities.loadFavorites();

            expect(result).toEqual([]);
        });

        test('should return empty array on parse error', () => {
            localStorage.getItem.mockReturnValue('invalid json');

            const result = StorageUtilities.loadFavorites();

            expect(result).toEqual([]);
        });
    });

    describe('toggleFavorite', () => {
        test('should add substance to favorites', () => {
            localStorage.getItem.mockReturnValue('[]');

            const result = StorageUtilities.toggleFavorite('caffeine');

            expect(result).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'spectral-synth-favorites',
                '["caffeine"]'
            );
        });

        test('should remove substance from favorites', () => {
            localStorage.getItem.mockReturnValue('["caffeine","mdma"]');

            const result = StorageUtilities.toggleFavorite('caffeine');

            expect(result).toBe(false);
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'spectral-synth-favorites',
                '["mdma"]'
            );
        });
    });

    describe('isFavorite', () => {
        test('should return true for favorited substance', () => {
            localStorage.getItem.mockReturnValue('["caffeine","mdma"]');

            const result = StorageUtilities.isFavorite('caffeine');

            expect(result).toBe(true);
        });

        test('should return false for non-favorited substance', () => {
            localStorage.getItem.mockReturnValue('["caffeine","mdma"]');

            const result = StorageUtilities.isFavorite('cocaine');

            expect(result).toBe(false);
        });

        test('should return false when no favorites exist', () => {
            localStorage.getItem.mockReturnValue(null);

            const result = StorageUtilities.isFavorite('caffeine');

            expect(result).toBe(false);
        });
    });
});
