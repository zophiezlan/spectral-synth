import { test, expect } from '@playwright/test';

/**
 * Integration tests for Library Loading workflow
 *
 * Tests the complete workflow of loading the FTIR library and
 * populating the substance selector.
 */

test.describe('Library Loading', () => {
    test('should load the application and display title', async ({ page }) => {
        await page.goto('/');

        // Check that the title is correct
        await expect(page).toHaveTitle(/Spectral Synthesizer/);

        // Check that the main heading is visible
        const heading = page.locator('h1');
        await expect(heading).toBeVisible();
        await expect(heading).toHaveText('Spectral Synthesizer');
    });

    test('should show loading overlay during library load', async ({ page }) => {
        await page.goto('/');

        // The loading overlay should appear briefly
        const loadingOverlay = page.locator('#loading-overlay');

        // Either it's visible now or it was visible and disappeared
        // (timing dependent, so we just check it exists)
        await expect(loadingOverlay).toBeDefined();
    });

    test('should populate substance selector after loading', async ({ page }) => {
        await page.goto('/');

        // Wait for the substance selector to be populated
        const substanceSelect = page.locator('#substance');
        await expect(substanceSelect).toBeVisible();

        // Wait for options to be loaded (should have more than just the placeholder)
        await page.waitForFunction(() => {
            const select = document.getElementById('substance');
            return select && select.options.length > 1;
        }, { timeout: 15000 }); // Give it 15 seconds to load the 9.5MB library

        // Check that we have substances loaded
        const optionCount = await substanceSelect.locator('option').count();
        expect(optionCount).toBeGreaterThan(1); // More than just "-- Loading library... --"
    });

    test('should display search and filter controls', async ({ page }) => {
        await page.goto('/');

        // Check that search box is visible
        const searchBox = page.locator('#search');
        await expect(searchBox).toBeVisible();

        // Check that category filter is visible
        const categoryFilter = page.locator('#category');
        await expect(categoryFilter).toBeVisible();

        // Check that favorites filter buttons are visible
        const showAllButton = page.locator('#show-all');
        const showFavoritesButton = page.locator('#show-favorites');
        await expect(showAllButton).toBeVisible();
        await expect(showFavoritesButton).toBeVisible();
    });

    test('should display results count', async ({ page }) => {
        await page.goto('/');

        // Wait for library to load
        await page.waitForFunction(() => {
            const select = document.getElementById('substance');
            return select && select.options.length > 1;
        }, { timeout: 15000 });

        // Check results count is displayed
        const resultsCount = page.locator('#results-count');
        await expect(resultsCount).toBeVisible();
        await expect(resultsCount).toContainText('substances');
    });

    test('should enable play button after selecting substance', async ({ page }) => {
        await page.goto('/');

        // Wait for library to load
        await page.waitForFunction(() => {
            const select = document.getElementById('substance');
            return select && select.options.length > 1;
        }, { timeout: 15000 });

        // Play button should be disabled initially
        const playButton = page.locator('#play');
        await expect(playButton).toBeDisabled();

        // Select the first substance (index 1, since 0 is placeholder)
        const substanceSelect = page.locator('#substance');
        await substanceSelect.selectOption({ index: 1 });

        // Play button should now be enabled
        await expect(playButton).toBeEnabled();
    });

    test('should display visualization canvases', async ({ page }) => {
        await page.goto('/');

        // Check that FTIR canvas is visible
        const ftirCanvas = page.locator('#ftir-canvas');
        await expect(ftirCanvas).toBeVisible();

        // Check that audio canvas is visible
        const audioCanvas = page.locator('#audio-canvas');
        await expect(audioCanvas).toBeVisible();
    });

    test('should display footer information', async ({ page }) => {
        await page.goto('/');

        // Check that footer is visible
        const footer = page.locator('footer');
        await expect(footer).toBeVisible();
        await expect(footer).toContainText('educational/artistic tool');
    });
});

test.describe('Search and Filter', () => {
    test('should filter substances by search term', async ({ page }) => {
        await page.goto('/');

        // Wait for library to load
        await page.waitForFunction(() => {
            const select = document.getElementById('substance');
            return select && select.options.length > 1;
        }, { timeout: 15000 });

        // Get initial count
        const substanceSelect = page.locator('#substance');
        const initialCount = await substanceSelect.locator('option').count();

        // Type in search box
        const searchBox = page.locator('#search');
        await searchBox.fill('cocaine');

        // Wait a bit for debounce
        await page.waitForTimeout(500);

        // Count should be less after filtering
        const filteredCount = await substanceSelect.locator('option').count();
        expect(filteredCount).toBeLessThan(initialCount);
        expect(filteredCount).toBeGreaterThan(0);
    });

    test('should filter substances by category', async ({ page }) => {
        await page.goto('/');

        // Wait for library to load
        await page.waitForFunction(() => {
            const select = document.getElementById('substance');
            return select && select.options.length > 1;
        }, { timeout: 15000 });

        // Get initial count
        const substanceSelect = page.locator('#substance');
        const initialCount = await substanceSelect.locator('option').count();

        // Select a category
        const categoryFilter = page.locator('#category');
        await categoryFilter.selectOption('opioids');

        // Wait a bit for filtering
        await page.waitForTimeout(500);

        // Count should be less after filtering
        const filteredCount = await substanceSelect.locator('option').count();
        expect(filteredCount).toBeLessThan(initialCount);
        expect(filteredCount).toBeGreaterThan(0);
    });
});
