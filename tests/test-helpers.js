/**
 * Test Helpers
 *
 * Utilities to load browser-style JavaScript modules in Node.js test environment.
 */

const fs = require('fs');
const path = require('path');

/**
 * Load a browser-style JavaScript file and return its exports
 * @param {string} filename - Filename relative to project root
 * @param {Object} globals - Additional globals to provide
 * @returns {Object} Object containing all classes/functions defined in the file
 */
function loadBrowserModule(filename, additionalGlobals = {}) {
    const code = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');

    // Create a function that will define the class in local scope
    const globals = {
        CONFIG: global.CONFIG,
        Logger: global.Logger,
        console: console,
        Math: Math,
        Date: Date,
        Array: Array,
        Object: Object,
        String: String,
        Number: Number,
        Boolean: Boolean,
        RegExp: RegExp,
        Error: Error,
        TypeError: TypeError,
        ReferenceError: ReferenceError,
        Float32Array: Float32Array,
        Uint8Array: Uint8Array,
        Int16Array: Int16Array,
        DataView: DataView,
        ArrayBuffer: ArrayBuffer,
        Blob: global.Blob || Blob,
        Map: Map,
        Set: Set,
        Promise: Promise,
        parseFloat: parseFloat,
        parseInt: parseInt,
        isNaN: isNaN,
        isFinite: isFinite,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        ...additionalGlobals,
    };

    // Create a function that will execute in the global context
    // and capture the class definitions
    const exports = {};
    const wrappedCode = `
        (function(exports, ${Object.keys(globals).join(', ')}) {
            ${code}

            // Capture all class definitions
            try { if (typeof FrequencyMapper !== 'undefined') exports.FrequencyMapper = FrequencyMapper; } catch(e) {}
            try { if (typeof CSVImporter !== 'undefined') exports.CSVImporter = CSVImporter; } catch(e) {}
            try { if (typeof JCAMPImporter !== 'undefined') exports.JCAMPImporter = JCAMPImporter; } catch(e) {}
            try { if (typeof AudioEngine !== 'undefined') exports.AudioEngine = AudioEngine; } catch(e) {}
            try { if (typeof Visualizer !== 'undefined') exports.Visualizer = Visualizer; } catch(e) {}
            try { if (typeof calculateSpectralSimilarity !== 'undefined') exports.calculateSpectralSimilarity = calculateSpectralSimilarity; } catch(e) {}
            try { if (typeof findSimilarSubstances !== 'undefined') exports.findSimilarSubstances = findSimilarSubstances; } catch(e) {}
            try { if (typeof LibraryLoader !== 'undefined') exports.LibraryLoader = LibraryLoader; } catch(e) {}
            try { if (typeof EventRegistry !== 'undefined') exports.EventRegistry = EventRegistry; } catch(e) {}
            try { if (typeof Modal !== 'undefined') exports.Modal = Modal; } catch(e) {}
            try { if (typeof ModalManager !== 'undefined') exports.ModalManager = ModalManager; } catch(e) {}
            try { if (typeof FilterManager !== 'undefined') exports.FilterManager = FilterManager; } catch(e) {}
            try { if (typeof withExportButton !== 'undefined') exports.withExportButton = withExportButton; } catch(e) {}
            try { if (typeof enableExportButton !== 'undefined') exports.enableExportButton = enableExportButton; } catch(e) {}
            try { if (typeof handleExportWAV !== 'undefined') exports.handleExportWAV = handleExportWAV; } catch(e) {}
            try { if (typeof handleExportMP3 !== 'undefined') exports.handleExportMP3 = handleExportMP3; } catch(e) {}
        })
    `;

    const fn = eval(wrappedCode);
    fn(exports, ...Object.values(globals));

    return exports;
}

module.exports = { loadBrowserModule };
