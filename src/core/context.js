/**
 * Application Context
 *
 * The handful of long-lived instances and the currently loaded spectrum,
 * shared between modules. app.js creates the instances during init();
 * everything else reads (and, for the current spectrum, writes) through
 * this object instead of reaching for globals.
 *
 * Keep it small — anything that can be passed as an argument should be.
 */

export const ctx = {
    /** @type {import('../audio/audio-engine.js').AudioEngine|null} */
    audioEngine: null,
    /** @type {import('../ui/visualizer.js').Visualizer|null} */
    visualizer: null,
    /** @type {import('../audio/frequency-mapper.js').FrequencyMapper|null} */
    frequencyMapper: null,
    /** @type {import('../midi/midi-output.js').MIDIOutput|null} */
    midiOutput: null,
    /** @type {import('../midi/midi-input.js').MIDIInput|null} */
    midiInput: null,

    /** Decoded library records: [{ id, name, formula, spectrum, ... }] */
    libraryData: null,
    /** Lazy-loading index from library-loader (null when using the monolith) */
    libraryIndex: null,

    /** Spectrum of the selected substance: [{ wavenumber, transmittance }] */
    currentSpectrum: null,
    /** Peaks extracted from currentSpectrum by FrequencyMapper */
    currentPeaks: null,
};
