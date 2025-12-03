# Contributing to Spectral Synthesizer

Thank you for your interest in contributing to the Spectral Synthesizer project! This document provides guidelines for contributing.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment for all contributors

## Getting Started

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/spectral-synth.git
   cd spectral-synth
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start development server**:
   ```bash
   npm start
   # Application runs on http://localhost:8080
   ```
5. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
6. **Make your changes** (see structure below)
7. **Run validations**:
   ```bash
   npm run lint:fix  # Fix code style issues
   npm test          # Run tests
   npm run validate  # Run all checks
   ```
8. **Commit with clear messages**
9. **Push to your fork**
10. **Open a Pull Request**

## Development Guidelines

### Code Style

- Use **clear, descriptive variable and function names**
- Add **JSDoc comments** for all functions
- Keep functions **focused and single-purpose**
- Use **const** for constants, **let** for variables (avoid var)
- Follow existing code formatting conventions

### File Organization

The project follows a modular directory structure (v2.0+):

```
spectral-synth/
├── src/
│   ├── config/        # Configuration (config.js, constants.js)
│   ├── core/          # Core modules (app.js, audio-engine.js, etc.)
│   ├── utils/         # Utility modules (ui-utilities.js, etc.)
│   ├── handlers/      # Event handlers
│   ├── importers/     # Data importers (CSV, JCAMP-DX)
│   ├── encoders/      # Audio encoders (MP3)
│   └── pwa/           # PWA files (service-worker.js)
├── public/
│   ├── index.html     # Main HTML file
│   ├── styles/        # CSS files
│   └── manifest.json  # PWA manifest
├── data/
│   └── ftir-library.json  # FTIR spectroscopy data
├── tests/
│   ├── unit/          # Unit tests
│   └── integration/   # Integration tests
├── scripts/
│   └── build-library.js  # Build script
└── docs/              # Documentation
```

See `STRUCTURE.md` for detailed organization guide.

**When adding new files:**
- Core logic → `src/core/`
- Utilities → `src/utils/`
- Tests → `tests/unit/` or `tests/integration/`
- Documentation → `docs/`

### Adding New Features

1. **Discuss first** - Open an issue to discuss major changes
2. **Keep it minimal** - Make focused, incremental changes
3. **Document thoroughly** - Update README and add code comments
4. **Test extensively** - Verify in multiple browsers if possible
5. **Maintain compatibility** - Ensure backward compatibility

### Testing Checklist

Before submitting a PR, verify:

#### Automated Checks (Required)
- [ ] **Linting passes**: `npm run lint` (no errors)
- [ ] **Tests pass**: `npm test` (all green)
- [ ] **Full validation**: `npm run validate` (lint + tests)

#### Manual Testing (Required)
- [ ] Code runs without console errors
- [ ] All features work as expected
- [ ] No regressions in existing functionality
- [ ] Browser compatibility (Chrome, Firefox, Safari)
- [ ] Responsive design still works (mobile + desktop)
- [ ] Keyboard shortcuts still function
- [ ] Performance is acceptable

#### For New Features (If Applicable)
- [ ] Unit tests added for new functionality
- [ ] Documentation updated (README, STRUCTURE.md)
- [ ] JSDoc comments added to new functions
- [ ] Accessibility tested (keyboard navigation, screen readers)

**Quick Test:**
```bash
npm run validate && npm start
# Then manually test in browser
```

### Commit Messages

Use clear, descriptive commit messages:

```
Good: "Add debouncing to search input for better performance"
Bad: "fix stuff"
```

Format:
```
Short summary (50 chars or less)

More detailed explanation if needed. Wrap at 72 characters.
Explain what changed and why.

- Bullet points are fine
- Reference issues: Fixes #123
```

## Areas Open for Contribution

### High Priority

- [ ] **ES6 Modules Migration** - Convert from global scope to import/export
- [ ] **CSS Modules** - Split large style.css into modular components
- [ ] **Lazy Loading** - Load ftir-library.json on demand (9.5MB)
- [ ] **Additional Tests** - More unit tests and integration tests
- [ ] **Performance Optimizations** - WebAssembly for DSP, Web Workers
- [ ] **Improved Sonification** - Better algorithms for musicality
- [ ] **Better Peak Detection** - More sophisticated methods
- [ ] **Additional FTIR Spectra** - More substances from databases

### Completed Features ✅

- [x] CSV/JCAMP-DX file import
- [x] Audio file export (WAV/MP3)
- [x] MIDI output support
- [x] Preset system for effects
- [x] Tutorial/guided tour
- [x] Unit testing framework (Jest)
- [x] CI/CD pipeline (GitHub Actions)
- [x] Linting (ESLint)
- [x] Modular file structure
- [x] Comprehensive documentation

### Future Feature Ideas

- [ ] **3D Visualization** - Spectrogram waterfall display
- [ ] **Real-time Input** - Live spectrometer integration
- [ ] **Spectral Blending** - Mix multiple spectra
- [ ] **State Management** - Redux-like pattern
- [ ] **TypeScript** - Add type definitions
- [ ] **Mobile App** - Native iOS/Android wrapper
- [ ] **Collaborative Features** - Share spectra, presets
- [ ] **Machine Learning** - Spectrum classification

### Documentation

- [ ] Video tutorials
- [ ] Scientific background articles
- [ ] Educational curriculum materials
- [ ] API documentation
- [ ] Usage examples

## Code Review Process

1. Submit PR with clear description
2. Maintainers review within 1-2 weeks
3. Address feedback and make changes
4. Once approved, PR will be merged

## Questions?

- Open an issue for bugs or feature requests
- Use discussions for questions and ideas
- Tag maintainers if you need attention

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Thank You!

Every contribution, no matter how small, helps make this project better. We appreciate your time and effort!
