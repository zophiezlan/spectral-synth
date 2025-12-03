# Best Practices for Spectral Synthesizer Codebase Maintenance

This document outlines recommended practices for maintaining and improving the Spectral Synthesizer codebase based on lessons learned from the v2.0 refactoring attempt.

## Core Principles

### 1. Simplicity Over Sophistication
**Why:** The application works well with a zero-dependency, flat file structure.
- ✅ Keep deployment simple - should work by just opening index.html
- ✅ Avoid unnecessary build steps unless they provide clear user benefit
- ✅ Prefer vanilla JavaScript over frameworks when possible
- ❌ Don't add tools just because they're "modern"

### 2. Incremental Change
**Why:** The v2.0 refactoring tried to change too much simultaneously and broke the app.
- ✅ Make one significant change per PR
- ✅ Test thoroughly before merging
- ✅ Keep the app working between changes
- ❌ Don't combine structure + modules + testing + CI/CD in one PR

### 3. Production-Ready Testing
**Why:** Unit tests alone didn't catch deployment issues in v2.0.
- ✅ Test in deployment-like environment
- ✅ Validate all file paths work when deployed
- ✅ Check that imports/scripts load correctly
- ✅ Test on actual HTTP server, not just file://
- ❌ Don't rely solely on unit/integration tests

## Development Workflow

### Making Changes

#### Small Changes (Bug fixes, minor features)
1. Create feature branch from main
2. Make focused changes
3. Test locally (open index.html in browser)
4. Create PR with clear description
5. Review and merge

#### Large Changes (Refactoring, new features)
1. **Document the plan** first in an issue or doc
2. **Break into phases** - create checklist of steps
3. **Create feature branch** for all work
4. **Make incremental commits** - one logical change per commit
5. **Test after each commit** - ensure app still works
6. **Deploy to staging** if available
7. **Get feedback** before finalizing
8. **Merge when fully working** - not "almost done"

### Code Organization

#### Current Recommended Structure (Flat with Modules)
```
/
├── index.html              # Main HTML file
├── style.css               # All styles
├── manifest.json           # PWA manifest
├── ftir-library.json       # Data file
├── app.js                  # Main application (can be split later)
├── audio-engine.js         # Core audio functionality
├── visualizer.js           # Visualization logic
├── frequency-mapper.js     # Frequency mapping
├── *-utilities.js          # Utility modules
├── *-handler.js            # Event handlers
├── *-importer.js           # File importers
├── service-worker.js       # PWA service worker
├── sw-register.js          # Service worker registration
└── README.md               # Documentation
```

**Benefits:**
- No build step required
- Clear file purposes
- Easy to find code
- Works immediately when deployed

#### If Adding Directory Structure (Future)
Only add directories when:
1. You have >20 files
2. Clear logical grouping exists
3. Build system is in place and tested
4. Paths are properly configured

```
project/
├── src/
│   ├── core/           # Main application logic
│   ├── utils/          # Utilities
│   ├── handlers/       # Event handlers
│   └── importers/      # File importers
├── public/
│   ├── index.html
│   ├── style.css
│   └── assets/
├── data/
│   └── ftir-library.json
└── build/              # Build output (gitignored)
```

**Requirements before moving to directories:**
- ✅ Build system configured and tested
- ✅ Dev server for local development
- ✅ All paths validated in deployment
- ✅ Documentation updated
- ✅ Team trained on new workflow

## Code Quality

### Linting
**When to add:** When codebase has >3 contributors or >10 files

```bash
# Simple ESLint setup
npm install --save-dev eslint
npx eslint --init
```

**Rules to enforce:**
- Consistent indentation
- No unused variables
- Semicolons (consistent)
- Quotes (consistent)
- No console.log in production

### Testing

#### Manual Testing Checklist
Every change should be manually tested:
- [ ] Open index.html in browser directly
- [ ] Test on HTTP server (`python -m http.server`)
- [ ] Test in Chrome, Firefox, Safari
- [ ] Test on mobile device (responsive)
- [ ] Verify service worker works (offline mode)
- [ ] Check browser console for errors
- [ ] Test core user workflows:
  - [ ] Select substance
  - [ ] Play audio
  - [ ] Adjust controls
  - [ ] Export audio/MIDI
  - [ ] Import CSV/JCAMP

#### Automated Testing (Optional)
Only add when:
- Codebase is stable
- Tests won't slow down development
- Team understands testing frameworks

**Recommended tools:**
- Jest for unit tests
- Playwright for integration tests
- Keep tests simple and focused

### Documentation

#### Required Documentation
Every significant change should update:
1. **README.md** - If user-facing changes
2. **Code comments** - For complex logic
3. **Commit messages** - Clear description of what and why

#### Commit Message Format
```
<type>: <brief description>

<detailed explanation if needed>

Why: <reason for change>
Impact: <what this affects>
```

**Types:** feat, fix, refactor, docs, test, style, perf

**Examples:**
```
fix: Correct frequency mapping for C-H bonds

The previous mapping used incorrect logarithmic scale.
This fixes the audio output for alkane spectra.

Why: Users reported wrong pitches for methane
Impact: All substances with C-H bonds
```

## Deployment

### Before Merging to Main
- [ ] Code works locally
- [ ] No console errors
- [ ] All features tested manually
- [ ] Commit message is clear
- [ ] No debugging code left in (console.log, debugger)
- [ ] File paths are relative and work when deployed
- [ ] Service worker cache updated if files changed

### After Merging to Main
- [ ] Verify deployment succeeded
- [ ] Test live site
- [ ] Monitor for error reports
- [ ] Be ready to rollback if issues found

### Rollback Plan
Always have a way to rollback:
1. Keep previous version tagged: `git tag v1.0.0`
2. Document known working commit SHAs
3. Be able to deploy previous version quickly
4. Consider feature flags for major changes

## Common Pitfalls to Avoid

### ❌ Don't: Make Breaking Changes Without Testing
**Example:** v2.0 refactoring changed file paths but didn't verify they worked deployed.

**Instead:** Test in production-like environment before merging.

### ❌ Don't: Add Dependencies Without Strong Reason
**Example:** Adding React/Vue/Angular for a simple app adds complexity.

**Instead:** Use vanilla JS unless framework provides clear benefit.

### ❌ Don't: Refactor and Add Features Simultaneously
**Example:** v2.0 tried to restructure AND add ES6 modules AND add testing at once.

**Instead:** Refactor first, test it works, THEN add new features.

### ❌ Don't: Trust Unit Tests Alone
**Example:** v2.0 had tests but they didn't catch deployment path issues.

**Instead:** Always do end-to-end testing in deployment environment.

### ❌ Don't: Ignore File Path Issues
**Example:** Paths like `src/core/app.js` work locally but break when deployed differently.

**Instead:** Use relative paths, test on HTTP server, verify service worker paths.

## Recommended Tools

### Essential (Always Use)
- **Git** - Version control
- **Browser DevTools** - Debugging
- **Text Editor/IDE** - VSCode, Sublime, etc.

### Helpful (Use When Needed)
- **http-server** - Local testing: `npx http-server`
- **ESLint** - Code quality (when team >2)
- **Prettier** - Code formatting (when team >2)
- **Jest** - Unit testing (when code is stable)

### Advanced (Only If Justified)
- **Webpack/Rollup/esbuild** - Build system (for large apps)
- **TypeScript** - Type safety (for complex codebases)
- **CI/CD** - Automated deployment (for frequent releases)

## When to Refactor

### Good Reasons to Refactor
- ✅ Code is hard to understand
- ✅ Making changes takes too long
- ✅ Bugs keep appearing in same area
- ✅ File is >500 lines and doing too much
- ✅ Team agrees change is needed

### Bad Reasons to Refactor
- ❌ "It's not modern enough"
- ❌ "Other projects do it this way"
- ❌ "I want to learn new technology"
- ❌ "It looks messy" (but works fine)
- ❌ "We should use best practices" (without understanding why)

### How to Refactor Safely
1. **Write tests first** - Capture current behavior
2. **Make small changes** - One file or function at a time
3. **Test after each change** - Ensure still works
4. **Keep old version** - Don't delete until new version works
5. **Document changes** - Explain what and why
6. **Get review** - Have someone else test

## Summary

### Key Takeaways
1. **Keep it simple** - Complexity should serve users, not developers
2. **Change incrementally** - One thing at a time
3. **Test realistically** - In deployment-like environment
4. **Document clearly** - Future you will thank you
5. **Have rollback plan** - Be able to undo changes quickly

### When in Doubt
- Is this change necessary? (Does it help users?)
- Can I make a smaller version of this change?
- Have I tested this in a deployed environment?
- Can I easily undo this if something breaks?
- Have I documented why I'm making this change?

### Remember
**The best code is code that works reliably for users.**

Modern tools and structure are means to that end, not ends in themselves. The flat, zero-dependency structure worked fine. Only add complexity when it clearly improves the user experience or developer productivity, and only after thorough testing.

