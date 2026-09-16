# 🎵 Spectral Synthesizer

**Making molecular fingerprints audible through sonification**

## What is this?

Spectral Synthesizer explores the fascinating connection between audio and spectroscopy by making FTIR (Fourier-Transform Infrared) spectra audible. It reveals how the same mathematical tool—the Fourier transform—works in both molecular spectroscopy and audio analysis.

Each molecule has a unique "fingerprint" based on how its chemical bonds absorb infrared light. This tool maps those infrared absorption patterns down to audible frequencies, letting you **hear what molecules sound like**.

**✨ Real data.** Includes **1,384 compounds with authentic FTIR spectra** (chosen from 4,061 measurements) in the [ENFSI DWG IR Library](https://enfsi.eu/) (European Network of Forensic Science Institutes), providing scientifically accurate molecular fingerprints from forensic laboratories.

## The Core Concept

Both FTIR spectroscopy and audio visualization use **Fourier transforms** to decompose complex signals into frequency components:

- **FTIR spectroscopy**: Analyzes molecular vibrations (~10¹³ Hz) as infrared light absorption
- **Audio analysis**: Analyzes sound waves (~100-10000 Hz) as pressure variations

A drug's spectral fingerprint is literally a frequency spectrum—just like audio. By mapping IR frequencies down to audible range, we can sonify chemistry. MDMA sounds different from ketamine because their molecular structures absorb light differently.

## Why This Is Interesting

- **Mathematical elegance**: Same equation (FFT), different data—sound waves vs molecular vibrations
- **Novel perspective**: Nobody thinks about spectroscopy as audio
- **Synesthetic experience**: Adds a sensory dimension to analytical chemistry
- **Educational potential**: Makes abstract spectroscopy concepts concrete and visceral
- **Creative tool**: Unusual audio synthesis technique based on real molecular data

## Live Demo

The app works in two modes:

**Development (no build):** serve the repo root with any static server — the browser loads the ES modules straight from `src/`. (Opening `index.html` from `file://` won't work: module scripts need an HTTP origin.) The full FTIR library (~2.6 MB) loads up-front in this mode.

```bash
git clone https://github.com/yourusername/spectral-synth.git
cd spectral-synth
npm install
npm run dev             # http://localhost:4174
```

**Production / fast load:** Run the build once. This bundles + minifies the JS/CSS and splits the library into per-category chunks that load on demand, with IndexedDB offline caching and content-hash cache invalidation.

```bash
npm install
npm run build           # outputs dist/
npx serve dist          # or deploy dist/ to Vercel / any static host
```

`vercel.json` is already wired up so a Vercel deploy runs the build automatically.

## How It Works

### 1. Data Input
Real FTIR spectra from the ENFSI library, parsed from JCAMP-DX format. On disk each spectrum is stored compactly as a linear wavenumber grid plus an array of transmittance values (`{firstX, lastX, y[]}`, 2-decimal precision — ~15x smaller than point objects); `src/data/spectrum-codec.js` expands it to `{wavenumber, transmittance}` points at load time. Lower transmittance = higher absorption = stronger peak.

### 2. Frequency Mapping
```
IR wavenumbers (400-4000 cm⁻¹) → Audio frequencies (100-8000 Hz)
```

Uses **logarithmic scaling** to preserve perceptual relationships. High IR frequencies map to high audio frequencies.

### 3. Peak Detection
Prominence-based peak detection (scipy-style): a local maximum only counts if it rises far enough above the surrounding baseline, which rejects noise ripples and shoulder artifacts. Each peak carries its prominence and width (full width at half prominence), and width is reported in the peak table and data exports.

### 4. Additive Synthesis
Each absorption peak becomes an oscillator:
- **Frequency**: Mapped audio frequency from IR wavenumber
- **Amplitude**: Based on absorption intensity
- **Waveform**: Mix of sine, triangle, and square waves for richness

### 5. Dual Visualization
- **FTIR Spectrum** (top): molecular absorption pattern; click peaks to isolate them. While a sound plays, the peak being sounded lights up in time with the note (driven by the AudioContext clock, so it stays in sync).
- **Audio FFT** (bottom): real-time FFT of the generated audio signal

The picker opens on a **Common** filter — the ~45 substances most people recognise — so the first visit isn't a scroll through 900 research chemicals; toggle it off (or just search, which bypasses it) to see everything. On desktop the substance picker sits to the left and both charts fill the remaining height, so the whole tool is visible without scrolling. On phones it stacks into a single column.

Both visualizations use the same mathematical transformation, just on different data!

## Technical Details

### Architecture

**Vanilla JavaScript, native ES modules, no framework.** esbuild bundles for production; in development the browser loads `src/` directly.

```
index.html                  Page shell (markup for the app + all dialogs)
service-worker.js           PWA offline cache
data/ftir-library.json      Real FTIR spectra (1,384 compounds, ~4 MB compact format)
src/
  app.js                    Entry point: creates instances, loads the library, wires modules
  core/                     config, constants, logger, app-state, favorites, context (shared instances)
  audio/                    audio-engine (Web Audio synthesis), frequency-mapper (IR → Hz + peaks),
                            playback-controller, mp3-encoder
  data/                     spectrum-codec, library-loader (lazy chunks + IndexedDB), importers
                            (CSV, JCAMP-DX), substance categorisation, spectral similarity
  midi/                     midi-output (pitch-accurate, per-note bend), midi-pack (DAW-ready SMF
                            builder for the batch export), midi-input, midi-handlers
  ui/                       dom accessors, filter-manager, browse-manager, visualizer, modals,
                            onboarding/tutorial, keyboard shortcuts, theme, event wiring
  styles/                   base / components / modals / responsive (main.css imports them)
scripts/                    Node tooling: build (esbuild), build-library, split-library,
                            migrate-library, batch-export-midi
tests/                      Jest (jsdom, native ESM)
```

### How the pieces fit

- **`src/core/context.js`** holds the handful of shared instances (`audioEngine`, `visualizer`, `frequencyMapper`, MIDI, the loaded library and the current spectrum/peaks). `app.js` fills it during `init()`; other modules read from it instead of reaching for globals.
- **`src/ui/dom.js`** exposes the elements the app touches repeatedly as live getters (`dom.playButton`, `dom.substanceSelect`…), so modules can be imported before the DOM exists (tests, bundling).
- **Data layer** — spectra are stored compactly (`{firstX, lastX, y[]}`, category baked in) and decoded at the load boundary by `spectrum-codec.js`; everything downstream sees `{wavenumber, transmittance}` arrays. Production loads per-category chunks lazily (`dist/library/`), caches them in IndexedDB, and invalidates by content hash.
- **Feature modules** own their DOM and events: `filter-manager` (search/category chips/favourites → substance select), `substance-selection` (what happens on change), `playback-controller` (Play/Stop, peak selection), `browse-manager` (sparkline grid), `menu-modals` + `favorites-modal` + `onboarding`.
- **Node scripts** import the same modules (`spectrum-codec`, `substance-utilities`, `frequency-mapper`, `midi-output`) — there is one implementation of each, shared between browser and tooling.

### Key Algorithms

**Logarithmic frequency mapping:**
```javascript
audioFreq = exp(log(AUDIO_MIN) + normalized * (log(AUDIO_MAX) - log(AUDIO_MIN)))
```

**Peak detection:**
- Find local maxima in absorbance data
- Filter by threshold intensity
- Sort by strength and take top N peaks

**Additive synthesis:**
- Each peak = one oscillator at mapped frequency
- Amplitude scaled by absorption intensity
- Envelope: 50ms fade-in, sustain, 100ms fade-out

### Tech Stack

- **Web Audio API**: Real-time audio synthesis and analysis
- **Canvas API**: 2D visualization rendering with mobile optimization
- **Vanilla JavaScript**: No dependencies, no build step
- **Pure CSS**: Fully responsive design with mobile-first approach
- **Progressive Enhancement**: Touch-optimized interactions for mobile devices

## Data Source

The library includes **1,384 compounds** from the ENFSI DWG IR Library (release 2026-03-06). ENFSI distributes 4,061 measurements — the same compound as HCl salt and free base, by ATR and by GC-IR, from several labs — and the builder keeps one representative spectrum per compound (ATR direct measurement preferred), with the other names as searchable aliases. It covers:

- **Stimulants**: Amphetamines (100+ variants), MDMA, MDA, Cocaine, Methamphetamine, Mephedrone, Cathinones, Caffeine
- **Opioids**: Morphine, Heroin, Codeine, Oxycodone, Hydrocodone, Buprenorphine, Methadone
- **Synthetic Opioids**: Fentanyl and 50+ analogs (acetylfentanyl, carfentanyl, furanylfentanyl, etc.)
- **Dissociatives**: Ketamine variants, PCP, PCE compounds, Phenidines, Methoxetamine
- **Psychedelics**: LSD and analogs (1P-LSD, 1cP-LSD, etc.), 2C-series, NBOMes, DOx compounds
- **Tryptamines**: DMT, DPT, DiPT, 5-MeO-DiPT, 4-AcO-DPT, Alpha-Methyltryptamine
- **Benzodiazepines**: Diazepam, Alprazolam, Clonazepam, Flualprazolam, Etizolam, and 20+ others
- **Cannabinoids**: THC, CBD, synthetic cannabinoids (JWH series, AM-2201, UR-144, etc.)
- **Steroids**: Testosterone, Trenbolone, Stanozolol, and anabolic derivatives
- **Precursors**: BMK, PMK, Safrole, Glycidates, Benzaldehydes (chemical intermediates)
- **Novel Psychoactive Substances**: Alpha-PVP, MDPV, research chemicals, designer drugs

Each spectrum is from actual forensic laboratory measurements, providing authentic molecular fingerprints. With nearly 1,000 substances, this comprehensive database allows you to hear the unique "sound" of almost any common recreational drug!

### ENFSI Library Connection

The application uses data directly from the [ENFSI DWG IR Library](https://enfsi.eu/) (European Network of Forensic Science Institutes):

- **Source**: Official ENFSI library containing 3,900+ validated FTIR spectra
- **Format**: JCAMP-DX standard format for spectroscopic data
- **Processing**: Original ENFSI `.JDX` files are parsed and converted to JSON
- **Verification**: Each spectrum includes:
  - Molecular formula (e.g., C8H10N4O2 for caffeine)
  - Molecular weight (e.g., 194.1915 for caffeine)
  - CAS name and chemical identifiers
  - Source attribution: "ENFSI DWG IR Library"

The `data/ftir-library.json` file was built by downloading the ENFSI library and processing it with `scripts/build-library.js`, which extracts and converts spectra from authentic forensic laboratory measurements.

## Educational Use

This tool demonstrates:

- **Fourier transforms** working in parallel on molecular and audio data
- **Peak analysis** in spectroscopy
- **Frequency domain** representation
- **Additive synthesis** principles
- **Data sonification** as a communication tool

Perfect for:
- Chemistry students learning FTIR spectroscopy
- Physics students studying Fourier analysis
- Audio engineers exploring novel synthesis techniques
- Anyone curious about the intersection of chemistry and sound

## Extending the Project

### Rebuilding the Library

The library is built from JCAMP-DX files using Node.js:

```bash
# Download ENFSI library (or use your own JCAMP-DX files)
curl -L -o enfsi_library.zip "https://enfsi.eu/download/ENFSI_DWG_IR_Library_JCAMP-DX_20250429.zip"
unzip enfsi_library.zip -d enfsi_data

# Run the library builder
node scripts/build-library.js
```

The builder:
1. Parses JCAMP-DX format (.JDX files)
2. Converts absorbance → transmittance
3. Downsamples to ~400 points per spectrum
4. Categorizes each substance and encodes spectra in the compact grid format
5. Outputs `data/ftir-library.json`

If you have an older `ftir-library.json` with point-array spectra, run
`node scripts/migrate-library.js` once to convert it in place (~15x smaller).

Edit `scripts/build-library.js` to customize which substances are included.

### Customizing the Mapping

Edit `src/audio/frequency-mapper.js` constructor:

```javascript
this.AUDIO_MIN = 100;  // Minimum audio frequency
this.AUDIO_MAX = 8000; // Maximum audio frequency
```

### Adjusting Synthesis

Edit `src/audio/audio-engine.js` play method:
- Change waveform types
- Modify amplitude scaling
- Adjust envelope parameters
- Add effects (reverb, delay, etc.)

## Limitations & Disclaimers

⚠️ **This is NOT for substance identification or drug checking**

- Simplified FTIR data (real spectra have thousands of points)
- Educational/artistic tool only
- No clinical or forensic accuracy
- Web-only (requires modern browser with Web Audio API)

## Scientific Accuracy

The project uses **real scientific data**:
- ✅ Authentic FTIR spectra from ENFSI forensic laboratories
- ✅ Accurate peak locations and intensities
- ✅ Proper functional group assignments
- ✅ Correct Fourier transform mathematics
- ⚠️ Downsampled to ~400 points for web performance (from typically 1800+ points)
- ⚠️ Artistic liberties in sonification (waveforms, amplitude scaling)

## Browser Compatibility

Requires modern browser with:
- Web Audio API
- Canvas API
- ES6 JavaScript

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Mobile Support

**Fully optimized for mobile devices!** 📱

The application features comprehensive mobile enhancements:

- **Responsive Design**: Automatic layout adjustments for phones and tablets
- **Touch-Optimized**: All buttons and controls sized for easy touch interaction (44px minimum)
- **Smart Canvas Sizing**: Automatically adjusts visualization sizes for mobile screens
- **Device Pixel Ratio**: High-DPI display support for sharp graphics on retina screens
- **Orientation Support**: Works in both portrait and landscape modes
- **Performance Optimized**: Efficient canvas rendering for smooth mobile experience
- **Landscape Mode**: Special optimizations for horizontal viewing

**Mobile Browsers:**
- Chrome Mobile 90+
- Safari iOS 14+
- Firefox Mobile 88+
- Samsung Internet 14+

**Tips for Mobile Use:**
- Rotate to landscape for a better view of visualizations
- Use headphones for the best audio experience
- Swipe and scroll smoothly through substance lists
- All controls are easily reachable with one hand

**iPhone & iPad audio:**

iOS mutes web audio in ways other platforms do not, so the synthesiser asks for
the `playback` audio session category on load. That means sound plays even with
the ringer/silent switch on, exactly like a music app — check your volume rather
than the mute switch if you hear nothing. Audio also starts on your first tap
anywhere on the page, and recovers by itself after a phone call, Siri, or
switching apps. On iOS versions older than 16.4 the same result is achieved with
a looping silent audio clip. See `src/audio/ios-audio.js` for the details.

## New Features

### Import & Export
- **CSV Import**: Import your own FTIR spectral data from CSV files
  - Auto-detects file format (transmittance or absorbance)
  - Validates and downsamples data for optimal performance
  - Download template CSV for correct formatting
- **WAV Export**: Export synthesized audio as high-quality WAV files
  - Preserves all current effect settings
  - Automatic filename generation
  - **Zero dependencies** - works entirely in the browser
- **MP3 Export** (Optional): Export as MP3 format
  - Requires [lamejs](https://github.com/zhuker/lamejs) library
  - To enable: Download lamejs and add `<script src="lame.min.js"></script>` before other scripts
  - WAV export is recommended for zero-dependency operation

### Audio Effect Presets
Six curated presets for different sonic characteristics:
- **Clean** - No effects, pure synthesis
- **Ambient** - Large reverb space
- **Warm** - Low-pass filtered warmth
- **Bright** - Full spectrum with light reverb
- **Underwater** - Heavy filtering and reverb
- **Cathedral** - Massive reverb space

Use the preset dropdown to quickly apply professional effect combinations!

### Data Export
Export the analysis, not just the audio:
- **Peak Table (CSV)** - wavenumber, intensity, prominence, width, mapped audio frequency, MIDI note + cent offset, functional group
- **Peak Analysis (JSON)** - the peak table plus full provenance: substance metadata, mapping parameters, and detection settings for reproducibility
- **Spectrum (CSV)** - the current spectrum as `wavenumber,transmittance`, round-trippable with the CSV importer

### MIDI
- **Pitch-accurate output** (default) - spectral peaks rarely land on 12-TET semitones, and those microtonal offsets are part of the molecular fingerprint. Notes are spread across MIDI channels with per-note pitch bends (MPE-style, bend range configurable and announced via RPN 0), so external synths and DAWs play the exact peak frequencies. Disable for single-channel synths (quantizes to nearest semitone).
- **MIDI file export** - Standard MIDI File (.mid) with the same pitch-bend treatment, honoring the current playback mode and tempo
- **Batch MIDI pack** - `npm run export-midi` renders the whole library as DAW-ready Type 1 files: one per substance with a named chord track and a 1/16-grid sequence track (top 16 peaks, one bar, velocities normalised, same-semitone peaks merged), plus an `index.csv` with formula, closest key and note list. Flags for grid, peak cap, chord length, octave folding and Euclidean spreading — `node scripts/batch-export-midi.js --help`
- **MIDI input** - play the selected substance from a MIDI keyboard: C4 = native pitch, other keys transpose the whole peak set, velocity controls loudness, notes sustain until released (polyphonic)
- Note timing uses Web MIDI timestamped sends, so notes don't stick when the tab is backgrounded

### Library Browser
Click **🔬 Browse** for a searchable card grid of every compound with lazily rendered spectrum sparklines, formula/MW metadata, and category chips. Clicking any peak row in the mapping table auditions that single peak.

### Playback Modes
Six different ways to experience molecular fingerprints:
- **Chord** - All peaks play simultaneously (traditional mode)
- **Arpeggio (Up)** - Play peaks from low to high frequency
- **Arpeggio (Down)** - Play peaks from high to low frequency
- **Arpeggio (Up-Down)** - Play peaks up then back down
- **Sequential** - Play peaks in order of intensity (strongest first)
- **Random** - Play peaks in random order for unexpected patterns

Arpeggiation creates melodic sequences from spectral data, offering a completely different musical perspective on molecular structure!

## Roadmap

### Completed Features ✅
- Import custom FTIR data (CSV)
- Import JCAMP-DX files (standardized spectroscopy format)
- Export audio files (WAV and MP3)
- Audio effect presets
- Arpeggiation and playback modes
- Mobile-optimized touch interface
- Mix multiple substances (spectral blending)
- MIDI output for external synthesizers (pitch-accurate, per-note pitch bend)
- MIDI input — play substances from a keyboard
- Peak table / spectrum data export with provenance
- Visual library browser with spectrum sparklines
- Prominence-based peak detection with width estimates
- Compact library format (~2.6 MB) with content-hash cache invalidation

### Future Enhancements

**Long-term** (if there's community interest):
- Enhanced 3D visualizations
- Real-time spectrometer integration
- Advanced spectral analysis tools

## License

MIT License - feel free to use, modify, and distribute.

## Contributing

Contributions welcome! Areas of interest:
- More substance spectra
- Improved sonification algorithms
- Better visualizations
- Educational content
- Bug fixes and optimizations

## Credits

Created to explore the beautiful intersection of chemistry, physics, mathematics, and audio synthesis.

FTIR spectral patterns based on scientific literature and spectroscopic databases.

---

**"Same math, different data—hear the difference."**
