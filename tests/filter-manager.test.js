/**
 * Unit Tests for FilterManager
 *
 * FilterManager became live in Phase 3 — it now owns the substance selector,
 * search/category/favorites filtering, debounced search, and the filter status
 * UI. These tests lock that contract in.
 */

import { jest } from '@jest/globals';
import { loadFresh, uiStubs } from './test-helpers.js';

// Collaborators are mocked once; the jest.fn()s live here so tests can assert
// on them, and `favoritesState` lets each test decide what Favorites returns.
const favoritesState = { names: [] };
const ToastStub = uiStubs().Toast;

jest.unstable_mockModule('../src/core/favorites.js', () => ({
    Favorites: { getAll: () => favoritesState.names, isFavorite: (n) => favoritesState.names.includes(n) },
}));
jest.unstable_mockModule('../src/ui/ui-utilities.js', () => ({ ...uiStubs(), Toast: ToastStub }));
jest.unstable_mockModule('../src/data/substance-utilities.js', () => ({
    categorizeSubstance: categorizeSubstanceStub,
    matchesSearch: (item, term) => !term
        || item.name.toLowerCase().includes(term.toLowerCase())
        || (item.formula || '').toLowerCase().includes(term.toLowerCase()),
}));

// The Common filter is on by default; most tests want the whole fixture visible,
// so "common" means everything unless a test narrows it.
const commonState = { names: null };
jest.unstable_mockModule('../src/data/common-substances.js', () => ({
    isCommonSubstance: (item) => commonState.names === null || commonState.names.includes(item.name),
}));

const LIBRARY_FIXTURE = [
    { id: '0', name: 'Caffeine', formula: 'C8H10N4O2' },
    { id: '1', name: 'Morphine', formula: 'C17H19NO3' },
    { id: '2', name: 'Cocaine', formula: 'C17H21NO4' },
    { id: '3', name: 'Diazepam', formula: 'C16H13ClN2O' },
    { id: '4', name: 'Cannabidiol', formula: 'C21H30O2' },
];

/**
 * categorizeSubstance stub matching substance-utilities.js / split-library.js
 * keyword rules — only what these tests need.
 */
function categorizeSubstanceStub(item) {
    const n = item.name.toLowerCase();
    if (n.includes('morphine')) return 'opioids';
    if (n.includes('caffeine') || n.includes('cocaine')) return 'stimulants';
    if (n.includes('diazepam')) return 'benzodiazepines';
    if (n.includes('cannabid')) return 'cannabinoids';
    return 'other';
}

function setupDOM() {
    document.body.innerHTML = `
        <div class="substance-selector">
            <input id="search" type="text" />
            <select id="category">
                <option value="all">All</option>
                <option value="opioids">Opioids</option>
                <option value="stimulants">Stimulants</option>
                <option value="benzodiazepines">Benzodiazepines</option>
                <option value="cannabinoids">Cannabinoids</option>
            </select>
            <select id="substance"></select>
            <span id="results-count"></span>
        </div>
        <div id="active-filters" class="hidden">
            <span id="search-filter-tag" class="hidden">
                <span id="search-term-display"></span>
                <button class="filter-remove" data-filter="search"></button>
            </span>
            <span id="category-filter-tag" class="hidden">
                <span id="category-name-display"></span>
                <button class="filter-remove" data-filter="category"></button>
            </span>
            <span id="favorites-filter-tag" class="hidden">
                <button class="filter-remove" data-filter="favorites"></button>
            </span>
            <button id="clear-all-filters">Clear</button>
        </div>
        <div id="no-results" class="hidden">
            <button id="clear-search-btn"></button>
        </div>
        <button id="show-all" class="active" aria-pressed="true">All</button>
        <button id="show-favorites" aria-pressed="false">Favorites</button>
        <button id="show-common" aria-pressed="true">Common</button>
    `;
}

async function loadFilterManager(favoriteNames = [], commonNames = null) {
    favoritesState.names = favoriteNames;
    commonState.names = commonNames;
    const { FilterManager } = await loadFresh('../src/ui/filter-manager.js');
    return { FilterManager, Toast: ToastStub };
}

function selectorOptions(select) {
    return Array.from(select.options).map((o) => o.textContent);
}

describe('FilterManager', () => {
    beforeEach(() => {
        setupDOM();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('init()', () => {
        it('populates the substance selector with every item', async () => {
            const { FilterManager } = await loadFilterManager();

            FilterManager.init(LIBRARY_FIXTURE);

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Caffeine');
            expect(opts).toContain('Morphine');
            expect(opts).toContain('Cocaine');
            expect(opts).toContain('Diazepam');
            expect(opts).toContain('Cannabidiol');
        });

        it('reflects the total in the results count', async () => {
            const { FilterManager } = await loadFilterManager();

            FilterManager.init(LIBRARY_FIXTURE);

            expect(document.getElementById('results-count').textContent).toBe('5 substances');
        });
    });

    describe('search filtering', () => {
        it('filters by name (case insensitive)', async () => {
            const { FilterManager } = await loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setSearch('CAFF');

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Caffeine');
            expect(opts).not.toContain('Morphine');
        });

        it('filters by formula', async () => {
            const { FilterManager } = await loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setSearch('C16H13ClN2O');

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Diazepam');
            expect(opts).not.toContain('Caffeine');
        });

        it('debounces input events', async () => {
            const { FilterManager } = await loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            const input = document.getElementById('search');
            input.value = 'morph';
            input.dispatchEvent(new Event('input'));

            // Pre-debounce: state is still empty
            expect(FilterManager.getState().searchTerm).toBe('');

            jest.advanceTimersByTime(500);
            expect(FilterManager.getState().searchTerm).toBe('morph');
        });
    });

    describe('category filtering', () => {
        it('keeps only the chosen category', async () => {
            const { FilterManager } = await loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setCategory('opioids');

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Morphine');
            expect(opts).not.toContain('Caffeine');
            expect(opts).not.toContain('Diazepam');
        });

        it('combines with search filter (AND)', async () => {
            const { FilterManager } = await loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setCategory('stimulants');
            FilterManager.setSearch('caff');

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Caffeine');
            expect(opts).not.toContain('Cocaine');
        });
    });

    describe('common filtering', () => {
        it('shows only common substances by default', async () => {
            const { FilterManager } = await loadFilterManager([], ['Caffeine', 'Cocaine']);
            FilterManager.init(LIBRARY_FIXTURE);

            expect(selectorOptions(document.getElementById('substance'))).toEqual(['-- Select a Substance --', 'Caffeine', 'Cocaine']);
            expect(document.getElementById('show-common').getAttribute('aria-pressed')).toBe('true');
        });

        it('is bypassed while a search term is active', async () => {
            const { FilterManager } = await loadFilterManager([], ['Caffeine']);
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setSearch('morph');

            expect(selectorOptions(document.getElementById('substance'))).toContain('Morphine');
            expect(document.getElementById('show-common').classList.contains('bypassed')).toBe(true);

            FilterManager.setSearch('');
            expect(selectorOptions(document.getElementById('substance'))).not.toContain('Morphine');
            expect(document.getElementById('show-common').classList.contains('bypassed')).toBe(false);
        });

        it('setShowCommonOnly(false) shows everything and the chip toggles it back', async () => {
            const { FilterManager } = await loadFilterManager([], ['Caffeine']);
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setShowCommonOnly(false);
            expect(selectorOptions(document.getElementById('substance'))).toHaveLength(LIBRARY_FIXTURE.length + 1);

            document.getElementById('show-common').click();
            expect(selectorOptions(document.getElementById('substance'))).toEqual(['-- Select a Substance --', 'Caffeine']);
        });

        it('offers "Show all substances" when Common hides a whole category', async () => {
            const { FilterManager } = await loadFilterManager([], ['Caffeine']);
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setCategory('opioids');

            const btn = document.getElementById('clear-search-btn');
            expect(document.getElementById('no-results').classList.contains('hidden')).toBe(false);
            expect(btn.textContent).toBe('Show all substances');

            btn.click();
            expect(FilterManager.getState().showCommonOnly).toBe(false);
            expect(FilterManager.getState().category).toBe('opioids');
            expect(selectorOptions(document.getElementById('substance'))).toContain('Morphine');
        });
    });

    describe('favorites filtering', () => {
        it('shows only favorited substances when enabled', async () => {
            const { FilterManager } = await loadFilterManager(['Morphine', 'Diazepam']);
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setShowFavoritesOnly(true);

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Morphine');
            expect(opts).toContain('Diazepam');
            expect(opts).not.toContain('Caffeine');
        });

        it('flips the show-all / show-favorites aria-pressed pair', async () => {
            const { FilterManager } = await loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setShowFavoritesOnly(true);

            expect(document.getElementById('show-all').getAttribute('aria-pressed')).toBe('false');
            expect(document.getElementById('show-favorites').getAttribute('aria-pressed')).toBe('true');

            FilterManager.setShowFavoritesOnly(false);

            expect(document.getElementById('show-all').getAttribute('aria-pressed')).toBe('true');
            expect(document.getElementById('show-favorites').getAttribute('aria-pressed')).toBe('false');
        });
    });

    describe('filter status UI', () => {
        it('reveals the active-filters bar when a filter is set', async () => {
            const { FilterManager } = await loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            expect(document.getElementById('active-filters').classList.contains('hidden')).toBe(true);

            FilterManager.setSearch('caff');

            expect(document.getElementById('active-filters').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('search-filter-tag').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('search-term-display').textContent).toBe('caff');
        });

        it('shows the no-results state and hides the selector when nothing matches', async () => {
            const { FilterManager } = await loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setSearch('zzz-not-real');

            expect(document.getElementById('no-results').classList.contains('hidden')).toBe(false);
            expect(document.querySelector('.substance-selector').style.display).toBe('none');
        });
    });

    describe('clearFilter() / clearAll()', () => {
        it('clears a single filter by type', async () => {
            const { FilterManager } = await loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setSearch('morph');
            FilterManager.setCategory('opioids');
            FilterManager.clearFilter('search');

            const state = FilterManager.getState();
            expect(state.searchTerm).toBe('');
            expect(state.category).toBe('opioids');
        });

        it('clearAll() resets everything to defaults', async () => {
            const { FilterManager, Toast } = await loadFilterManager(['Morphine']);
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setSearch('morph');
            FilterManager.setCategory('opioids');
            FilterManager.setShowFavoritesOnly(true);

            FilterManager.clearAll();

            expect(FilterManager.getState()).toEqual({
                searchTerm: '',
                category: 'all',
                showFavoritesOnly: false,
                showCommonOnly: false,
            });
            expect(Toast.info).toHaveBeenCalledWith('All filters cleared');
        });
    });

    describe('setLibrary() / refresh()', () => {
        it('rebinds the library and repopulates the selector', async () => {
            const { FilterManager } = await loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            const extended = [...LIBRARY_FIXTURE, { id: '99', name: 'Aspirin', formula: 'C9H8O4' }];
            FilterManager.setLibrary(extended);

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Aspirin');
            expect(document.getElementById('results-count').textContent).toBe('6 substances');
        });
    });

    describe('event wiring', () => {
        it('responds to filter-remove button clicks (data-filter="category")', async () => {
            const { FilterManager } = await loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setCategory('opioids');
            expect(FilterManager.getState().category).toBe('opioids');

            const removeBtn = document.querySelector('.filter-remove[data-filter="category"]');
            removeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(FilterManager.getState().category).toBe('all');
        });

        it('responds to clear-all-filters button', async () => {
            const { FilterManager } = await loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setSearch('morph');

            document
                .getElementById('clear-all-filters')
                .dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(FilterManager.getState().searchTerm).toBe('');
        });
    });
});
