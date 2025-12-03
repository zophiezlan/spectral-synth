# Project Structure

This document describes the organization of the Spectral Synthesizer codebase after the major restructuring in v2.0.

## Directory Overview

```
spectral-synth/
├── .github/
│   └── workflows/          # GitHub Actions CI/CD workflows
│       ├── ci.yml          # Continuous integration (lint, test, security)
│       └── deploy.yml      # Deployment to GitHub Pages
├── data/                   # Application data
│   └── ftir-library.json   # FTIR spectroscopy library (9.5MB)
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md     # System architecture and design
│   ├── CHANGELOG.md        # Version history
│   ├── CONTRIBUTING.md     # Contribution guidelines
│   ├── IMPROVEMENTS.md     # Phase 3 improvements log
│   ├── REFACTORING.md      # Refactoring case study
│   ├── REVIEW_FINDINGS.md  # UX/UI consistency audit
│   └── UX_IMPROVEMENTS.md  # User experience enhancements
├── public/                 # Publicly served files
│   ├── index.html          # Main HTML entry point
│   ├── manifest.json       # PWA manifest
│   └── styles/             # CSS stylesheets
│       └── style.css       # Main stylesheet (2,652 lines)
├── scripts/                # Build and utility scripts
│   └── build-library.js    # JCAMP-DX to JSON converter
├── src/                    # Source code
│   ├── config/             # Configuration modules
│   │   ├── config.js       # Application configuration
│   │   ├── constants.js    # Application constants
│   │   └── dom-elements.js # Centralized DOM references
│   ├── core/               # Core application modules
│   │   ├── app.js          # Main application coordinator
│   │   ├── audio-engine.js # Web Audio API synthesis
│   │   ├── frequency-mapper.js # IR to audio frequency mapping
│   │   ├── midi-output.js  # Web MIDI API integration
│   │   └── visualizer.js   # Canvas-based visualization
│   ├── encoders/           # Audio encoding modules
│   │   └── mp3-encoder.js  # MP3 export functionality
│   ├── handlers/           # Event handler modules
│   │   ├── event-handlers.js       # Main event handlers
│   │   ├── handlers-import-export.js # Import/export handlers
│   │   └── handlers-midi.js        # MIDI handlers
│   ├── importers/          # Data import modules
│   │   ├── csv-importer.js  # CSV FTIR data import
│   │   └── jcamp-importer.js # JCAMP-DX file parser
│   ├── pwa/                # Progressive Web App modules
│   │   ├── service-worker.js # Offline caching strategy
│   │   └── sw-register.js    # Service worker registration
│   └── utils/              # Utility modules
│       ├── analysis-utilities.js     # Spectral similarity
│       ├── performance-utilities.js  # Debounce, throttle, RAF
│       ├── storage-utilities.js      # localStorage management
│       ├── substance-utilities.js    # Chemical categorization
│       ├── tutorial-manager.js       # Interactive onboarding
│       ├── ui-utilities.js           # UI helpers (Toast, Loading, etc.)
│       └── visualization-utilities.js # Canvas helpers
├── tests/                  # Test files
│   ├── setup.js            # Jest test setup
│   ├── unit/               # Unit tests
│   │   └── storage-utilities.test.js
│   └── integration/        # Integration tests (future)
├── .editorconfig           # Editor configuration
├── .gitignore              # Git ignore rules
├── eslint.config.js        # ESLint configuration
├── jest.config.js          # Jest testing configuration
├── LICENSE                 # MIT License
├── package.json            # Node.js package configuration
├── README.md               # Main project documentation
└── STRUCTURE.md            # This file

```

## Module Organization

### Configuration Layer (`src/config/`)

**Purpose**: Centralized configuration and constants

- **config.js**: All configurable parameters (frequency ranges, audio settings, presets)
- **constants.js**: Application constants (timing, UI, validation)
- **dom-elements.js**: Centralized DOM element references

**Loading Order**: Must be loaded first, before any other modules

### Core Layer (`src/core/`)

**Purpose**: Core application logic and synthesis engine

- **app.js** (1,418 lines): Main application coordinator, state management
- **audio-engine.js** (1,087 lines): Web Audio API synthesis, effects, export
- **frequency-mapper.js** (145 lines): IR to audio frequency conversion
- **visualizer.js** (639 lines): Canvas-based spectrum and FFT visualization
- **midi-output.js** (531 lines): Web MIDI API integration

**Dependencies**: Requires config layer, utility modules

### Utilities Layer (`src/utils/`)

**Purpose**: Reusable utility functions and helpers

- **ui-utilities.js**: LoadingOverlay, Toast, ScreenReader, ErrorHandler
- **visualization-utilities.js**: ThumbnailGenerator, ColorMapper, ResponsiveCanvas
- **storage-utilities.js**: Favorites management via localStorage
- **tutorial-manager.js**: Interactive onboarding system
- **analysis-utilities.js**: Spectral similarity calculations
- **substance-utilities.js**: Chemical class categorization
- **performance-utilities.js**: Debounce, throttle, RAF management

**Dependencies**: Requires config layer only

### Handlers Layer (`src/handlers/`)

**Purpose**: Event handling and user interaction

- **event-handlers.js**: Main UI event handlers
- **handlers-import-export.js**: Import/export event handlers
- **handlers-midi.js**: MIDI device and export handlers

**Dependencies**: Requires config, utils, core modules

### Importers Layer (`src/importers/`)

**Purpose**: Data import from various formats

- **csv-importer.js**: Import custom FTIR data from CSV
- **jcamp-importer.js**: Parse JCAMP-DX spectroscopy files

**Dependencies**: Requires config layer

### Encoders Layer (`src/encoders/`)

**Purpose**: Audio encoding and export

- **mp3-encoder.js**: MP3 export functionality (optional lamejs dependency)

**Dependencies**: Requires audio-engine

### PWA Layer (`src/pwa/`)

**Purpose**: Progressive Web App functionality

- **service-worker.js**: Offline caching strategy, asset management
- **sw-register.js**: Service worker registration and lifecycle

**Dependencies**: Standalone (runs in separate worker context)

## Loading Order

The application uses a specific loading order to manage dependencies:

```html
<!-- 1. Configuration -->
<script src="../src/config/config.js"></script>
<script src="../src/config/constants.js"></script>

<!-- 2. Utilities -->
<script src="../src/utils/ui-utilities.js"></script>
<script src="../src/utils/visualization-utilities.js"></script>
<script src="../src/utils/storage-utilities.js"></script>
<script src="../src/utils/tutorial-manager.js"></script>
<script src="../src/utils/analysis-utilities.js"></script>
<script src="../src/utils/substance-utilities.js"></script>
<script src="../src/utils/performance-utilities.js"></script>

<!-- 3. Core modules -->
<script src="../src/core/frequency-mapper.js"></script>
<script src="../src/core/audio-engine.js"></script>
<script src="../src/core/visualizer.js"></script>
<script src="../src/importers/csv-importer.js"></script>
<script src="../src/importers/jcamp-importer.js"></script>
<script src="../src/encoders/mp3-encoder.js"></script>
<script src="../src/core/midi-output.js"></script>

<!-- 4. DOM and event handling -->
<script src="../src/config/dom-elements.js"></script>
<script src="../src/handlers/event-handlers.js"></script>
<script src="../src/handlers/handlers-import-export.js"></script>
<script src="../src/handlers/handlers-midi.js"></script>

<!-- 5. Main application -->
<script src="../src/core/app.js"></script>

<!-- 6. PWA registration -->
<script src="../src/pwa/sw-register.js"></script>
```

## Data Flow

1. **Configuration** → Loaded first, frozen objects prevent modification
2. **User Input** → Event handlers capture interactions
3. **State Management** → app.js manages application state
4. **Data Processing** → frequency-mapper converts IR to audio frequencies
5. **Audio Synthesis** → audio-engine creates sounds via Web Audio API
6. **Visualization** → visualizer renders spectra on canvas
7. **Storage** → storage-utilities persists favorites

## Build System

### Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run linting
npm run lint

# Run tests
npm test

# Run tests in watch mode
npm test:watch
```

### Production

The application requires **no build step** for production! Simply:

1. Copy `public/`, `src/`, and `data/` directories to your server
2. Serve `public/index.html` as the entry point
3. Service worker handles offline caching automatically

### CI/CD

GitHub Actions workflows handle:

- **CI** (`ci.yml`): Linting, testing, security audits, CodeQL analysis
- **Deploy** (`deploy.yml`): Automatic deployment to GitHub Pages

## Testing

### Unit Tests

Located in `tests/unit/`, test individual modules in isolation:

```bash
npm test tests/unit/storage-utilities.test.js
```

### Integration Tests

Located in `tests/integration/` (coming soon), test module interactions

### Test Setup

`tests/setup.js` provides mocks for:
- Web Audio API
- Canvas API
- localStorage
- Console methods

## Development Guidelines

### Adding New Modules

1. Place in appropriate directory based on purpose
2. Follow existing naming conventions (kebab-case)
3. Add JSDoc comments for all functions
4. Update `public/index.html` script loading order
5. Update this STRUCTURE.md document

### Module Design Principles

- **Single Responsibility**: Each module has one clear purpose
- **Explicit Dependencies**: Load order determines dependencies
- **No Circular Dependencies**: Enforce one-way dependency flow
- **Frozen Config**: Configuration objects are immutable
- **Global Scope**: Modules expose APIs via global variables (or ES6 modules in future)

## Migration Notes

### From v1.x to v2.0

Major changes:

1. **File Structure**: Flat structure → organized directories
2. **CI/CD**: No automation → GitHub Actions workflows
3. **Testing**: Manual only → Jest framework with unit tests
4. **Linting**: No linter → ESLint with strict rules
5. **Documentation**: Good → Excellent (added STRUCTURE.md, MIGRATION.md)

See `MIGRATION.md` for detailed upgrade guide.

## Future Improvements

Planned enhancements:

1. **ES6 Modules**: Convert from global scope to `import`/`export`
2. **CSS Modules**: Split large CSS file into components
3. **Lazy Loading**: Load ftir-library.json on demand
4. **TypeScript**: Add type definitions
5. **WebAssembly**: DSP operations for better performance
6. **State Management**: Implement Redux-like pattern
7. **Integration Tests**: Add browser automation tests

## Performance Considerations

- **Service Worker**: Caches all assets for instant offline loading
- **Large Data File**: 9.5MB ftir-library.json loads on startup (future: lazy load)
- **Canvas Optimization**: Uses RAF for smooth animations
- **Debounced Inputs**: Search and filter operations are debounced
- **Audio Context**: Single AudioContext for all synthesis

## Security

- **Content Security Policy**: Strict CSP in HTML
- **No XSS**: All user input is sanitized
- **CodeQL Scanning**: Automated security analysis
- **No Dependencies**: Zero runtime dependencies = minimal attack surface
- **npm audit**: Automated vulnerability checking in CI

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

Requires:
- ES6+ JavaScript support
- Web Audio API
- Canvas API
- Service Worker API (optional, for PWA features)
- Web MIDI API (optional, for MIDI output)

## License

MIT License - See LICENSE file for details

---

**Last Updated**: 2025-12-03
**Version**: 2.0.0
**Maintainer**: zophiezlan
