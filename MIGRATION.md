# Migration Guide: v1.x → v2.0

This guide helps you understand the structural changes made in v2.0 and how to work with the new codebase organization.

## Overview of Changes

Version 2.0 introduces a **major restructuring** focused on:

✅ **Better organization** - Clear directory structure
✅ **CI/CD automation** - GitHub Actions workflows
✅ **Testing framework** - Jest with unit tests
✅ **Code quality** - ESLint with strict rules
✅ **Enhanced documentation** - Comprehensive guides
✅ **No breaking changes** - Application behavior unchanged

## File Location Changes

### Before v2.0 (Flat Structure)

```
spectral-synth/
├── app.js
├── audio-engine.js
├── config.js
├── style.css
├── index.html
├── ftir-library.json
└── (39 more files in root)
```

### After v2.0 (Organized Structure)

```
spectral-synth/
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── styles/
│       └── style.css
├── src/
│   ├── config/
│   ├── core/
│   ├── utils/
│   ├── handlers/
│   ├── importers/
│   ├── encoders/
│   └── pwa/
├── data/
│   └── ftir-library.json
├── docs/
│   └── (all .md files)
├── scripts/
│   └── build-library.js
└── tests/
    ├── setup.js
    └── unit/
```

## Complete File Mapping

| Old Location | New Location | Category |
|-------------|--------------|----------|
| `app.js` | `src/core/app.js` | Core |
| `audio-engine.js` | `src/core/audio-engine.js` | Core |
| `frequency-mapper.js` | `src/core/frequency-mapper.js` | Core |
| `visualizer.js` | `src/core/visualizer.js` | Core |
| `midi-output.js` | `src/core/midi-output.js` | Core |
| `config.js` | `src/config/config.js` | Config |
| `constants.js` | `src/config/constants.js` | Config |
| `dom-elements.js` | `src/config/dom-elements.js` | Config |
| `ui-utilities.js` | `src/utils/ui-utilities.js` | Utils |
| `visualization-utilities.js` | `src/utils/visualization-utilities.js` | Utils |
| `storage-utilities.js` | `src/utils/storage-utilities.js` | Utils |
| `tutorial-manager.js` | `src/utils/tutorial-manager.js` | Utils |
| `analysis-utilities.js` | `src/utils/analysis-utilities.js` | Utils |
| `substance-utilities.js` | `src/utils/substance-utilities.js` | Utils |
| `performance-utilities.js` | `src/utils/performance-utilities.js` | Utils |
| `event-handlers.js` | `src/handlers/event-handlers.js` | Handlers |
| `handlers-import-export.js` | `src/handlers/handlers-import-export.js` | Handlers |
| `handlers-midi.js` | `src/handlers/handlers-midi.js` | Handlers |
| `csv-importer.js` | `src/importers/csv-importer.js` | Importers |
| `jcamp-importer.js` | `src/importers/jcamp-importer.js` | Importers |
| `mp3-encoder.js` | `src/encoders/mp3-encoder.js` | Encoders |
| `service-worker.js` | `src/pwa/service-worker.js` | PWA |
| `sw-register.js` | `src/pwa/sw-register.js` | PWA |
| `index.html` | `public/index.html` | Public |
| `style.css` | `public/styles/style.css` | Public |
| `manifest.json` | `public/manifest.json` | Public |
| `ftir-library.json` | `data/ftir-library.json` | Data |
| `build-library.js` | `scripts/build-library.js` | Scripts |
| `ARCHITECTURE.md` | `docs/ARCHITECTURE.md` | Docs |
| `CHANGELOG.md` | `docs/CHANGELOG.md` | Docs |
| `CONTRIBUTING.md` | `docs/CONTRIBUTING.md` | Docs |
| `IMPROVEMENTS.md` | `docs/IMPROVEMENTS.md` | Docs |
| `REFACTORING.md` | `docs/REFACTORING.md` | Docs |
| `REVIEW_FINDINGS.md` | `docs/REVIEW_FINDINGS.md` | Docs |
| `UX_IMPROVEMENTS.md` | `docs/UX_IMPROVEMENTS.md` | Docs |

## New Files in v2.0

| File | Purpose |
|------|---------|
| `package.json` | Node.js package configuration |
| `eslint.config.js` | ESLint linting rules |
| `jest.config.js` | Jest testing configuration |
| `tests/setup.js` | Test environment setup |
| `tests/unit/*.test.js` | Unit tests |
| `.github/workflows/ci.yml` | CI workflow |
| `.github/workflows/deploy.yml` | Deployment workflow |
| `STRUCTURE.md` | Project structure documentation |
| `MIGRATION.md` | This file |

## Code Changes

### HTML Script References

**Before:**
```html
<script src="config.js"></script>
<script src="app.js"></script>
<script src="audio-engine.js"></script>
```

**After:**
```html
<script src="../src/config/config.js"></script>
<script src="../src/core/app.js"></script>
<script src="../src/core/audio-engine.js"></script>
```

### Data File Reference

**Before:**
```javascript
library: {
    LIBRARY_FILE: 'ftir-library.json'
}
```

**After:**
```javascript
library: {
    LIBRARY_FILE: '../data/ftir-library.json'
}
```

### Service Worker Cache Paths

**Before:**
```javascript
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js'
];
```

**After:**
```javascript
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles/style.css',
    '../src/core/app.js'
];
```

### Build Script Output

**Before:**
```javascript
const outputFile = path.join(__dirname, 'ftir-library.json');
```

**After:**
```javascript
const outputFile = path.join(__dirname, '..', 'data', 'ftir-library.json');
```

## Development Workflow Changes

### Starting the Application

**Before v2.0:**
```bash
# Open index.html in browser
# OR
python -m http.server
```

**After v2.0:**
```bash
# Install dependencies first (one time)
npm install

# Start development server
npm start

# Application runs on http://localhost:8080
```

### Running the Build Script

**Before v2.0:**
```bash
node build-library.js
# Output: ./ftir-library.json
```

**After v2.0:**
```bash
node scripts/build-library.js
# Output: ./data/ftir-library.json
```

### Code Quality Checks

**Before v2.0:**
```bash
# Manual code review only
```

**After v2.0:**
```bash
# Run linting
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Run all validations
npm run validate
```

## Git Workflow Changes

### .gitignore Updates

**New entries:**
```
node_modules/
package-lock.json
coverage/
_site/
```

### Commit History

All file moves used `git mv` to **preserve history**. You can still see the full history of each file:

```bash
# View history of a moved file
git log --follow src/core/app.js

# See what happened in the restructuring
git log --oneline --graph
```

## CI/CD Automation

### Automatic Checks on Every Push

v2.0 introduces GitHub Actions workflows that automatically:

1. **Lint Code** - ESLint checks for code quality issues
2. **Run Tests** - Jest runs all unit tests
3. **Security Scan** - CodeQL analyzes for vulnerabilities
4. **Validate Structure** - Ensures directories exist
5. **npm Audit** - Checks for dependency vulnerabilities

### Automatic Deployment

Pushes to `main` branch automatically deploy to GitHub Pages (if configured).

## Breaking Changes

### None! 🎉

The application behavior is **completely unchanged**. This is purely a structural refactoring.

**All these still work:**
- ✅ All features work identically
- ✅ Same user interface
- ✅ Same keyboard shortcuts
- ✅ Same data format
- ✅ Same browser support
- ✅ Same PWA functionality

## Compatibility

### Browser Compatibility

**Unchanged** - Still requires:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Data Compatibility

**Unchanged** - ftir-library.json format is identical

### Service Worker

**Enhanced** - Now caches all files properly with new structure

## For Contributors

### Before Submitting PRs

**Before v2.0:**
```bash
# Manual testing only
# Open in browser, click around
```

**After v2.0:**
```bash
# Run full validation suite
npm run validate

# This runs:
# - ESLint (catches code issues)
# - Jest tests (ensures functionality)

# All checks must pass before PR merge
```

### Code Style

**New requirement**: All code must pass ESLint

```bash
# Check your code
npm run lint

# Auto-fix common issues
npm run lint:fix
```

### Adding Tests

**Highly encouraged** for new features:

```bash
# Create test file
touch tests/unit/my-feature.test.js

# Run tests
npm test
```

## Updating from v1.x

### For Users (No Changes Needed)

If you're **using** the application:
- Simply pull the latest code
- No configuration changes needed
- Application works identically

### For Developers (Update Workflows)

If you're **developing**:

1. **Pull the latest code**
   ```bash
   git pull origin main
   ```

2. **Install dependencies** (new requirement)
   ```bash
   npm install
   ```

3. **Update your development server**
   ```bash
   # Old: open index.html directly
   # New: use npm start
   npm start
   ```

4. **Run linting before commits**
   ```bash
   npm run lint:fix
   ```

5. **Add tests for new features**
   ```bash
   # See tests/unit/ for examples
   ```

### For Forked Repositories

If you have a **fork**:

1. **Merge upstream changes carefully**
   - File moves may cause conflicts
   - Use `git mv` for your own changes too

2. **Update any custom scripts**
   - Check for hardcoded paths
   - Update to new directory structure

3. **Enable GitHub Actions**
   - Go to Actions tab
   - Enable workflows
   - CI/CD will run automatically

## Rollback (If Needed)

If you need to rollback to v1.x structure:

```bash
# Find the commit before restructuring
git log --oneline

# Checkout that commit
git checkout <commit-hash>

# Or create a v1.x branch
git checkout -b v1.x-legacy <commit-hash>
```

**Note**: All file history is preserved, so you can always access old structure.

## FAQ

### Q: Do I need Node.js to use the application?

**A**: No! Node.js is only needed for **development** (linting, testing). The application itself still runs in the browser with zero dependencies.

### Q: Will my favorites/settings be lost?

**A**: No! localStorage data is unchanged and fully compatible.

### Q: Do I need to rebuild ftir-library.json?

**A**: No! The existing file works fine. Just run `git mv ftir-library.json data/ftir-library.json` to move it.

### Q: Can I still open index.html directly in the browser?

**A**: Yes, but you need to open `public/index.html` now (not the root). For development, we recommend using `npm start` instead.

### Q: Are there any new runtime dependencies?

**A**: No! Runtime dependencies are still **zero**. The `package.json` only includes **dev dependencies** (ESLint, Jest, http-server).

### Q: Will this break my existing deployment?

**A**: No! Update your deployment to serve from the `public/` directory instead of root. The GitHub Actions deploy workflow handles this automatically.

### Q: Why make these changes?

**A**: The v2.0 restructuring provides:
- **Better maintainability** - Easier to find and update code
- **Quality assurance** - Automated testing and linting
- **Team scalability** - Clear structure for multiple contributors
- **Professional standards** - Industry-standard tooling and practices

## Support

If you encounter issues during migration:

1. Check this guide thoroughly
2. Review `STRUCTURE.md` for new organization
3. Look at the Git history: `git log --follow <file>`
4. Open an issue on GitHub with details

## Timeline

- **2025-12-03**: v2.0 restructuring completed
- **Future**: ES6 modules, CSS modules, lazy loading (see roadmap)

---

**Need Help?** Open an issue on GitHub: https://github.com/zophiezlan/spectral-synth/issues

**Last Updated**: 2025-12-03
