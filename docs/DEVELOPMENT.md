# Development Guide

Comprehensive guide for developers working on Spectral Synthesizer.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Pre-commit Hooks](#pre-commit-hooks)
- [Best Practices](#best-practices)
- [IDE Setup](#ide-setup)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Git**: 2.30.0 or higher

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/zophiezlan/spectral-synth.git
cd spectral-synth

# Install dependencies
npm install

# Install Playwright browsers (for integration tests)
npx playwright install

# Set up pre-commit hooks
npx husky install

# Start development server
npm run dev
```

The application will open in your browser at `http://localhost:8080`

---

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Edit files in the `src/` directory. The development server has auto-reload disabled (`-c-1` flag), so refresh your browser to see changes.

### 3. Run Tests

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

### 4. Check Code Quality

```bash
# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code
npm run format
```

### 5. Commit Changes

```bash
# Pre-commit hooks will automatically run lint and tests
git add .
git commit -m "feat: your feature description"
```

### 6. Push and Create PR

```bash
git push origin feature/your-feature-name
# Create pull request on GitHub
```

---

## Available Scripts

### Development

| Script | Description |
|--------|-------------|
| `npm start` | Start development server on port 8080 |
| `npm run dev` | Start server and open in browser |
| `npm run build` | Build FTIR library from JCAMP files |

### Testing

| Script | Description |
|--------|-------------|
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:integration` | Run integration tests (Playwright) |
| `npm run test:integration:headed` | Run integration tests with browser visible |
| `npm run test:integration:ui` | Run integration tests with Playwright UI |
| `npm run test:all` | Run all tests (lint + unit + integration) |

### Code Quality

| Script | Description |
|--------|-------------|
| `npm run lint` | Check code with ESLint |
| `npm run lint:fix` | Fix ESLint issues automatically |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check if code is formatted correctly |
| `npm run validate` | Run lint + unit tests |

### Complete Workflow

```bash
# Development cycle
npm run dev              # Start development
# ... make changes ...
npm run format          # Format code
npm run validate        # Check quality
npm run test:coverage   # Check coverage
git commit -m "..."     # Commit (runs pre-commit hooks)
```

---

## Testing

### Unit Tests (Jest)

Unit tests are located in `tests/unit/` and test individual modules in isolation.

**Running unit tests:**

```bash
# Run all unit tests
npm test

# Run specific test file
npm test storage-utilities.test.js

# Run tests matching a pattern
npm test -- --testNamePattern="should load data"

# Run with coverage
npm run test:coverage
```

**Writing unit tests:**

```javascript
describe('MyModule', () => {
    test('should do something', () => {
        const result = myFunction(input);
        expect(result).toBe(expected);
    });
});
```

See [TESTING.md](./TESTING.md) for comprehensive testing guide.

### Integration Tests (Playwright)

Integration tests are located in `tests/integration/` and test the application in real browsers.

**Running integration tests:**

```bash
# Run all integration tests
npm run test:integration

# Run with visible browser
npm run test:integration:headed

# Run with Playwright UI (great for debugging)
npm run test:integration:ui

# Run specific test file
npx playwright test library-loading.spec.js

# Run in specific browser
npx playwright test --project=chromium
```

**Writing integration tests:**

```javascript
import { test, expect } from '@playwright/test';

test('should load application', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Spectral Synthesizer/);
});
```

**Supported browsers:**
- Chromium (Chrome/Edge)
- Firefox
- WebKit (Safari)
- Mobile Chrome
- Mobile Safari

---

## Code Quality

### ESLint

ESLint enforces code quality rules. Configuration in `eslint.config.js`.

**Key rules:**
- No unused variables
- Prefer `const` over `let`
- No `var` keyword
- Consistent quotes (single)
- Always use semicolons
- 4-space indentation

**Running ESLint:**

```bash
# Check all files
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Check specific file
npx eslint src/utils/my-file.js
```

### Prettier

Prettier enforces consistent code formatting. Configuration in `.prettierrc.json`.

**Settings:**
- Single quotes
- Semicolons required
- 4-space tabs
- 100 character line width
- Trailing commas (ES5)

**Running Prettier:**

```bash
# Format all files
npm run format

# Check formatting
npm run format:check

# Format specific file
npx prettier --write src/utils/my-file.js
```

### TypeScript Definitions

TypeScript `.d.ts` files provide type checking without full TS conversion.

**Benefits:**
- IDE autocomplete
- Type checking in supported editors
- Better documentation
- Catch errors early

**Example usage (in VS Code):**

```javascript
// IDE will show types and autocomplete
const data = await DataLoader.loadJSON('/data.json', {
    onProgress: (pct) => console.log(pct),
    useCache: true
});
```

---

## Pre-commit Hooks

Pre-commit hooks automatically run before each commit to ensure code quality.

### What Runs

1. **ESLint** - Checks code quality
2. **Jest** - Runs unit tests

If either fails, the commit is blocked.

### Setup

```bash
# Install hooks
npx husky install

# Hooks are in .husky/pre-commit
```

### Skipping Hooks (Emergency Only)

```bash
# Skip pre-commit hooks (use sparingly!)
git commit --no-verify -m "emergency fix"
```

**Warning**: Only skip hooks for urgent hotfixes. Always fix issues later.

---

## Best Practices

### Code Style

1. **Use meaningful names**
   ```javascript
   // ❌ Bad
   const x = getData();

   // ✅ Good
   const libraryData = loadFTIRLibrary();
   ```

2. **Add JSDoc comments**
   ```javascript
   /**
    * Calculate spectral similarity
    * @param {Array} spectrum1 - First spectrum
    * @param {Array} spectrum2 - Second spectrum
    * @returns {number} Similarity score (0-1)
    */
   function calculateSimilarity(spectrum1, spectrum2) {
       // ...
   }
   ```

3. **Keep functions small**
   - One function, one purpose
   - Maximum 50 lines
   - Extract complex logic

4. **Use const by default**
   ```javascript
   // ✅ Use const
   const data = loadData();

   // ⚠️ Only use let when reassigning
   let counter = 0;
   counter++;
   ```

### Testing

1. **Write tests for new features**
   - Unit tests for utilities
   - Integration tests for workflows

2. **Follow AAA pattern**
   ```javascript
   test('should process data', () => {
       // Arrange
       const input = createTestData();

       // Act
       const result = processData(input);

       // Assert
       expect(result).toEqual(expected);
   });
   ```

3. **Test edge cases**
   - Empty inputs
   - Null/undefined
   - Boundary values
   - Error conditions

### Commits

1. **Use conventional commit format**
   ```
   feat: add new feature
   fix: fix bug
   docs: update documentation
   test: add tests
   refactor: refactor code
   style: format code
   chore: update dependencies
   ```

2. **Write clear commit messages**
   ```bash
   # ❌ Bad
   git commit -m "fix stuff"

   # ✅ Good
   git commit -m "fix: handle null values in data loader"
   ```

3. **Keep commits focused**
   - One logical change per commit
   - Related changes together
   - Separate refactoring from features

---

## IDE Setup

### Visual Studio Code

**Recommended extensions:**

```json
{
    "recommendations": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "ms-playwright.playwright",
        "orta.vscode-jest"
    ]
}
```

**Settings:**

```json
{
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true
    },
    "eslint.validate": ["javascript"],
    "jest.autoRun": "off"
}
```

### WebStorm / IntelliJ IDEA

1. **Enable ESLint**: Preferences → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
2. **Enable Prettier**: Preferences → Languages & Frameworks → JavaScript → Prettier
3. **Format on save**: Preferences → Tools → Actions on Save → Reformat code

---

## Troubleshooting

### Common Issues

#### Port 8080 already in use

```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill -9

# Or use different port
npx http-server public -p 3000
```

#### Tests failing

```bash
# Clear Jest cache
npm test -- --clearCache

# Run specific test for debugging
npm test -- --testNamePattern="specific test"
```

#### Playwright browsers not installed

```bash
# Install all browsers
npx playwright install

# Install specific browser
npx playwright install chromium
```

#### Pre-commit hooks not running

```bash
# Reinstall hooks
npx husky install

# Make hook executable (Unix)
chmod +x .husky/pre-commit
```

#### ESLint errors

```bash
# Auto-fix what's possible
npm run lint:fix

# Check specific file
npx eslint src/utils/problematic-file.js --fix
```

### Getting Help

1. **Check documentation**
   - [TESTING.md](./TESTING.md) - Testing guide
   - [STRUCTURE.md](../STRUCTURE.md) - Project structure
   - [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines

2. **Search issues**
   - GitHub Issues: https://github.com/zophiezlan/spectral-synth/issues

3. **Ask for help**
   - Open a new issue with `question` label
   - Include error messages and steps to reproduce

---

## Performance Tips

### Development Server

```bash
# Use -c-1 to disable caching (see changes immediately)
npm start

# Or use -c0 for no cache at all
npx http-server public -p 8080 -c0
```

### Testing

```bash
# Run only changed tests in watch mode
npm run test:watch

# Run tests for specific module
npm test storage-utilities

# Skip coverage for faster runs
npm test -- --no-coverage
```

### Build Times

```bash
# The library builder can take a few minutes
# Only run when adding new spectra
npm run build
```

---

## Additional Resources

### Documentation

- [Architecture Guide](./ARCHITECTURE.md)
- [Testing Guide](./TESTING.md)
- [CSS Modules Plan](./CSS_MODULES_PLAN.md)
- [Migration Guide](../MIGRATION.md)

### External Resources

- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)

---

**Last Updated**: 2025-12-03
**Version**: 2.0.0
**Maintainer**: zophiezlan
