#!/usr/bin/env node
/**
 * Production Build Script
 *
 * Simple concatenation/minification for CSS and JS files.
 * This creates production-ready bundles for deployment.
 */

/* eslint-env node */
/* global Buffer, process */

const fs = require('fs');
const path = require('path');

// Files to concatenate
const CSS_FILES = [
    'base.css',
    'components.css',
    'modals.css',
    'responsive.css'
];

const JS_FILES = [
    'config.js',
    'constants.js',
    'debug-logger.js',
    'app-state.js',
    'ui-utilities.js',
    'modal-manager.js',
    'keyboard-shortcuts.js',
    'visualization-utilities.js',
    'storage-utilities.js',
    'tutorial-manager.js',
    'analysis-utilities.js',
    'substance-utilities.js',
    'performance-utilities.js',
    'frequency-mapper.js',
    'audio-engine.js',
    'visualizer.js',
    'csv-importer.js',
    'jcamp-importer.js',
    'mp3-encoder.js',
    'midi-output.js',
    'dom-elements.js',
    'event-handlers.js',
    'handlers-import-export.js',
    'handlers-midi.js',
    'filter-manager.js',
    'onboarding.js',
    'playback-controller.js',
    'theme-manager.js',
    'app.js'
];

const OUTPUT_DIR = 'dist';

/**
 * Create output directory if it doesn't exist
 */
function ensureOutputDir() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`Created directory: ${OUTPUT_DIR}`);
    }
}

/**
 * Concatenate files
 * @param {string[]} files - Array of file paths
 * @param {string} outputFile - Output file path
 */
function concatenateFiles(files, outputFile) {
    console.log(`\nConcatenating ${files.length} files into ${outputFile}...`);

    let content = '';
    let totalSize = 0;

    for (const file of files) {
        if (fs.existsSync(file)) {
            const fileContent = fs.readFileSync(file, 'utf8');
            content += `\n/* ========================================\n   ${file}\n   ======================================== */\n\n`;
            content += fileContent;
            content += '\n\n';

            const fileSize = Buffer.byteLength(fileContent, 'utf8');
            totalSize += fileSize;
            console.log(`  ✓ ${file} (${(fileSize / 1024).toFixed(2)} KB)`);
        } else {
            console.warn(`  ⚠ Warning: ${file} not found, skipping...`);
        }
    }

    fs.writeFileSync(outputFile, content, 'utf8');
    const outputSize = Buffer.byteLength(content, 'utf8');
    console.log(`  → Output: ${outputFile} (${(outputSize / 1024).toFixed(2)} KB)`);

    return outputSize;
}

/**
 * Simple CSS minification
 * @param {string} css - CSS content
 * @returns {string} Minified CSS
 */
function minifyCSS(css) {
    return css
        // Remove comments
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        // Remove whitespace around special characters
        .replace(/\s*([{}:;,>+~])\s*/g, '$1')
        .trim();
}

/**
 * Simple JS minification (very basic - just removes comments and extra whitespace)
 * For production, consider using terser or uglify-js
 * @param {string} js - JS content
 * @returns {string} Minified JS
 */
function minifyJS(js) {
    return js
        // Remove single-line comments (but preserve URLs)
        .replace(/(?:^|\s)\/\/(?![^\n]*:\/\/).*$/gm, '')
        // Remove multi-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Remove extra whitespace (but preserve strings)
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Copy static files to dist
 */
function copyStaticFiles() {
    console.log('\nCopying static files...');

    const staticFiles = [
        'index.html',
        'manifest.json',
        'service-worker.js',
        'sw-register.js',
        'ftir-library.json'
    ];

    for (const file of staticFiles) {
        if (fs.existsSync(file)) {
            fs.copyFileSync(file, path.join(OUTPUT_DIR, file));
            console.log(`  ✓ ${file}`);
        }
    }
}

/**
 * Update HTML to use bundled files
 */
function updateHTML() {
    console.log('\nUpdating index.html to use bundled files...');

    const htmlPath = path.join(OUTPUT_DIR, 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Replace individual CSS files with bundle
    html = html.replace(
        /<link rel="stylesheet" href="base\.css">\s*<link rel="stylesheet" href="components\.css">\s*<link rel="stylesheet" href="modals\.css">\s*<link rel="stylesheet" href="responsive\.css">/,
        '<link rel="stylesheet" href="bundle.min.css">'
    );

    // Replace individual JS files with bundle
    // Generate regex pattern from JS_FILES array
    const jsFileNames = JS_FILES.map(f => path.basename(f, '.js')).join('|');
    const scriptRegex = new RegExp(`<script src="(${jsFileNames})\\.js"></script>\\s*`, 'g');

    html = html.replace(
        scriptRegex,
        ''
    );

    // Add bundled script before sw-register.js
    html = html.replace(
        /<script src="sw-register\.js"><\/script>/,
        '<script src="bundle.min.js"></script>\n    <script src="sw-register.js"></script>'
    );

    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log('  ✓ Updated HTML');
}

/**
 * Main build function
 */
function build() {
    console.log('='.repeat(60));
    console.log('Starting Production Build');
    console.log('='.repeat(60));

    // Ensure output directory exists
    ensureOutputDir();

    // Concatenate CSS
    const cssOutput = path.join(OUTPUT_DIR, 'bundle.css');
    const cssSize = concatenateFiles(CSS_FILES, cssOutput);

    // Minify CSS
    console.log('\nMinifying CSS...');
    const css = fs.readFileSync(cssOutput, 'utf8');
    const minifiedCSS = minifyCSS(css);
    const cssMinPath = path.join(OUTPUT_DIR, 'bundle.min.css');
    fs.writeFileSync(cssMinPath, minifiedCSS, 'utf8');
    const minCSSSize = Buffer.byteLength(minifiedCSS, 'utf8');
    console.log(`  → Output: bundle.min.css (${(minCSSSize / 1024).toFixed(2)} KB)`);
    console.log(`  → Size reduction: ${((1 - minCSSSize / cssSize) * 100).toFixed(1)}%`);

    // Concatenate JS
    const jsOutput = path.join(OUTPUT_DIR, 'bundle.js');
    const jsSize = concatenateFiles(JS_FILES, jsOutput);

    // Minify JS (basic minification)
    console.log('\nMinifying JS...');
    const js = fs.readFileSync(jsOutput, 'utf8');
    const minifiedJS = minifyJS(js);
    const jsMinPath = path.join(OUTPUT_DIR, 'bundle.min.js');
    fs.writeFileSync(jsMinPath, minifiedJS, 'utf8');
    const minJSSize = Buffer.byteLength(minifiedJS, 'utf8');
    console.log(`  → Output: bundle.min.js (${(minJSSize / 1024).toFixed(2)} KB)`);
    console.log(`  → Size reduction: ${((1 - minJSSize / jsSize) * 100).toFixed(1)}%`);

    // Copy static files
    copyStaticFiles();

    // Update HTML
    updateHTML();

    console.log('\n' + '='.repeat(60));
    console.log('Build Complete!');
    console.log('='.repeat(60));
    console.log(`Output directory: ${OUTPUT_DIR}`);
    console.log(`Total bundle size: ${((minCSSSize + minJSSize) / 1024).toFixed(2)} KB`);
}

// Run build
try {
    build();
} catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
}
