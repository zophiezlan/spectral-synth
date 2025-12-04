/**
 * DOM Elements Module
 *
 * Purpose: Centralizes all DOM element references for the application
 *
 * Dependencies:
 * - None (pure DOM queries)
 *
 * Exports:
 * - All DOM element references as constants (substanceSelect, playButton, etc.)
 *
 * Usage:
 * This module is loaded early in the script chain and provides global
 * access to commonly used DOM elements. Elements are queried once at
 * load time for performance.
 *
 * Note: All elements may be null if not found in DOM. Consumer code
 * should check for existence before using.
 */

// DOM elements - Single mode (comparison mode removed)
const singleControls = document.getElementById('single-controls');
const substanceSelect = document.getElementById('substance');
const searchInput = document.getElementById('search');
const categorySelect = document.getElementById('category');
const resultsCount = document.getElementById('results-count');
const playButton = document.getElementById('play');
const clearSelectionButton = document.getElementById('clear-selection');
const selectionCount = document.getElementById('selection-count');
const durationSlider = document.getElementById('duration');
const durationValue = document.getElementById('duration-value');
const volumeSlider = document.getElementById('volume');
const volumeValue = document.getElementById('volume-value');
const reverbSlider = document.getElementById('reverb');
const reverbValue = document.getElementById('reverb-value');
const filterFreqSlider = document.getElementById('filter-freq');
const filterFreqValue = document.getElementById('filter-freq-value');
const attackSlider = document.getElementById('attack');
const attackValue = document.getElementById('attack-value');
const decaySlider = document.getElementById('decay');
const decayValue = document.getElementById('decay-value');
const sustainSlider = document.getElementById('sustain');
const sustainValue = document.getElementById('sustain-value');
const releaseSlider = document.getElementById('release');
const releaseValue = document.getElementById('release-value');
const adsrCurveSelect = document.getElementById('adsr-curve-select');
const mappingInfo = document.getElementById('mapping-info');
const mappingInfoModal = document.getElementById('mapping-info-modal');
const ftirCanvas = document.getElementById('ftir-canvas');
const audioCanvas = document.getElementById('audio-canvas');
const selectAllButton = document.getElementById('select-all');
const playSelectedButton = document.getElementById('play-selected');


