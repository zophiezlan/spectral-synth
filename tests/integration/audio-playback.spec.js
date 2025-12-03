import { test, expect } from '@playwright/test';

/**
 * Integration tests for Audio Playback workflow
 *
 * Tests the complete workflow of selecting a substance, playing audio,
 * and visualizing the sonification.
 */

test.describe('Audio Playback', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Wait for library to load
        await page.waitForFunction(() => {
            const select = document.getElementById('substance');
            return select && select.options.length > 1;
        }, { timeout: 15000 });
    });

    test('should enable play button after selecting substance', async ({ page }) => {
        const playButton = page.locator('#play');
        const substanceSelect = page.locator('#substance');

        // Initially disabled
        await expect(playButton).toBeDisabled();

        // Select a substance
        await substanceSelect.selectOption({ index: 1 });

        // Play button should be enabled
        await expect(playButton).toBeEnabled();
    });

    test('should update play button text during playback', async ({ page }) => {
        const playButton = page.locator('#play');
        const substanceSelect = page.locator('#substance');

        // Select substance
        await substanceSelect.selectOption({ index: 1 });

        // Get initial button text
        await expect(playButton).toHaveText('▶ Play');

        // Click play
        await playButton.click();

        // Button text should change to "Stop"
        await expect(playButton).toHaveText(/Stop|■/);
    });

    test('should display substance info after selection', async ({ page }) => {
        const substanceSelect = page.locator('#substance');
        const substanceInfo = page.locator('#substance-info');

        // Select a substance
        await substanceSelect.selectOption({ index: 1 });

        // Wait a bit for info to update
        await page.waitForTimeout(200);

        // Info should be visible and contain text
        await expect(substanceInfo).toBeVisible();
        const infoText = await substanceInfo.textContent();
        expect(infoText.length).toBeGreaterThan(0);
    });

    test('should visualize FTIR spectrum after selection', async ({ page }) => {
        const substanceSelect = page.locator('#substance');
        const ftirCanvas = page.locator('#ftir-canvas');

        // Select a substance
        await substanceSelect.selectOption({ index: 1 });

        // Wait for drawing to complete
        await page.waitForTimeout(500);

        // Check canvas has been drawn to
        const canvasDrawn = await page.evaluate(() => {
            const canvas = document.getElementById('ftir-canvas');
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Check if any pixels are non-black
            for (let i = 0; i < imageData.data.length; i += 4) {
                if (imageData.data[i] !== 10 || imageData.data[i + 1] !== 10 || imageData.data[i + 2] !== 10) {
                    return true;
                }
            }
            return false;
        });

        expect(canvasDrawn).toBe(true);
    });

    test('should display duration slider', async ({ page }) => {
        const durationSlider = page.locator('#duration');
        const durationValue = page.locator('#duration-value');

        await expect(durationSlider).toBeVisible();
        await expect(durationValue).toBeVisible();

        // Check default value
        const defaultValue = await durationValue.textContent();
        expect(defaultValue).toContain('s');
    });

    test('should update duration value when slider changes', async ({ page }) => {
        const durationSlider = page.locator('#duration');
        const durationValue = page.locator('#duration-value');

        // Get initial value
        const initialValue = await durationValue.textContent();

        // Change slider
        await durationSlider.fill('5');

        // Wait for update
        await page.waitForTimeout(100);

        // Value should have changed
        const newValue = await durationValue.textContent();
        expect(newValue).not.toBe(initialValue);
        expect(newValue).toContain('5');
    });

    test('should display volume control', async ({ page }) => {
        const volumeSlider = page.locator('#volume');

        await expect(volumeSlider).toBeVisible();
    });

    test('should display playback mode selector', async ({ page }) => {
        const playbackModeSelect = page.locator('#playback-mode');

        await expect(playbackModeSelect).toBeVisible();

        // Check for options
        const optionCount = await playbackModeSelect.locator('option').count();
        expect(optionCount).toBeGreaterThan(1);
    });

    test('should display effect controls', async ({ page }) => {
        const reverbSlider = page.locator('#reverb');
        const filterSlider = page.locator('#filter');

        await expect(reverbSlider).toBeVisible();
        await expect(filterSlider).toBeVisible();
    });

    test('should display ADSR controls', async ({ page }) => {
        const attackSlider = page.locator('#attack');
        const decaySlider = page.locator('#decay');
        const sustainSlider = page.locator('#sustain');
        const releaseSlider = page.locator('#release');

        await expect(attackSlider).toBeVisible();
        await expect(decaySlider).toBeVisible();
        await expect(sustainSlider).toBeVisible();
        await expect(releaseSlider).toBeVisible();
    });

    test('should display preset buttons', async ({ page }) => {
        const presetSection = page.locator('.preset-buttons, .presets');

        await expect(presetSection).toBeVisible();
    });

    test('should stop playback when stop button clicked', async ({ page }) => {
        const playButton = page.locator('#play');
        const substanceSelect = page.locator('#substance');

        // Select and play
        await substanceSelect.selectOption({ index: 1 });
        await playButton.click();

        // Wait for playback to start
        await page.waitForTimeout(200);

        // Click stop
        await playButton.click();

        // Button should return to "Play"
        await expect(playButton).toHaveText('▶ Play');
    });

    test('should handle rapid play/stop toggling', async ({ page }) => {
        const playButton = page.locator('#play');
        const substanceSelect = page.locator('#substance');

        await substanceSelect.selectOption({ index: 1 });

        // Rapidly toggle play/stop
        await playButton.click();
        await page.waitForTimeout(50);
        await playButton.click();
        await page.waitForTimeout(50);
        await playButton.click();
        await page.waitForTimeout(50);
        await playButton.click();

        // Should not crash or error
        await expect(playButton).toBeVisible();
    });

    test('should display export buttons', async ({ page }) => {
        const exportWav = page.locator('#export-wav');
        const exportMp3 = page.locator('#export-mp3');

        await expect(exportWav).toBeVisible();
        await expect(exportMp3).toBeVisible();
    });

    test('should work with different playback modes', async ({ page }) => {
        const playbackModeSelect = page.locator('#playback-mode');
        const substanceSelect = page.locator('#substance');
        const playButton = page.locator('#play');

        await substanceSelect.selectOption({ index: 1 });

        // Try different playback modes
        const modes = ['chord', 'sequential', 'arpeggio-up', 'arpeggio-down'];

        for (const mode of modes) {
            // Check if mode exists
            const hasMode = await page.evaluate((m) => {
                const select = document.getElementById('playback-mode');
                return Array.from(select.options).some(opt => opt.value === m);
            }, mode);

            if (hasMode) {
                await playbackModeSelect.selectOption(mode);
                await page.waitForTimeout(100);

                // Play button should still be enabled
                await expect(playButton).toBeEnabled();
            }
        }
    });

    test('should display both canvas visualizations', async ({ page }) => {
        const ftirCanvas = page.locator('#ftir-canvas');
        const audioCanvas = page.locator('#audio-canvas');

        await expect(ftirCanvas).toBeVisible();
        await expect(audioCanvas).toBeVisible();

        // Check canvas dimensions
        const ftirBox = await ftirCanvas.boundingBox();
        const audioBox = await audioCanvas.boundingBox();

        expect(ftirBox.width).toBeGreaterThan(0);
        expect(ftirBox.height).toBeGreaterThan(0);
        expect(audioBox.width).toBeGreaterThan(0);
        expect(audioBox.height).toBeGreaterThan(0);
    });

    test('should maintain UI state after changing substance', async ({ page }) => {
        const substanceSelect = page.locator('#substance');
        const durationSlider = page.locator('#duration');

        // Select first substance
        await substanceSelect.selectOption({ index: 1 });

        // Change duration
        await durationSlider.fill('3');
        await page.waitForTimeout(100);

        // Select different substance
        await substanceSelect.selectOption({ index: 2 });

        // Duration should still be 3
        const durationValue = await durationSlider.inputValue();
        expect(durationValue).toBe('3');
    });

    test('should handle very short playback duration', async ({ page }) => {
        const substanceSelect = page.locator('#substance');
        const playButton = page.locator('#play');
        const durationSlider = page.locator('#duration');

        await substanceSelect.selectOption({ index: 1 });

        // Set very short duration
        await durationSlider.fill('0.5');
        await page.waitForTimeout(100);

        // Play
        await playButton.click();

        // Should complete without errors
        await page.waitForTimeout(1000);
        await expect(playButton).toHaveText('▶ Play');
    });

    test('should handle very long playback duration', async ({ page }) => {
        const substanceSelect = page.locator('#substance');
        const durationSlider = page.locator('#duration');
        const playButton = page.locator('#play');

        await substanceSelect.selectOption({ index: 1 });

        // Set long duration
        await durationSlider.fill('10');
        await page.waitForTimeout(100);

        // Start playback
        await playButton.click();

        // Wait a bit
        await page.waitForTimeout(500);

        // Stop before completion
        await playButton.click();

        // Should stop cleanly
        await expect(playButton).toHaveText('▶ Play');
    });
});

test.describe('Audio Controls', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        await page.waitForFunction(() => {
            const select = document.getElementById('substance');
            return select && select.options.length > 1;
        }, { timeout: 15000 });

        // Select a substance
        const substanceSelect = page.locator('#substance');
        await substanceSelect.selectOption({ index: 1 });
    });

    test('should apply reverb effect', async ({ page }) => {
        const reverbSlider = page.locator('#reverb');

        // Change reverb
        await reverbSlider.fill('50');
        await page.waitForTimeout(100);

        // Check value was set
        const value = await reverbSlider.inputValue();
        expect(parseInt(value)).toBeGreaterThan(0);
    });

    test('should apply filter effect', async ({ page }) => {
        const filterSlider = page.locator('#filter');

        // Change filter
        await filterSlider.fill('5000');
        await page.waitForTimeout(100);

        // Check value was set
        const value = await filterSlider.inputValue();
        expect(parseInt(value)).toBeGreaterThan(0);
    });

    test('should adjust ADSR envelope', async ({ page }) => {
        const attackSlider = page.locator('#attack');
        const decaySlider = page.locator('#decay');
        const sustainSlider = page.locator('#sustain');
        const releaseSlider = page.locator('#release');

        // Change all ADSR values
        await attackSlider.fill('0.2');
        await decaySlider.fill('0.2');
        await sustainSlider.fill('0.8');
        await releaseSlider.fill('0.5');

        await page.waitForTimeout(100);

        // Verify values
        expect(await attackSlider.inputValue()).toBe('0.2');
        expect(await decaySlider.inputValue()).toBe('0.2');
        expect(await sustainSlider.inputValue()).toBe('0.8');
        expect(await releaseSlider.inputValue()).toBe('0.5');
    });

    test('should adjust volume', async ({ page }) => {
        const volumeSlider = page.locator('#volume');

        // Change volume
        await volumeSlider.fill('75');
        await page.waitForTimeout(100);

        // Check value was set
        const value = await volumeSlider.inputValue();
        expect(parseInt(value)).toBeGreaterThan(0);
    });

    test('should apply preset effects', async ({ page }) => {
        // Try to find and click preset buttons
        const hasPresets = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button[data-preset], .preset-btn, [id*="preset"]');
            return buttons.length > 0;
        });

        if (hasPresets) {
            const presetButton = page.locator('button[data-preset], .preset-btn').first();
            if (await presetButton.count() > 0) {
                await presetButton.click();
                await page.waitForTimeout(100);

                // Should not crash
                await expect(page.locator('body')).toBeVisible();
            }
        }
    });
});

test.describe('Keyboard Shortcuts', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        await page.waitForFunction(() => {
            const select = document.getElementById('substance');
            return select && select.options.length > 1;
        }, { timeout: 15000 });

        const substanceSelect = page.locator('#substance');
        await substanceSelect.selectOption({ index: 1 });
    });

    test('should play with spacebar', async ({ page }) => {
        const playButton = page.locator('#play');

        // Press spacebar
        await page.keyboard.press('Space');

        await page.waitForTimeout(200);

        // Check if play state changed
        const buttonText = await playButton.textContent();
        expect(buttonText).toContain('Stop');
    });

    test('should stop with spacebar', async ({ page }) => {
        const playButton = page.locator('#play');

        // Start playback
        await playButton.click();
        await page.waitForTimeout(200);

        // Press spacebar to stop
        await page.keyboard.press('Space');
        await page.waitForTimeout(200);

        // Should be stopped
        const buttonText = await playButton.textContent();
        expect(buttonText).toContain('Play');
    });
});
