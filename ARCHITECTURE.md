# Architecture Documentation

## Overview

Spectral Synthesizer is a pure vanilla JavaScript web application that sonifies FTIR (Fourier-Transform Infrared) spectroscopy data. It demonstrates the mathematical connection between molecular spectroscopy and audio synthesis through the Fourier transform.

## Design Principles

1. **Zero Dependencies**: No frameworks, no build step, no npm packages for the web app
2. **Progressive Enhancement**: Works without JavaScript (displays content), enhanced with JS
3. **Separation of Concerns**: Clear boundaries between data, logic, and presentation
4. **Configuration-Driven**: All magic numbers extracted to centralized config
5. **Accessibility First**: ARIA labels, keyboard shortcuts, semantic HTML

## Module Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser Environment                │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────────────────────────────────────┐   │
│  │            index.html (UI Layer)             │   │
│  │  - Semantic HTML structure                   │   │
│  │  - Accessibility attributes                  │   │
│  │  - No inline scripts                         │   │
│  └──────────────────────────────────────────────┘   │
│                         │                            │
│                         ▼                            │
│  ┌──────────────────────────────────────────────┐   │
│  │         config.js (Configuration)            │   │
│  │  - All constants and magic numbers           │   │
│  │  - Frozen objects (immutable)                │   │
│  │  - Easy customization point                  │   │
│  └──────────────────────────────────────────────┘   │
│                         │                            │
│        ┌────────────────┴────────────────┐           │
│        ▼                                 ▼           │
│  ┌──────────────────┐        ┌──────────────────┐   │
│  │ Utility Modules  │        │   Core Modules   │   │
│  │                  │        │                  │   │
│  │ • ui-utilities   │        │ • frequency-     │   │
│  │ • visualization- │        │   mapper         │   │
│  │   utilities      │        │ • audio-engine   │   │
│  │ • storage-       │        │ • visualizer     │   │
│  │   utilities      │        │ • csv-importer   │   │
│  │ • tutorial-      │        │ • jcamp-importer │   │
│  │   manager        │        │ • mp3-encoder    │   │
│  │ • analysis-      │        │ • midi-output    │   │
│  │   utilities      │        │                  │   │
│  │ • substance-     │        │                  │   │
│  │   utilities      │        │                  │   │
│  └──────────────────┘        └──────────────────┘   │
│        │                                 │           │
│        └────────────────┬────────────────┘           │
│                         ▼                            │
│  ┌──────────────────────────────────────────────┐   │
│  │         app.js (Application Layer)           │   │
│  │  - Orchestrates all modules (reduced 34%)    │   │
│  │  - Event handling                            │   │
│  │  - State management                          │   │
│  │  - Business logic coordination               │   │
│  └──────────────────────────────────────────────┘   │
│                         │                            │
│                         ▼                            │
│  ┌──────────────────────────────────────────────┐   │
│  │      ftir-library.json (Data Layer)          │   │
│  │  - 381 FTIR spectra from ENFSI               │   │
│  │  - Pre-processed and downsampled             │   │
│  │  - Loaded asynchronously                     │   │
│  └──────────────────────────────────────────────┘   │
│                                                       │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│              Node.js Environment (Build)               │
├───────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐    │
│  │      build-library.js (Build Tool)           │    │
│  │  - Parses JCAMP-DX files                     │    │
│  │  - Converts absorbance to transmittance      │    │
│  │  - Downsamples to ~400 points per spectrum   │    │
│  │  - Outputs ftir-library.json                 │    │
│  └──────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────┘
```

## Modular Architecture (Refactored)

The application has been refactored to improve maintainability and reduce the size of app.js from 3108 lines to 1666 lines (46.4% reduction).

### Utility Modules

**ui-utilities.js** (208 lines)
- `LoadingOverlay` - Loading state management
- `Toast` - Notification system
- `ScreenReader` - Accessibility announcements
- `ErrorHandler` - Centralized error handling
- `iOSAudioHelper` - iOS Safari audio context fixes
- `BrowserCompatibility` - Feature detection
- `MicroInteractions` - UI animations and feedback
- `TimeFormatter` - Time formatting utilities

**visualization-utilities.js** (226 lines)
- `ThumbnailGenerator` - Spectrum thumbnail generation
- `ColorMapper` - Frequency-to-color mapping
- `ResponsiveCanvas` - Mobile-optimized canvas sizing

**storage-utilities.js** (65 lines)
- `Favorites` - localStorage-based favorites management

**tutorial-manager.js** (487 lines)
- `TutorialManager` - Interactive onboarding system
- Tutorial paths for chemistry and music users
- Spotlight and tooltip management

**analysis-utilities.js** (58 lines)
- `calculateSpectralSimilarity` - Cosine similarity calculation
- Used for smart substance suggestions

**substance-utilities.js** (67 lines)
- `categorizeSubstance` - Substance categorization by keywords
- Chemical class detection (opioids, stimulants, benzodiazepines, etc.)

**dom-elements.js** (62 lines)
- Centralized DOM element references
- All `getElementById` calls in one place
- Improves maintainability and reduces duplication

**event-handlers.js** (400 lines)
- Organized event listener setup
- Breaks down the monolithic `setupEventListeners` function
- Grouped by logical categories (mode, substance, playback, sliders, ADSR, MIDI, etc.)

### Benefits of Refactoring

1. **Better Maintainability**: Each module has a single, clear responsibility
2. **Easier AI Agent Usage**: Smaller, focused files are easier to understand and modify
3. **Improved Code Organization**: Related functionality is grouped together
4. **Reduced Cognitive Load**: Developers can focus on specific modules
5. **Better Reusability**: Utilities can be easily reused across the application
6. **Clearer Dependencies**: Module imports make dependencies explicit
7. **Centralized DOM Access**: All element references in one location
8. **Organized Event Handling**: Event listeners grouped logically for better navigation

## Data Flow

### Initialization Flow

1. **Page Load**
   ```
   index.html loads → config.js → modules → app.js
   ```

2. **App Initialization**
   ```
   init() → create instances → loadLibrary() → setupEventListeners()
   ```

3. **Library Loading**
   ```
   fetch(ftir-library.json) → parse JSON → populate UI → ready
   ```

### Playback Flow

1. **User selects substance**
   ```
   handleSubstanceChange() → find spectrum → extractPeaks() → visualize
   ```

2. **User clicks play**
   ```
   handlePlay() → audioEngine.play(peaks) → synthesize audio → visualize FFT
   ```

3. **Audio synthesis**
   ```
   For each peak:
     create oscillator → set frequency/amplitude → apply envelope → mix
   ```

4. **Real-time visualization**
   ```
   requestAnimationFrame → get FFT data → draw bars → repeat
   ```

## Key Algorithms

### 1. Frequency Mapping (frequency-mapper.js)

Converts IR wavenumbers to audio frequencies using logarithmic scaling:

```javascript
audioFreq = exp(log(AUDIO_MIN) + normalized * (log(AUDIO_MAX) - log(AUDIO_MIN)))
```

This preserves perceptual relationships - doubling the IR frequency approximately doubles the audio frequency.

### 2. Peak Detection (frequency-mapper.js)

Identifies local maxima in the absorption spectrum:

```javascript
For each point i:
  if (absorbance[i] > absorbance[i-1] && 
      absorbance[i] > absorbance[i+1] && 
      absorbance[i] > threshold):
    → peak detected
```

### 3. Additive Synthesis (audio-engine.js)

Each peak becomes one oscillator:

```javascript
For each peak:
  frequency = peak.audioFreq
  amplitude = peak.absorbance / numPeaks
  waveform = cycle through [sine, triangle, square]
  envelope = [fade-in, sustain, fade-out]
```

### 4. Amplitude Correction (audio-engine.js)

Applies equal loudness contour correction:

```javascript
correction = min(1.0, 1000 / frequency)
```

Higher frequencies are perceived as louder, so we attenuate them.

## Advanced Features

### 1. Spectral Blending (audio-engine.js)

Weighted combination of two spectra:

```javascript
For each peak in A and B:
  frequencyKey = peak.audioFreq.toFixed(2)
  blendedAbsorbance[frequencyKey] = 
    peakA.absorbance * (1 - ratio) + 
    peakB.absorbance * ratio
```

Where ratio ∈ [0, 1], with 0 = pure A, 1 = pure B.

### 2. JCAMP-DX Import (jcamp-importer.js)

Parses standardized spectroscopy format:

```javascript
// Parse metadata
##TITLE=, ##ORIGIN=, ##MOLFORM=, etc.

// Parse spectrum data
##XYDATA= or ##XYPOINTS=
  Handles compressed and uncompressed formats
  Converts absorbance ↔ transmittance
  Applies XFACTOR and YFACTOR scaling
```

### 3. MP3 Export (mp3-encoder.js)

Browser-based MP3 encoding using lamejs:

```javascript
1. Render audio to offline AudioBuffer
2. Convert Float32 samples to Int16 PCM
3. Encode with lamejs MP3 encoder
4. Create downloadable blob
```

### 4. MIDI Output (midi-output.js)

Maps spectral peaks to MIDI notes:

```javascript
midiNote = 69 + 12 * log2(audioFreq / 440)

// Send as chord or arpeggio
For each peak:
  velocity = peak.absorbance * baseVelocity
  Send note-on, then note-off after duration
```

Uses Web MIDI API to communicate with external synthesizers.

## State Management

### Global State

```javascript
// Module instances (created once)
audioEngine: AudioEngine
frequencyMapper: FrequencyMapper
visualizer: Visualizer
midiOutput: MIDIOutput

// Current data
currentSpectrum: Array<{wavenumber, transmittance}>
currentPeaks: Array<{wavenumber, absorbance, audioFreq}>
libraryData: Array<SubstanceData>

// UI state
comparisonMode: boolean
blendRatio: number
currentSearchTerm: string
currentCategory: string
```

### No Framework State Management

We intentionally avoid React/Vue state management because:
- Simple enough to manage manually
- Better performance for real-time audio visualization
- No learning curve for contributors
- Smaller bundle size

## Performance Considerations

### Optimizations

1. **Debounced Search**: 300ms delay on search input to avoid excessive filtering
2. **Downsampled Data**: ~400 points per spectrum (vs. 1800+ in originals)
3. **RAF Animation**: requestAnimationFrame for smooth 60fps visualization
4. **Canvas Rendering**: Direct canvas API for maximum performance
5. **Frozen Config**: Object.freeze() for V8 optimization

### Performance Bottlenecks

1. **Peak Detection**: O(n) scan of spectrum data (currently fast enough)
2. **Canvas Redraw**: Full redraw on each frame (could cache static elements)
3. **JSON Parsing**: 9.5MB library file (could split/lazy load)

## Security

### XSS Prevention

- No innerHTML with user data
- All user inputs validated
- Library data loaded from same origin
- No eval() or Function() constructor

### Content Security Policy (Recommended)

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';">
```

## Browser Compatibility

### Required APIs

- Web Audio API (Chrome 35+, Firefox 25+, Safari 14.1+)
- Canvas API (all modern browsers)
- ES6 JavaScript (const/let, arrow functions, classes)
- Fetch API (all modern browsers)

### Graceful Degradation

1. No Web Audio API → Show error message
2. No Canvas → Show error message
3. No JavaScript → Content still readable

## Testing Strategy

### Manual Testing Checklist

- [ ] Load library successfully
- [ ] Search and filter substances
- [ ] Select substance and see spectrum
- [ ] Play audio from full spectrum
- [ ] Select individual peaks and play
- [ ] Test all keyboard shortcuts
- [ ] Switch to comparison mode
- [ ] Compare two substances
- [ ] Test audio effects (reverb, filter)
- [ ] Test on mobile device

### Browser Testing

- Chrome (desktop + mobile)
- Firefox (desktop + mobile)
- Safari (desktop + mobile)
- Edge (desktop)

## Future Architecture Improvements

### Potential Enhancements

1. **Module System**: Use ES6 modules with import/export
2. **TypeScript**: Add type safety while keeping build-free for users
3. **Web Workers**: Offload peak detection to background thread
4. **IndexedDB**: Cache library data for faster loading
5. **Service Worker**: Enable offline usage
6. **WebAssembly**: Accelerate DSP operations

### Non-Goals

- Server-side rendering (pure client-side is fine)
- Database backend (JSON file is sufficient)
- User accounts (not needed for this use case)
- Complex build pipeline (keep it simple)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - See [LICENSE](LICENSE) file.
