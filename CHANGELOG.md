# Changelog

All notable changes to the Spectral Synthesizer project are documented in this file.

## [Unreleased] - New Features & Enhancements

### Added

#### Import & Export Features
- **CSV Import Module** (`csv-importer.js`): Import custom FTIR spectral data from CSV files
  - Auto-detects file format (transmittance or absorbance columns)
  - Validates data and provides helpful error messages
  - Downsamples large datasets for optimal web performance
  - Supports multiple delimiter types (comma, semicolon, tab)
  - Adds imported spectra to library for immediate use
- **CSV Template Download**: Download example CSV file with correct format
- **WAV Audio Export**: Export synthesized audio as downloadable WAV files
  - Renders audio offline using OfflineAudioContext
  - Preserves all current effect settings (reverb, filter)
  - Generates 16-bit PCM WAV files
  - Auto-generates filenames based on substance name and duration

#### Audio Effect Presets
- **Six curated presets** for different sonic characteristics:
  - Clean: No effects, pure synthesis
  - Ambient: Large reverb space (70% reverb, 6000 Hz filter)
  - Warm: Low-pass filter for warmth (20% reverb, 2000 Hz filter)
  - Bright: Full spectrum, light reverb (15% reverb, 8000 Hz filter)
  - Underwater: Heavy filtering and reverb (80% reverb, 800 Hz filter)
  - Cathedral: Massive reverb space (90% reverb, 5000 Hz filter)
- Preset selector automatically updates reverb and filter UI controls

#### UI Improvements
- New "Import & Export" section with intuitive controls
- File upload button for CSV import with visual feedback
- Export WAV button that enables when substance is selected
- Preset dropdown with descriptive labels
- Consistent styling with existing interface

### Changed
- **audio-engine.js**: Added `exportWAV()`, `bufferToWave()`, `applyPreset()`, and `getPresets()` methods
- **config.js**: Added `presets` configuration object with frozen preset definitions
- **index.html**: Added UI controls for import, export, and presets
- **style.css**: Added styling for new UI elements (file upload, secondary buttons, preset selector)
- **app.js**: Added event handlers for CSV import, template download, WAV export, and preset selection
- **README.md**: Updated with new features documentation and marked completed items in Future Ideas

## [Previous] - Project Refinement

### Added

#### Documentation
- **CONTRIBUTING.md**: Comprehensive contribution guidelines including code style, testing checklist, and areas for contribution
- **ARCHITECTURE.md**: Detailed system architecture with module diagrams, data flow, algorithms, and performance considerations
- **LICENSE**: MIT License file
- **.editorconfig**: Editor configuration for consistent coding style across different editors
- **CHANGELOG.md**: This file to track changes over time

#### Configuration
- **config.js**: Centralized configuration file with all constants and magic numbers organized by category:
  - Frequency mapping parameters
  - Peak detection parameters
  - Audio synthesis parameters
  - Visualization parameters
  - UI parameters
  - All config objects frozen (immutable) for safety

#### Code Quality
- Comprehensive JSDoc comments for all functions with parameter types and descriptions
- Detailed inline comments explaining complex algorithms:
  - Logarithmic frequency mapping
  - Equal loudness contour correction
  - Coordinate transformations
  - Waveform selection logic
- Input validation with proper error handling and user-friendly messages
- Type checking for all public method parameters

#### Accessibility
- ARIA roles (banner, main, contentinfo) for semantic structure
- ARIA labels on all interactive elements
- `aria-pressed` states for toggle buttons
- `aria-live` region for dynamic status updates
- `role="img"` and descriptive labels for canvas elements
- Improved keyboard navigation support

### Changed

#### Code Organization
- Extracted all magic numbers to CONFIG constants
- Organized modules with clear separation of concerns
- Improved function naming for clarity
- Better error messages with actionable guidance

#### Performance
- Added 300ms debouncing to search input
- Documented performance bottlenecks and optimization opportunities
- Efficient algorithms with O(n) complexity where possible

#### Documentation
- Enhanced README with project structure section
- Added detailed algorithm explanations
- Documented all configuration options
- Added visual architecture diagrams

#### UI/UX
- Better error feedback with specific messages
- Improved color contrast using CONFIG constants
- Consistent sizing using configuration multipliers

### Removed
- **spectral-data.js**: Unused file (no references found in codebase)

### Fixed
- Hard-coded colors replaced with CONFIG constants
- Hard-coded sizes replaced with CONFIG-based calculations
- Inconsistent error handling patterns standardized

### Security
- ✅ Input validation on all user inputs
- ✅ No XSS vulnerabilities (CodeQL scan passed with 0 alerts)
- ✅ No innerHTML with user data
- ✅ CSP-ready architecture
- ✅ Safe use of Web Audio API

## Project Metrics

### Before Refinement
- Documentation: Minimal (README only)
- Code comments: Sparse
- Magic numbers: ~20+ scattered throughout code
- Error handling: Basic
- Accessibility: Limited
- Test coverage: Manual only
- Security review: None

### After Refinement
- Documentation: Comprehensive (README, CONTRIBUTING, ARCHITECTURE, LICENSE, inline comments)
- Code comments: Extensive with JSDoc and inline explanations
- Magic numbers: 0 (all moved to config.js)
- Error handling: Robust with validation and user-friendly messages
- Accessibility: WCAG-compliant with ARIA labels and semantic HTML
- Test coverage: Manual checklist + validation scripts
- Security review: CodeQL scan passed (0 vulnerabilities)

## Impact

This refactoring transforms the project from "quickly thrown together" to a professional, maintainable, and well-documented codebase ready for:
- Open-source collaboration
- Educational use
- Production deployment
- Future enhancements

## Breaking Changes

None - All changes are backwards compatible. The application works exactly the same from a user perspective, but is now much easier to maintain and extend.

## Contributors

Special thanks to all contributors who helped refine this project.

## License

MIT License - See [LICENSE](LICENSE) file for details.
