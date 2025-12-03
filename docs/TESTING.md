# Testing Guide

This document provides comprehensive information about testing the Spectral Synthesizer application.

## Table of Contents

- [Overview](#overview)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [Manual Testing](#manual-testing)
- [Performance Testing](#performance-testing)
- [Test Coverage](#test-coverage)
- [Best Practices](#best-practices)

---

## Overview

The project uses a multi-layered testing approach:

1. **Unit Tests** - Test individual functions and modules in isolation
2. **Integration Tests** - Test module interactions and workflows
3. **Manual Tests** - Browser-based testing with checklists
4. **Performance Tests** - Monitor Web Vitals and custom metrics

### Testing Stack

- **Framework**: Jest (with jsdom environment)
- **Mocking**: Jest mocks for Web Audio, Canvas, localStorage
- **Assertions**: Jest matchers
- **Coverage**: Istanbul (via Jest)
- **CI/CD**: GitHub Actions

---

## Unit Testing

### Running Unit Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm test:watch

# Run specific test file
npm test tests/unit/storage-utilities.test.js

# Run with coverage
npm test -- --coverage
```

### Writing Unit Tests

#### File Structure

Place unit tests in `tests/unit/` with the `.test.js` extension:

```
tests/unit/
├── storage-utilities.test.js
├── analysis-utilities.test.js
├── substance-utilities.test.js
├── performance-utilities.test.js
└── data-loader.test.js
```

#### Example Unit Test

```javascript
/**
 * Unit tests for MyUtility
 */
describe('MyUtility', () => {
    let myFunction;

    beforeEach(() => {
        // Mock or setup
        myFunction = function(input) {
            return input * 2;
        };
    });

    test('should double the input', () => {
        expect(myFunction(5)).toBe(10);
    });

    test('should handle edge cases', () => {
        expect(myFunction(0)).toBe(0);
        expect(myFunction(-5)).toBe(-10);
    });
});
```

### Available Mocks

The test setup (`tests/setup.js`) provides mocks for:

#### Web Audio API

```javascript
// AudioContext, OscillatorNode, GainNode, etc.
const audioContext = new AudioContext();
const oscillator = audioContext.createOscillator();
const gain = audioContext.createGain();
```

#### Canvas API

```javascript
// 2D rendering context
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
ctx.fillRect(0, 0, 100, 100);
```

#### localStorage

```javascript
// Storage mock
localStorage.setItem('key', 'value');
expect(localStorage.getItem('key')).toBe('value');
```

### Current Unit Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| storage-utilities.js | ✅ Complete | 100% |
| data-loader.js | ✅ Complete | 100% |
| analysis-utilities.js | ✅ Complete | 100% |
| substance-utilities.js | ✅ Complete | 100% |
| performance-utilities.js | ✅ Complete | 100% |
| ui-utilities.js | ⏳ Pending | - |
| visualization-utilities.js | ⏳ Pending | - |
| tutorial-manager.js | ⏳ Pending | - |

---

## Integration Testing

### Overview

Integration tests verify that modules work together correctly. They test:

- Component interactions
- Data flow between modules
- End-to-end workflows
- Browser compatibility

### Setup (Future)

Integration tests will use:

- **Playwright** or **Puppeteer** - Browser automation
- **Testing Library** - DOM testing utilities
- **Visual Regression** - Screenshot comparison

### Planned Integration Tests

1. **Library Loading Workflow**
   - Load library data
   - Populate substance selector
   - Select substance
   - Verify spectrum display

2. **Audio Playback Workflow**
   - Select substance
   - Click play button
   - Verify audio synthesis
   - Check visualization updates

3. **Import/Export Workflow**
   - Import CSV file
   - Verify data parsing
   - Export audio
   - Verify file creation

4. **MIDI Output Workflow**
   - Select MIDI device
   - Send notes
   - Export MIDI file

### Example Integration Test (Template)

```javascript
/**
 * Integration test for library loading
 */
describe('Library Loading Integration', () => {
    test('should load library and populate selector', async () => {
        // 1. Initialize application
        // 2. Wait for library to load
        // 3. Verify selector is populated
        // 4. Select a substance
        // 5. Verify spectrum is displayed
    });
});
```

### Running Integration Tests (Future)

```bash
# Run all integration tests
npm run test:integration

# Run in specific browser
npm run test:integration -- --project=chromium

# Run with UI
npm run test:integration -- --ui
```

---

## Manual Testing

### Browser Testing

Test in all supported browsers:

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Device Testing

Test on various devices:

- 📱 **Mobile**: iPhone, Android
- 💻 **Desktop**: Windows, macOS, Linux
- 🎮 **Tablet**: iPad, Android tablets

### Manual Test Checklist

Before releasing changes, verify:

#### Core Functionality
- [ ] Library loads successfully
- [ ] Substance selector populated
- [ ] Search and filters work
- [ ] Play/Stop buttons functional
- [ ] Audio synthesis works
- [ ] Visualizations render correctly
- [ ] Peak selection works

#### Import/Export
- [ ] CSV import works
- [ ] JCAMP-DX import works
- [ ] WAV export works
- [ ] MP3 export works
- [ ] MIDI export works

#### Settings & Controls
- [ ] Settings modal opens
- [ ] Effect controls work
- [ ] ADSR envelope controls work
- [ ] Playback mode selection works
- [ ] Preset selection works

#### PWA Features
- [ ] Service worker registers
- [ ] Offline mode works
- [ ] Install prompt appears
- [ ] App installs correctly

#### Accessibility
- [ ] Keyboard navigation works
- [ ] Tab order is logical
- [ ] Focus indicators visible
- [ ] Screen reader announces correctly
- [ ] ARIA labels present

#### Responsive Design
- [ ] Mobile layout works
- [ ] Tablet layout works
- [ ] Desktop layout works
- [ ] Landscape orientation works
- [ ] Touch interactions work

#### Performance
- [ ] Initial load < 3 seconds
- [ ] Interactions feel responsive
- [ ] No memory leaks
- [ ] No console errors

---

## Performance Testing

### Web Vitals Monitoring

The application includes built-in Web Vitals monitoring via `PerformanceMonitor`:

#### Tracked Metrics

1. **LCP (Largest Contentful Paint)**
   - Good: < 2.5s
   - Needs improvement: 2.5-4s
   - Poor: > 4s

2. **FID (First Input Delay)**
   - Good: < 100ms
   - Needs improvement: 100-300ms
   - Poor: > 300ms

3. **CLS (Cumulative Layout Shift)**
   - Good: < 0.1
   - Needs improvement: 0.1-0.25
   - Poor: > 0.25

4. **Custom Metrics**
   - TTFB (Time to First Byte)
   - DOM Content Loaded
   - Page Load Time
   - DOM Interactive

#### Using PerformanceMonitor

```javascript
// Initialize monitoring
PerformanceMonitor.init({
    enabled: true,
    reportToConsole: true,
    reportToAnalytics: false
});

// Mark custom points
PerformanceMonitor.mark('library-load-start');
await loadLibrary();
PerformanceMonitor.mark('library-load-end');

// Measure duration
PerformanceMonitor.measure('library-load', 'library-load-start', 'library-load-end');

// Get metrics
console.log(PerformanceMonitor.getSummary());
```

### Performance Budgets

Target performance budgets:

| Metric | Target | Maximum |
|--------|--------|---------|
| Initial JS | < 200KB | 300KB |
| Initial CSS | < 50KB | 100KB |
| Library data | 9.5MB | N/A (lazy loaded) |
| LCP | < 2.5s | 4s |
| FID | < 100ms | 300ms |
| CLS | < 0.1 | 0.25 |
| TTI (Time to Interactive) | < 3.5s | 5s |

---

## Test Coverage

### Current Coverage

Run coverage report:

```bash
npm test -- --coverage
```

### Coverage Goals

| Category | Current | Goal |
|----------|---------|------|
| Utilities | 80% | 90% |
| Core Modules | 40% | 75% |
| Handlers | 20% | 60% |
| **Overall** | **50%** | **75%** |

### Coverage Reports

Coverage reports are generated in `coverage/` directory:

- `coverage/lcov-report/index.html` - HTML report
- `coverage/lcov.info` - LCOV format (for CI)
- `coverage/coverage-final.json` - JSON format

---

## Best Practices

### Writing Good Tests

1. **Test Behavior, Not Implementation**
   ```javascript
   // ❌ Bad: Testing implementation details
   test('calls internal function', () => {
       expect(myModule._internalFunction).toHaveBeenCalled();
   });

   // ✅ Good: Testing behavior
   test('returns correct result', () => {
       expect(myModule.publicFunction(input)).toBe(expectedOutput);
   });
   ```

2. **Use Descriptive Test Names**
   ```javascript
   // ❌ Bad
   test('works', () => { /* ... */ });

   // ✅ Good
   test('should return empty array when no favorites exist', () => { /* ... */ });
   ```

3. **Arrange, Act, Assert (AAA) Pattern**
   ```javascript
   test('example test', () => {
       // Arrange
       const input = 'test data';
       const expected = 'expected result';

       // Act
       const result = myFunction(input);

       // Assert
       expect(result).toBe(expected);
   });
   ```

4. **Test Edge Cases**
   - Empty inputs
   - Null/undefined values
   - Boundary values
   - Error conditions
   - Invalid data types

5. **Keep Tests Independent**
   - Each test should run independently
   - Use `beforeEach` for setup
   - Use `afterEach` for cleanup
   - Don't rely on test execution order

6. **Mock External Dependencies**
   - Mock API calls
   - Mock browser APIs
   - Mock file system
   - Mock timers when testing async code

### Common Pitfalls

1. **Testing Too Much in One Test**
   - Split into multiple focused tests
   - One assertion per test (when possible)

2. **Not Testing Error Cases**
   - Test both happy path and error path
   - Test exception handling

3. **Flaky Tests**
   - Avoid depending on timing
   - Use fake timers (`jest.useFakeTimers()`)
   - Mock random values

4. **Slow Tests**
   - Mock expensive operations
   - Use fake timers
   - Avoid unnecessary waits

### Debugging Tests

```bash
# Run single test file
npm test -- storage-utilities.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should load favorites"

# Run with verbose output
npm test -- --verbose

# Run in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

---

## CI/CD Integration

Tests run automatically on:

- Every push to any branch
- Every pull request
- Before deployment

### GitHub Actions Workflow

See `.github/workflows/ci.yml` for the complete CI configuration.

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npm test
```

---

## Resources

### Documentation

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Web Vitals](https://web.dev/vitals/)

### Tools

- **Jest**: Test framework
- **jsdom**: DOM implementation for Node.js
- **Istanbul**: Code coverage
- **ESLint**: Code quality

---

**Last Updated**: 2025-12-03
**Version**: 2.0.0
**Maintainer**: zophiezlan
