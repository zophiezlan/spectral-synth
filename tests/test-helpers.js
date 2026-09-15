/**
 * Test Helpers
 *
 * The source is native ES modules, so tests import from ../src directly.
 * The one thing that needs help is modules with module-level state
 * (FilterManager, LibraryLoader, ModalManager…): `loadFresh` evaluates a
 * module in an isolated registry so every test starts from a clean slate.
 *
 * Module mocks registered with `jest.unstable_mockModule` at the top of a
 * test file survive isolation — the factory is simply re-run — so keep the
 * jest.fn()s you want to assert on outside the factory.
 */

import { jest } from '@jest/globals';

/**
 * Import a module (and its dependency graph) into a fresh module registry.
 * @param {string} specifier - Path relative to this tests/ directory, e.g. '../src/ui/filter-manager.js'
 * @returns {Promise<Object>} The module namespace
 */
export async function loadFresh(specifier) {
    let mod;
    await jest.isolateModulesAsync(async () => {
        mod = await import(specifier);
    });
    return mod;
}

/** A Toast/ErrorHandler/LoadingOverlay/MicroInteractions stub set for mocking ui-utilities.js */
export function uiStubs() {
    return {
        Toast: { info: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(), show: jest.fn() },
        ErrorHandler: { handle: jest.fn() },
        LoadingOverlay: { show: jest.fn(), hide: jest.fn() },
        MicroInteractions: { celebrate: jest.fn(), pulse: jest.fn(), ripple: jest.fn() },
        ScreenReader: { announce: jest.fn() },
        iOSAudioHelper: { ensureAudioContext: jest.fn().mockResolvedValue() },
        BrowserCompatibility: { check: jest.fn(() => ({ compatible: true, unsupported: [] })), showWarning: jest.fn() },
    };
}
