/**
 * Unit Tests for LibraryLoader Module
 *
 * Locks in the split-library load path + monolith fallback so the URL fix
 * from Phase 1 (dist/library/ → library/) can't silently regress.
 */

const { loadBrowserModule } = require('./test-helpers');

const INDEX_FIXTURE = {
    version: '1.0.0',
    totalSubstances: 4,
    categories: [
        { name: 'opioids', displayName: 'Opioids', count: 2, sizeBytes: 100, filename: 'opioids.json' },
        { name: 'stimulants', displayName: 'Stimulants', count: 2, sizeBytes: 100, filename: 'stimulants.json' },
    ],
};

const OPIOIDS_FIXTURE = [
    { id: 'o1', name: 'Morphine', spectrum: [] },
    { id: 'o2', name: 'Codeine', spectrum: [] },
];

const STIMULANTS_FIXTURE = [
    { id: 's1', name: 'Caffeine', spectrum: [] },
    { id: 's2', name: 'Cocaine', spectrum: [] },
];

const MONOLITH_FIXTURE = [...OPIOIDS_FIXTURE, ...STIMULANTS_FIXTURE];

/**
 * Build a fetch mock that returns canned responses for known URLs and 404s
 * for everything else. Tracks call order so tests can assert load behavior.
 */
function makeFetch(routes) {
    const calls = [];
    const fetchMock = jest.fn(async (url) => {
        calls.push(url);
        if (Object.prototype.hasOwnProperty.call(routes, url)) {
            const r = routes[url];
            if (r === 'NETWORK_ERROR') throw new Error('network down');
            return {
                ok: true,
                status: 200,
                json: async () => r,
            };
        }
        return { ok: false, status: 404, json: async () => null };
    });
    fetchMock.calls = calls;
    return fetchMock;
}

/**
 * Fresh LibraryLoader per test — its module-level state (libraryIndex,
 * loadedCategories, useLazyLoading, isInitialized) leaks across `init` calls.
 */
function freshLoader(fetchMock) {
    const { LibraryLoader } = loadBrowserModule('library-loader.js', {
        fetch: fetchMock,
        // IndexedDBStorage intentionally undefined so the loader skips it.
        // `window` undefined too — the file's bottom branch noops in that case.
    });
    return LibraryLoader;
}

describe('LibraryLoader', () => {
    describe('init() — split mode', () => {
        it('loads library/index.json (not dist/library/)', async () => {
            const fetchMock = makeFetch({ 'library/index.json': INDEX_FIXTURE });
            const Loader = freshLoader(fetchMock);

            const index = await Loader.init();

            expect(index).toEqual(INDEX_FIXTURE);
            expect(fetchMock).toHaveBeenCalledWith('library/index.json');
            expect(fetchMock.calls).not.toContain('dist/library/index.json');
            expect(Loader.isLazyLoadingEnabled()).toBe(true);
        });
    });

    describe('init() — fallback', () => {
        it('falls back to monolith when index.json 404s', async () => {
            const fetchMock = makeFetch({}); // everything 404s
            const Loader = freshLoader(fetchMock);

            const index = await Loader.init();

            expect(index).toBeNull();
            expect(Loader.isLazyLoadingEnabled()).toBe(false);
        });

        it('falls back when network throws', async () => {
            const fetchMock = makeFetch({ 'library/index.json': 'NETWORK_ERROR' });
            const Loader = freshLoader(fetchMock);

            const index = await Loader.init();

            expect(index).toBeNull();
            expect(Loader.isLazyLoadingEnabled()).toBe(false);
        });
    });

    describe('loadCategory()', () => {
        it('fetches the category file relative to library/', async () => {
            const fetchMock = makeFetch({
                'library/index.json': INDEX_FIXTURE,
                'library/opioids.json': OPIOIDS_FIXTURE,
            });
            const Loader = freshLoader(fetchMock);
            await Loader.init();

            const substances = await Loader.loadCategory('opioids');

            expect(substances).toEqual(OPIOIDS_FIXTURE);
            expect(fetchMock).toHaveBeenCalledWith('library/opioids.json');
        });

        it('serves a second request from in-memory cache', async () => {
            const fetchMock = makeFetch({
                'library/index.json': INDEX_FIXTURE,
                'library/opioids.json': OPIOIDS_FIXTURE,
            });
            const Loader = freshLoader(fetchMock);
            await Loader.init();

            await Loader.loadCategory('opioids');
            await Loader.loadCategory('opioids');

            const opioidsFetches = fetchMock.calls.filter((u) => u === 'library/opioids.json');
            expect(opioidsFetches).toHaveLength(1);
        });

        it('throws when category is unknown', async () => {
            const fetchMock = makeFetch({ 'library/index.json': INDEX_FIXTURE });
            const Loader = freshLoader(fetchMock);
            await Loader.init();

            await expect(Loader.loadCategory('nonexistent')).rejects.toThrow(
                /Category not found/
            );
        });

        it('propagates network failures', async () => {
            const fetchMock = makeFetch({
                'library/index.json': INDEX_FIXTURE,
                'library/opioids.json': 'NETWORK_ERROR',
            });
            const Loader = freshLoader(fetchMock);
            await Loader.init();

            await expect(Loader.loadCategory('opioids')).rejects.toThrow(/network down/);
        });
    });

    describe('loadAll()', () => {
        it('concatenates every category in split mode', async () => {
            const fetchMock = makeFetch({
                'library/index.json': INDEX_FIXTURE,
                'library/opioids.json': OPIOIDS_FIXTURE,
                'library/stimulants.json': STIMULANTS_FIXTURE,
            });
            const Loader = freshLoader(fetchMock);
            await Loader.init();

            const all = await Loader.loadAll();

            expect(all).toHaveLength(4);
            expect(all.map((s) => s.id)).toEqual(['o1', 'o2', 's1', 's2']);
        });

        it('uses the monolith when lazy loading is disabled', async () => {
            const fetchMock = makeFetch({
                'ftir-library.json': MONOLITH_FIXTURE,
            });
            const Loader = freshLoader(fetchMock);
            await Loader.init(); // index 404s → fallback mode

            const all = await Loader.loadAll();

            expect(all).toEqual(MONOLITH_FIXTURE);
            expect(fetchMock).toHaveBeenCalledWith('ftir-library.json');
        });
    });

    describe('getSubstancesByCategory()', () => {
        it("returns everything for 'all'", async () => {
            const fetchMock = makeFetch({
                'library/index.json': INDEX_FIXTURE,
                'library/opioids.json': OPIOIDS_FIXTURE,
                'library/stimulants.json': STIMULANTS_FIXTURE,
            });
            const Loader = freshLoader(fetchMock);
            await Loader.init();

            const all = await Loader.getSubstancesByCategory('all');

            expect(all).toHaveLength(4);
        });

        it('throws if called before init', async () => {
            const fetchMock = makeFetch({});
            const Loader = freshLoader(fetchMock);

            await expect(Loader.getSubstancesByCategory('opioids')).rejects.toThrow(
                /not initialized/
            );
        });
    });

    describe('clearCache()', () => {
        it('forces a fresh fetch after clearing', async () => {
            const fetchMock = makeFetch({
                'library/index.json': INDEX_FIXTURE,
                'library/opioids.json': OPIOIDS_FIXTURE,
            });
            const Loader = freshLoader(fetchMock);
            await Loader.init();

            await Loader.loadCategory('opioids');
            Loader.clearCache();
            await Loader.loadCategory('opioids');

            const opioidsFetches = fetchMock.calls.filter((u) => u === 'library/opioids.json');
            expect(opioidsFetches).toHaveLength(2);
        });
    });
});
