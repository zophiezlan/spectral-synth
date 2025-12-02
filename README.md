# 🎵 Spectral Synthesizer

**Making molecular fingerprints audible through sonification**

## What is this?

Spectral Synthesizer explores the fascinating connection between audio and spectroscopy by making FTIR (Fourier-Transform Infrared) spectra audible. It reveals how the same mathematical tool—the Fourier transform—works in both molecular spectroscopy and audio analysis.

Each molecule has a unique "fingerprint" based on how its chemical bonds absorb infrared light. This tool maps those infrared absorption patterns down to audible frequencies, letting you **hear what molecules sound like**.

**✨ Now with real data!** Includes **381 authentic FTIR spectra** from the [ENFSI DWG IR Library](https://enfsi.eu/) (European Network of Forensic Science Institutes), providing scientifically accurate molecular fingerprints from forensic laboratories.

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

Simply open `index.html` in a modern web browser. No build step or server required!

```bash
# Clone and open
git clone https://github.com/yourusername/spectral-synth.git
cd spectral-synth
open index.html  # or just double-click the file
```

## How It Works

### 1. Data Input
Real FTIR spectra from the ENFSI library, parsed from JCAMP-DX format and converted to JSON arrays of `{wavenumber, transmittance}` pairs. Lower transmittance = higher absorption = stronger peak.

### 2. Frequency Mapping
```
IR wavenumbers (400-4000 cm⁻¹) → Audio frequencies (100-8000 Hz)
```

Uses **logarithmic scaling** to preserve perceptual relationships. High IR frequencies map to high audio frequencies.

### 3. Peak Detection
Algorithm identifies local maxima in absorption spectrum—these are the characteristic peaks that define each molecule.

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
ftir-library.json    - Real FTIR spectra (381 substances, 9.5MB)
frequency-mapper.js  - IR → audio conversion algorithms
audio-engine.js      - Web Audio API synthesis
visualizer.js        - Canvas-based visualization
app.js               - Main application coordinator
build-library.js     - JCAMP-DX parser & library builder (Node.js)
CONTRIBUTING.md      - Contribution guidelines
LICENSE              - MIT License
```

### Project Structure

The application follows a modular architecture with clear separation of concerns:

1. **Configuration Layer** (`config.js`)
   - Centralized settings for all modules
   - Easy customization without touching code
   - Immutable configuration to prevent accidents

2. **Data Layer** (`ftir-library.json`)
   - Real FTIR spectra from ENFSI database
   - Pre-processed for web performance
   - Loaded asynchronously on startup

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
- **Canvas API**: 2D visualization rendering
- **Vanilla JavaScript**: No dependencies, no build step
- **Pure CSS**: Responsive design with gradient aesthetics

## Data Source

The library includes **381 curated FTIR spectra** from the ENFSI DWG IR Library, covering:

- **Controlled substances**: MDMA, Cocaine, Heroin, LSD, Ketamine, Mephedrone
- **Pharmaceuticals**: Codeine, Morphine, Buprenorphine, Methadone, Diazepam
- **Stimulants**: Amphetamines, Methamphetamine, Caffeine, various analogs
- **Synthetic opioids**: Fentanyl and dozens of analogs
- **Steroids**: Testosterone and derivatives
- **And many more**: Including precursors, metabolites, and designer drugs

Each spectrum is from actual forensic laboratory measurements, providing authentic molecular fingerprints. The substances produce distinctly different sounds based on their unique molecular structures!

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
4. Outputs `ftir-library.json`

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

## New Features

### Import & Export
- **CSV Import**: Import your own FTIR spectral data from CSV files
  - Auto-detects file format (transmittance or absorbance)
  - Validates and downsamples data for optimal performance
  - Download template CSV for correct formatting
- **WAV Export**: Export synthesized audio as high-quality WAV files
  - Preserves all current effect settings
  - Automatic filename generation

### Audio Effect Presets
Six curated presets for different sonic characteristics:
- **Clean** - No effects, pure synthesis
- **Ambient** - Large reverb space
- **Warm** - Low-pass filtered warmth
- **Bright** - Full spectrum with light reverb
- **Underwater** - Heavy filtering and reverb
- **Cathedral** - Massive reverb space

Use the preset dropdown to quickly apply professional effect combinations!

## Future Ideas

Potential enhancements:
- [x] Import custom FTIR data (CSV) ✅
- [x] Export audio files (WAV) ✅
- [x] Audio effect presets ✅
- [ ] Mix multiple substances (spectral blending)
- [ ] JCAMP-DX file import
- [ ] MP3 audio export
- [ ] MIDI output for external synths
- [ ] 3D visualization (spectrogram waterfall)
- [ ] Mobile-optimized touch interface
- [ ] Real-time spectrometer input
- [ ] Machine learning substance classification

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
