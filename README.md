# 🎵 Spectral Synthesizer

**Making molecular fingerprints audible through sonification**

## What is this?

Spectral Synthesizer explores the fascinating connection between audio and spectroscopy by making FTIR (Fourier-Transform Infrared) spectra audible. It reveals how the same mathematical tool—the Fourier transform—works in both molecular spectroscopy and audio analysis.

Each molecule has a unique "fingerprint" based on how its chemical bonds absorb infrared light. This tool maps those infrared absorption patterns down to audible frequencies, letting you **hear what molecules sound like**.

**✨ Now with real data!** Includes **943 authentic FTIR spectra** from the [ENFSI DWG IR Library](https://enfsi.eu/) (European Network of Forensic Science Institutes), providing scientifically accurate molecular fingerprints from forensic laboratories.

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

**Quick start (no build):** Open `index.html` in a modern browser. Everything works, but the full FTIR library (~2.6 MB) loads up-front.

```bash
git clone https://github.com/yourusername/spectral-synth.git
cd spectral-synth
open index.html  # or just double-click the file
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
Real FTIR spectra from the ENFSI library, parsed from JCAMP-DX format. On disk each spectrum is stored compactly as a linear wavenumber grid plus an array of transmittance values (`{firstX, lastX, y[]}`, 2-decimal precision — ~15x smaller than point objects); `spectrum-codec.js` expands it to `{wavenumber, transmittance}` points at load time. Lower transmittance = higher absorption = stronger peak.

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
- **Left panel**: FTIR spectrum showing molecular absorption patterns
- **Right panel**: Real-time FFT of the generated audio signal

Both visualizations use the same mathematical transformation, just on different data!

## Technical Details

### Architecture

**Pure vanilla JavaScript** - no framework bloat:
```
index.html           - Main UI structure
style.css            - Styling and layout
config.js            - Centralized configuration and constants
ftir-library.json    - Real FTIR spectra (943 substances, ~2.6MB compact format)
spectrum-codec.js    - Compact spectrum format encoder/decoder
frequency-mapper.js  - IR → audio conversion + prominence-based peak detection
audio-engine.js      - Web Audio API synthesis (one-shot playback + sustained voices)
midi-output.js       - Pitch-accurate MIDI out (per-note pitch bend) + .mid export
midi-input.js        - Play substances from a MIDI keyboard
browse-manager.js    - Visual library browser with spectrum sparklines
visualizer.js        - Canvas-based visualization
app.js               - Main application coordinator
build-library.js     - JCAMP-DX parser & library builder (Node.js)
split-library.js     - Category chunking + content-hash versioning (Node.js)
migrate-library.js   - One-off converter: legacy point arrays → compact format
CONTRIBUTING.md      - Contribution guidelines
LICENSE              - MIT License
```

### Project Structure

The application follows a modular architecture with clear separation of concerns:

1. **Configuration Layer** (`config.js`)
   - Centralized settings for all modules
   - Easy customization without touching code
   - Immutable configuration to prevent accidents

2. **Data Layer** (`ftir-library.json` + `spectrum-codec.js`)
   - Real FTIR spectra from ENFSI database
   - Compact storage format: linear grid + rounded transmittance values, category baked in
   - Decoded at the load boundary; the rest of the app sees plain point arrays
   - Lazy-loaded per category in production, cached in IndexedDB, invalidated by content hash

3. **Core Modules**
   - `frequency-mapper.js` - Handles IR to audio frequency conversion and peak detection
   - `audio-engine.js` - Manages Web Audio API synthesis and effects
   - `visualizer.js` - Renders FTIR spectra and audio FFT visualizations

4. **Application Layer** (`app.js`)
   - Coordinates between all modules
   - Manages UI state and user interactions
   - Handles error recovery and edge cases

5. **Presentation Layer** (`index.html`, `style.css`)
   - Accessible, semantic HTML structure
   - Responsive CSS design
   - Progressive enhancement approach

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

The library includes **943 curated FTIR spectra** from the ENFSI DWG IR Library, covering a comprehensive range of recreational drugs:

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

The `ftir-library.json` file was built by downloading the ENFSI library and processing it with `build-library.js`, which extracts and converts spectra from authentic forensic laboratory measurements.

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
node build-library.js
```

The builder:
1. Parses JCAMP-DX format (.JDX files)
2. Converts absorbance → transmittance
3. Downsamples to ~400 points per spectrum
4. Categorizes each substance and encodes spectra in the compact grid format
5. Outputs `ftir-library.json`

If you have an older `ftir-library.json` with point-array spectra, run
`node migrate-library.js` once to convert it in place (~15x smaller).

Edit `build-library.js` to customize which substances are included.

### Customizing the Mapping

Edit `frequency-mapper.js` constructor:

```javascript
this.AUDIO_MIN = 100;  // Minimum audio frequency
this.AUDIO_MAX = 8000; // Maximum audio frequency
```

### Adjusting Synthesis

Edit `audio-engine.js` play method:
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
- **MIDI input** - play the selected substance from a MIDI keyboard: C4 = native pitch, other keys transpose the whole peak set, velocity controls loudness, notes sustain until released (polyphonic)
- Note timing uses Web MIDI timestamped sends, so notes don't stick when the tab is backgrounded

### Library Browser
Click **🔬 Browse** for a searchable card grid of all 943 substances with lazily rendered spectrum sparklines, formula/MW metadata, and category chips. Clicking any peak row in the mapping table auditions that single peak.

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
