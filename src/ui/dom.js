/**
 * DOM Elements
 *
 * Named accessors for the elements the app touches repeatedly. Each
 * property is a live getter, so modules can be imported before the DOM
 * exists (tests, bundling) and elements that aren't in the page simply
 * read as null — callers should guard.
 *
 * Usage:
 *   import { dom } from './dom.js';
 *   dom.playButton.disabled = false;
 */

const IDS = {
    singleControls: 'single-controls',
    substanceSelect: 'substance',
    searchInput: 'search',
    categorySelect: 'category',
    resultsCount: 'results-count',
    playButton: 'play',
    clearSelectionButton: 'clear-selection',
    selectAllButton: 'select-all',
    selectionCount: 'selection-count',
    favoriteToggle: 'favorite-toggle',
    durationSlider: 'duration',
    durationValue: 'duration-value',
    volumeSlider: 'volume',
    volumeValue: 'volume-value',
    reverbSlider: 'reverb',
    reverbValue: 'reverb-value',
    filterFreqSlider: 'filter-freq',
    filterFreqValue: 'filter-freq-value',
    attackSlider: 'attack',
    attackValue: 'attack-value',
    decaySlider: 'decay',
    decayValue: 'decay-value',
    sustainSlider: 'sustain',
    sustainValue: 'sustain-value',
    releaseSlider: 'release',
    releaseValue: 'release-value',
    adsrCurveSelect: 'adsr-curve-select',
    mappingInfo: 'mapping-info',
    mappingInfoModal: 'mapping-info-modal',
    ftirCanvas: 'ftir-canvas',
    audioCanvas: 'audio-canvas',
};

export const dom = {};

for (const [name, id] of Object.entries(IDS)) {
    Object.defineProperty(dom, name, {
        enumerable: true,
        get: () => document.getElementById(id),
    });
}
