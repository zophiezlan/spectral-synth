# 🎵 Spectral Synthesizer

**Making molecular fingerprints audible through sonification**

## What is this?

Spectral Synthesizer explores the fascinating connection between audio and spectroscopy by making FTIR (Fourier-Transform Infrared) spectra audible. It reveals how the same mathematical tool—the Fourier transform—works in both molecular spectroscopy and audio analysis.

Each molecule has a unique "fingerprint" based on how its chemical bonds absorb infrared light. This tool maps those infrared absorption patterns down to audible frequencies, letting you **hear what molecules sound like**.

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
FTIR spectra stored as JSON arrays of `{wavenumber, transmittance}` pairs. Lower transmittance = higher absorption = stronger peak.

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
spectral-data.js     - FTIR spectrum database
frequency-mapper.js  - IR → audio conversion algorithms
audio-engine.js      - Web Audio API synthesis
visualizer.js        - Canvas-based visualization
app.js              - Main application coordinator
```

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

## Substances Included

Current database includes FTIR spectra for:

1. **MDMA** (3,4-Methylenedioxymethamphetamine)
   - Distinctive methylenedioxy bridge peaks
   - Aromatic and amine signatures

2. **Ketamine**
   - Strong carbonyl peak at ~1720 cm⁻¹
   - Aromatic rings and C-Cl stretch

3. **Caffeine**
   - Multiple carbonyl peaks (purines)
   - Complex aromatic system

4. **Aspirin** (Acetylsalicylic Acid)
   - Dual carbonyls (ester + acid)
   - Broad O-H stretch

Each produces a distinctly different sound based on its molecular structure!

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

### Adding New Substances

Edit `spectral-data.js` and add to `SPECTRAL_DATABASE`:

```javascript
mysubstance: {
    name: 'Display Name',
    description: 'Key spectroscopic features',
    spectrum: [
        {wavenumber: 3400, transmittance: 85},
        {wavenumber: 1700, transmittance: 45},
        // ... more points
    ]
}
```

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

The project uses **scientifically grounded principles**:
- ✅ Real FTIR peak locations and patterns
- ✅ Accurate functional group assignments
- ✅ Proper Fourier transform mathematics
- ⚠️ Simplified spectra for performance
- ⚠️ Artistic liberties in sonification choices

## Browser Compatibility

Requires modern browser with:
- Web Audio API
- Canvas API
- ES6 JavaScript

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Future Ideas

Potential enhancements:
- [ ] Import custom FTIR data (CSV/JCAMP-DX)
- [ ] Mix multiple substances (spectral blending)
- [ ] Export audio files (WAV/MP3)
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
