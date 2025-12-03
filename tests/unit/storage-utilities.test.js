/**
 * Unit tests for Storage Utilities
 * 
 * Tests the Favorites object from storage-utilities.js
 */

import { jest } from '@jest/globals';

// Mock Toast module before importing Favorites
jest.unstable_mockModule('../../src/utils/ui-utilities.js', () => ({
    Toast: {
        success: jest.fn(),
        error: jest.fn(),
        info: jest.fn()
    }
}));

// Import Favorites after mocking dependencies
const { Favorites } = await import('../../src/utils/storage-utilities.js');
const { Toast } = await import('../../src/utils/ui-utilities.js');

describe('Favorites', () => {
    let getItemSpy, setItemSpy, mockStorage;

    beforeEach(() => {
        // Clear and restore all mocks before each test
        jest.clearAllMocks();
        jest.restoreAllMocks();
        
        // Create mock storage
        mockStorage = {};
        
        // Spy on localStorage methods (using the one from setup.js)
        getItemSpy = jest.spyOn(Storage.prototype, 'getItem');
        setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
        
        // Implement mock behavior
        getItemSpy.mockImplementation((key) => mockStorage[key] || null);
        setItemSpy.mockImplementation((key, value) => { mockStorage[key] = value; });
    });

    afterEach(() => {
        // Restore original implementations
        jest.restoreAllMocks();
    });

    describe('load', () => {
        test('should load favorites from localStorage', () => {
            mockStorage['spectral-synth-favorites'] = JSON.stringify(['caffeine', 'mdma']);

            const result = Favorites.load();

            expect(result).toEqual(['caffeine', 'mdma']);
            expect(localStorage.getItem).toHaveBeenCalledWith('spectral-synth-favorites');
        });

        test('should return empty array when no favorites exist', () => {
            const result = Favorites.load();

            expect(result).toEqual([]);
        });

        test('should return empty array on parse error', () => {
            mockStorage['spectral-synth-favorites'] = 'invalid json';

            const result = Favorites.load();

            expect(result).toEqual([]);
        });
    });

    describe('save', () => {
        test('should save favorites to localStorage', () => {
            const favorites = ['caffeine', 'mdma', 'cocaine'];
            Favorites.save(favorites);

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'spectral-synth-favorites',
                JSON.stringify(favorites)
            );
        });

        test('should handle empty favorites array', () => {
            Favorites.save([]);

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'spectral-synth-favorites',
                '[]'
            );
        });
    });

    describe('add', () => {
        test('should add substance to favorites', () => {
            Favorites.add('caffeine');

            expect(localStorage.setItem).toHaveBeenCalled();
            expect(Toast.success).toHaveBeenCalled();
            expect(Favorites.load()).toContain('caffeine');
        });

        test('should not add duplicate substance', () => {
            mockStorage['spectral-synth-favorites'] = JSON.stringify(['caffeine']);
            
            Favorites.add('caffeine');

            // Should not call setItem again since caffeine already exists
            expect(localStorage.setItem).not.toHaveBeenCalled();
        });
    });

    describe('remove', () => {
        test('should remove substance from favorites', () => {
            mockStorage['spectral-synth-favorites'] = JSON.stringify(['caffeine', 'mdma']);

            Favorites.remove('caffeine');

            expect(localStorage.setItem).toHaveBeenCalled();
            expect(Toast.info).toHaveBeenCalled();
            expect(Favorites.load()).not.toContain('caffeine');
            expect(Favorites.load()).toContain('mdma');
        });
    });

    describe('toggle', () => {
        test('should add substance when not in favorites', () => {
            const result = Favorites.toggle('caffeine');

            expect(result).toBe(true);
            expect(Toast.success).toHaveBeenCalled();
        });

        test('should remove substance when already in favorites', () => {
            mockStorage['spectral-synth-favorites'] = JSON.stringify(['caffeine']);

            const result = Favorites.toggle('caffeine');

            expect(result).toBe(false);
            expect(Toast.info).toHaveBeenCalled();
        });
    });

    describe('isFavorite', () => {
        test('should return true for favorited substance', () => {
            mockStorage['spectral-synth-favorites'] = JSON.stringify(['caffeine', 'mdma']);

            expect(Favorites.isFavorite('caffeine')).toBe(true);
        });

        test('should return false for non-favorited substance', () => {
            mockStorage['spectral-synth-favorites'] = JSON.stringify(['caffeine', 'mdma']);

            expect(Favorites.isFavorite('cocaine')).toBe(false);
        });

        test('should return false when no favorites exist', () => {
            expect(Favorites.isFavorite('caffeine')).toBe(false);
        });
    });

    describe('getAll', () => {
        test('should return all favorites', () => {
            mockStorage['spectral-synth-favorites'] = JSON.stringify(['caffeine', 'mdma', 'cocaine']);

            const result = Favorites.getAll();

            expect(result).toEqual(['caffeine', 'mdma', 'cocaine']);
        });

        test('should return empty array when no favorites', () => {
            const result = Favorites.getAll();

            expect(result).toEqual([]);
        });
    });
});
