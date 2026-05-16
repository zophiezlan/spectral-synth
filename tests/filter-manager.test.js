/**
 * Unit Tests for FilterManager
 *
 * FilterManager became live in Phase 3 — it now owns the substance selector,
 * search/category/favorites filtering, debounced search, and the filter status
 * UI. These tests lock that contract in.
 */

const { loadBrowserModule } = require('./test-helpers');

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
    `;
}

function loadFilterManager(favoriteNames = []) {
    const FavoritesStub = {
        getAll: () => favoriteNames,
    };
    const ToastStub = {
        info: jest.fn(),
        success: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
    };
    const AppStateStub = {
        set: jest.fn(),
    };
    const { FilterManager } = loadBrowserModule('filter-manager.js', {
        document,
        window,
        Favorites: FavoritesStub,
        Toast: ToastStub,
        AppState: AppStateStub,
        categorizeSubstance: categorizeSubstanceStub,
        clearTimeout,
        setTimeout,
    });
    return { FilterManager, Toast: ToastStub, AppState: AppStateStub };
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
        it('populates the substance selector with every item', () => {
            const { FilterManager } = loadFilterManager();

            FilterManager.init(LIBRARY_FIXTURE);

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Caffeine');
            expect(opts).toContain('Morphine');
            expect(opts).toContain('Cocaine');
            expect(opts).toContain('Diazepam');
            expect(opts).toContain('Cannabidiol');
        });

        it('reflects the total in the results count', () => {
            const { FilterManager } = loadFilterManager();

            FilterManager.init(LIBRARY_FIXTURE);

            expect(document.getElementById('results-count').textContent).toBe('5 substances');
        });

        it('syncs filter state to AppState', () => {
            const { FilterManager, AppState } = loadFilterManager();

            FilterManager.init(LIBRARY_FIXTURE);

            expect(AppState.set).toHaveBeenCalledWith('searchTerm', '');
            expect(AppState.set).toHaveBeenCalledWith('category', 'all');
            expect(AppState.set).toHaveBeenCalledWith('showFavoritesOnly', false);
        });
    });

    describe('search filtering', () => {
        it('filters by name (case insensitive)', () => {
            const { FilterManager } = loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setSearch('CAFF');

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Caffeine');
            expect(opts).not.toContain('Morphine');
        });

        it('filters by formula', () => {
            const { FilterManager } = loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setSearch('C16H13ClN2O');

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Diazepam');
            expect(opts).not.toContain('Caffeine');
        });

        it('debounces input events', () => {
            const { FilterManager } = loadFilterManager();
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
        it('keeps only the chosen category', () => {
            const { FilterManager } = loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setCategory('opioids');

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Morphine');
            expect(opts).not.toContain('Caffeine');
            expect(opts).not.toContain('Diazepam');
        });

        it('combines with search filter (AND)', () => {
            const { FilterManager } = loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setCategory('stimulants');
            FilterManager.setSearch('caff');

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Caffeine');
            expect(opts).not.toContain('Cocaine');
        });
    });

    describe('favorites filtering', () => {
        it('shows only favorited substances when enabled', () => {
            const { FilterManager } = loadFilterManager(['Morphine', 'Diazepam']);
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setShowFavoritesOnly(true);

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Morphine');
            expect(opts).toContain('Diazepam');
            expect(opts).not.toContain('Caffeine');
        });

        it('flips the show-all / show-favorites aria-pressed pair', () => {
            const { FilterManager } = loadFilterManager();
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
        it('reveals the active-filters bar when a filter is set', () => {
            const { FilterManager } = loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            expect(document.getElementById('active-filters').classList.contains('hidden')).toBe(true);

            FilterManager.setSearch('caff');

            expect(document.getElementById('active-filters').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('search-filter-tag').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('search-term-display').textContent).toBe('caff');
        });

        it('shows the no-results state and hides the selector when nothing matches', () => {
            const { FilterManager } = loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setSearch('zzz-not-real');

            expect(document.getElementById('no-results').classList.contains('hidden')).toBe(false);
            expect(document.querySelector('.substance-selector').style.display).toBe('none');
        });
    });

    describe('clearFilter() / clearAll()', () => {
        it('clears a single filter by type', () => {
            const { FilterManager } = loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setSearch('morph');
            FilterManager.setCategory('opioids');
            FilterManager.clearFilter('search');

            const state = FilterManager.getState();
            expect(state.searchTerm).toBe('');
            expect(state.category).toBe('opioids');
        });

        it('clearAll() resets everything to defaults', () => {
            const { FilterManager, Toast } = loadFilterManager(['Morphine']);
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setSearch('morph');
            FilterManager.setCategory('opioids');
            FilterManager.setShowFavoritesOnly(true);

            FilterManager.clearAll();

            expect(FilterManager.getState()).toEqual({
                searchTerm: '',
                category: 'all',
                showFavoritesOnly: false,
            });
            expect(Toast.info).toHaveBeenCalledWith('All filters cleared');
        });
    });

    describe('setLibrary() / refresh()', () => {
        it('rebinds the library and repopulates the selector', () => {
            const { FilterManager } = loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            const extended = [...LIBRARY_FIXTURE, { id: '99', name: 'Aspirin', formula: 'C9H8O4' }];
            FilterManager.setLibrary(extended);

            const opts = selectorOptions(document.getElementById('substance'));
            expect(opts).toContain('Aspirin');
            expect(document.getElementById('results-count').textContent).toBe('6 substances');
        });
    });

    describe('event wiring', () => {
        it('responds to filter-remove button clicks (data-filter="category")', () => {
            const { FilterManager } = loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setCategory('opioids');
            expect(FilterManager.getState().category).toBe('opioids');

            const removeBtn = document.querySelector('.filter-remove[data-filter="category"]');
            removeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(FilterManager.getState().category).toBe('all');
        });

        it('responds to clear-all-filters button', () => {
            const { FilterManager } = loadFilterManager();
            FilterManager.init(LIBRARY_FIXTURE);

            FilterManager.setSearch('morph');

            document
                .getElementById('clear-all-filters')
                .dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(FilterManager.getState().searchTerm).toBe('');
        });
    });
});
