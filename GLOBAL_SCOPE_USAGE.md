# Global Scope Usage Documentation

## Overview

This document catalogs all global scope variables used in the Spectral Synthesizer application and outlines a future migration strategy to ES6 modules.

**Last Updated:** December 2024  
**Status:** Legacy global scope pattern (planned migration to ES6 modules)

---

## Current Architecture

The application uses a **global scope pattern** where modules expose their APIs to the `window` object. This was chosen to:
- Support development without a build step
- Maintain simplicity for educational purposes
- Ensure broad browser compatibility
- Facilitate debugging in browser DevTools

---

## Global Variables Catalog

### Configuration & Constants (Read-Only)

#### Core Configuration
```javascript
CONFIG      // Main configuration object (config.js)
CONSTANTS   // Application constants (constants.js)
```

**Purpose:** Centralized configuration for all application settings
**Dependencies:** None
**Consumers:** All modules

---

### Core Engine Modules (Classes/Constructors)

#### Audio & Synthesis
```javascript
AudioEngine        // Audio synthesis engine (audio-engine.js)
FrequencyMapper    // IR to audio frequency mapping (frequency-mapper.js)
Visualizer         // Canvas visualization (visualizer.js)
```

#### Import/Export
```javascript
CSVImporter        // CSV file parser (csv-importer.js)
JCAMPImporter      // JCAMP-DX file parser (jcamp-importer.js)
MP3Encoder         // MP3 encoding (mp3-encoder.js)
MIDIOutput         // MIDI file generation (midi-output.js)
```

**Purpose:** Core functionality modules
**Pattern:** Singleton or instantiated in app.js
**Consumers:** Main application, event handlers

---

### Feature Modules (Singletons)

#### UI Management
```javascript
ModalManager       // Modal dialog system (modal-manager.js)
ThemeManager       // Light/dark theme switching (theme-manager.js)
KeyboardShortcuts  // Keyboard navigation (keyboard-shortcuts.js)
FilterManager      // Substance filtering (filter-manager.js)
```

#### User Experience
```javascript
TutorialManager    // Interactive tutorials (tutorial-manager.js)
Onboarding         // First-time user experience (onboarding.js)
AppState           // State management with pub/sub (app-state.js)
PlaybackController // Playback logic (playback-controller.js)
```

**Purpose:** Singleton feature modules
**Pattern:** IIFE (Immediately Invoked Function Expression)
**Consumers:** Event handlers, main application

---

### Utility Modules (Namespaced Objects)

#### UI Utilities
```javascript
Toast              // Toast notifications (ui-utilities.js)
ErrorHandler       // Error handling UI (ui-utilities.js)
LoadingOverlay     // Loading indicators (ui-utilities.js)
ScreenReader       // Accessibility helpers (ui-utilities.js)
```

#### Visual Utilities
```javascript
ResponsiveCanvas   // Canvas responsive sizing (visualization-utilities.js)
ColorMapper        // Color schemes (visualization-utilities.js)
MicroInteractions  // UI animations (visualization-utilities.js)
iOSAudioHelper     // iOS audio fixes (performance-utilities.js)
```

#### Analysis
```javascript
calculateSpectralSimilarity  // Spectrum comparison (analysis-utilities.js)
categorizeSubstance          // Substance categorization (substance-utilities.js)
```

**Purpose:** Utility functions for specific domains
**Pattern:** Exported functions or namespaced objects
**Consumers:** Multiple modules

---

### Event Handlers (Functions)

#### Main Handlers
```javascript
setupEventListeners        // Initialize all event listeners (event-handlers.js)
handleSubstanceChange      // Substance selection (event-handlers.js)
handleSearch               // Search functionality (event-handlers.js)
handleCategoryChange       // Category filtering (event-handlers.js)
handlePlay                 // Playback control (event-handlers.js)
handleStop                 // Stop playback (event-handlers.js)
```

#### Import/Export Handlers
```javascript
handleCSVImport            // CSV import (handlers-import-export.js)
handleJCAMPImport          // JCAMP import (handlers-import-export.js)
handleExportWAV            // WAV export (handlers-import-export.js)
handleExportMP3            // MP3 export (handlers-import-export.js)
```

#### MIDI Handlers
```javascript
handleSendMIDI             // Send to MIDI device (handlers-midi.js)
handleExportMIDIFile       // Export MIDI file (handlers-midi.js)
refreshMIDIDevices         // Update device list (handlers-midi.js)
```

#### Favorites & Selection
```javascript
handleFavoritesFilterChange // Filter by favorites (app.js)
handleFavoriteToggle        // Toggle favorite (app.js)
handleSelectAll             // Select all substances (app.js)
handleClearSelection        // Clear selection (app.js)
```

**Purpose:** Event handler functions
**Pattern:** Function declarations
**Consumers:** Event listeners, other handlers

---

### DOM Element References (Cached Elements)

#### Controls
```javascript
durationSlider      // Duration control
durationValue       // Duration display
volumeSlider        // Volume control
volumeValue         // Volume display
reverbSlider        // Reverb control
reverbValue         // Reverb display
filterFreqSlider    // Filter frequency control
filterFreqValue     // Filter frequency display
```

#### ADSR Controls
```javascript
attackSlider        // Attack time
attackValue         // Attack display
decaySlider         // Decay time
decayValue          // Decay display
sustainSlider       // Sustain level
sustainValue        // Sustain display
releaseSlider       // Release time
releaseValue        // Release display
adsrCurveSelect     // ADSR curve type
```

#### UI Elements
```javascript
substanceSelect          // Substance dropdown
searchInput              // Search input
categorySelect           // Category filter
resultsCount             // Results counter
playButton               // Play button
selectAllButton          // Select all button
clearSelectionButton     // Clear selection button
selectionCount           // Selection counter
mappingInfo              // Mapping info display
mappingInfoModal         // Mapping modal
ftirCanvas               // FTIR visualization canvas
audioCanvas              // Audio visualization canvas
```

**Purpose:** Cached DOM element references
**Source:** dom-elements.js
**Pattern:** Direct assignments after DOM load
**Consumers:** Event handlers, visualization

---

### Module Instances (Writable Globals)

```javascript
visualizer         // Main visualizer instance
visualizerA        // Compare mode visualizer A
visualizerB        // Compare mode visualizer B
audioEngine        // Audio engine instance
frequencyMapper    // Frequency mapper instance
midiOutput         // MIDI output instance
```

**Purpose:** Global module instances
**Lifecycle:** Created in app.js initialization
**Consumers:** Event handlers, UI updates

---

## Global Scope Usage Patterns

### Pattern 1: Configuration Objects (Frozen)
```javascript
// config.js
const CONFIG = Object.freeze({
    AUDIO: { /* ... */ },
    UI: { /* ... */ }
});
```
**Benefits:** Immutable, centralized, easily testable
**Issue:** Global namespace pollution

### Pattern 2: IIFE Singletons
```javascript
// modal-manager.js
const ModalManager = (function() {
    'use strict';
    
    // Private state
    const state = { /* ... */ };
    
    // Public API
    return {
        open: function() { /* ... */ },
        close: function() { /* ... */ }
    };
})();
```
**Benefits:** Encapsulation, single instance
**Issue:** Still pollutes global scope

### Pattern 3: Direct Function Exports
```javascript
// event-handlers.js
function handlePlay() {
    // Implementation
}
```
**Benefits:** Simple, direct
**Issue:** No encapsulation, global pollution

### Pattern 4: DOM Element Caching
```javascript
// dom-elements.js
const playButton = document.getElementById('play-btn');
const stopButton = document.getElementById('stop-btn');
```
**Benefits:** Performance optimization
**Issue:** Global references, tight coupling

---

## Impact Analysis

### Pros of Current Approach
✅ **No build step required** - Can develop by opening index.html
✅ **Debuggable** - All objects accessible in DevTools console
✅ **Simple mental model** - Straightforward for learning
✅ **Browser compatibility** - Works everywhere
✅ **Fast development** - No compilation needed

### Cons of Current Approach
⚠️ **Global namespace pollution** - 100+ global variables
⚠️ **Name collision risk** - No module system protection
⚠️ **Implicit dependencies** - Not clear from code
⚠️ **ESLint noise** - Many false-positive warnings
⚠️ **Testing complexity** - Must mock globals
⚠️ **No tree-shaking** - Cannot optimize bundle

---

## Migration Strategy to ES6 Modules

### Phase 1: Preparation (Current)
- ✅ Document all global usage (this document)
- ✅ Configure ESLint for current globals
- ✅ Ensure comprehensive test coverage
- ✅ Add build system with source maps

### Phase 2: Infrastructure (Next)
- [ ] Configure bundler (Rollup or esbuild)
- [ ] Set up development server with hot reload
- [ ] Create dual-mode support (dev + prod)
- [ ] Update CI/CD for new build process

### Phase 3: Gradual Migration
- [ ] Start with utility modules (no dependencies)
- [ ] Convert to ES6 modules with exports
- [ ] Update imports in dependent modules
- [ ] Test thoroughly after each conversion

### Phase 4: Core Module Migration
- [ ] Convert core engine modules
- [ ] Update configuration pattern
- [ ] Migrate DOM element references
- [ ] Convert event handlers

### Phase 5: Cleanup
- [ ] Remove all global assignments
- [ ] Update ESLint configuration
- [ ] Remove globals from window object
- [ ] Final testing and validation

---

## Example: ES6 Module Migration

### Before (Global)
```javascript
// audio-engine.js (current)
const AudioEngine = (function() {
    'use strict';
    
    function AudioEngine() {
        this.context = null;
    }
    
    AudioEngine.prototype.play = function() {
        // ...
    };
    
    return AudioEngine;
})();
```

### After (ES6 Module)
```javascript
// audio-engine.js (future)
export class AudioEngine {
    constructor() {
        this.context = null;
    }
    
    play() {
        // ...
    }
}
```

### Import Usage
```javascript
// app.js (future)
import { AudioEngine } from './audio-engine.js';
import { FrequencyMapper } from './frequency-mapper.js';
import { Visualizer } from './visualizer.js';

const audioEngine = new AudioEngine();
const mapper = new FrequencyMapper();
```

---

## Timeline Estimate

| Phase | Duration | Risk Level |
|-------|----------|------------|
| Phase 1 (Preparation) | ✅ Complete | Low |
| Phase 2 (Infrastructure) | 2-3 weeks | Medium |
| Phase 3 (Gradual Migration) | 4-6 weeks | Medium |
| Phase 4 (Core Migration) | 3-4 weeks | High |
| Phase 5 (Cleanup) | 1-2 weeks | Low |

**Total Estimated Time:** 10-15 weeks for full migration

---

## Testing Strategy During Migration

1. **Maintain test compatibility**
   - Tests should work with both patterns
   - Use adapter pattern if needed

2. **Incremental validation**
   - Test after each module migration
   - Ensure both patterns coexist
   - Validate in CI/CD pipeline

3. **Feature parity**
   - All features must work identically
   - No behavioral changes during migration
   - Performance must remain comparable

---

## Immediate Actions Taken

✅ **Documented all global variables** in this file
✅ **ESLint configuration updated** with all globals
✅ **Build system modernized** with terser and source maps
✅ **Pre-commit hooks added** to prevent regressions

---

## Recommendations

### Short-term (Keep Current Pattern)
1. Continue using global pattern
2. Maintain ESLint global declarations
3. Document new globals as added
4. Focus on feature development

### Long-term (ES6 Migration)
1. Allocate dedicated time for migration
2. Start with low-risk utility modules
3. Use feature flags during transition
4. Consider TypeScript for type safety

---

## Conclusion

The current global scope pattern is **intentional and appropriate** for the application's current state. It provides:
- Zero-dependency architecture
- Easy debugging and learning
- Broad browser compatibility
- Fast development cycles

A migration to ES6 modules should be considered when:
- Team size grows (>3 developers)
- Application complexity increases significantly
- Build-time optimization becomes critical
- Type safety becomes a requirement

**Status:** No immediate action required. Global scope pattern is documented and well-managed.

---

**Maintainer Note:** Update this document when adding new global variables or changing module patterns.
