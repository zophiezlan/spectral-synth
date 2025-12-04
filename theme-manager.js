/**
 * Theme Manager Module
 *
 * Handles theme toggle functionality (light/dark mode).
 * This module is extracted from app.js for better maintainability.
 */

/* global Toast, localStorage, document */

/**
 * Setup theme toggle button and load saved theme
 */
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');

    if (!themeToggle) {
        return;
    }

    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    // Toggle theme on click
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);

        // Show toast notification
        Toast.info(`Switched to ${newTheme} theme`, 2000);
    });
}

/**
 * Set theme
 * @param {string} theme - 'light' or 'dark'
 */
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    // Update theme color meta tag
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', theme === 'dark' ? '#8b5cf6' : '#7c3aed');
    }
}
