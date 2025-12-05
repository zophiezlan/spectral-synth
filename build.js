#!/usr/bin/env node
/**
 * Production Build Script
 *
 * Advanced concatenation/minification for CSS and JS files with:
 * - Terser for JS minification
 * - Source map generation
 * - Cache busting with content hashes
 * - Brotli compression support
 */

/* eslint-env node */
/* global Buffer, process */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { minify } = require('terser');
const zlib = require('zlib');

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
 * Advanced JS minification using terser with source maps
 * @param {string} js - JS content
 * @param {string} filename - Source filename for source map
 * @returns {Promise<{code: string, map: string}>} Minified JS and source map
 */
async function minifyJSWithTerser(js, filename) {
    const result = await minify(js, {
        sourceMap: {
            filename: filename,
            url: `${filename}.map`
        },
        compress: {
            dead_code: true,
            drop_console: false, // Keep console for debugging
            drop_debugger: true,
            keep_classnames: true,
            keep_fnames: false,
            passes: 2
        },
        mangle: {
            keep_classnames: true,
            keep_fnames: false
        },
        format: {
            comments: false,
            preserve_annotations: false
        }
    });

    return {
        code: result.code,
        map: result.map
    };
}

/**
 * Generate content hash for cache busting
 * @param {string} content - File content
 * @returns {string} Hash string (first 8 characters)
 */
function generateHash(content) {
    // Using SHA-256 for better collision resistance (though MD5 would be fine for cache busting)
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 8);
}

/**
 * Compress content with Brotli
 * @param {string} content - Content to compress
 * @param {string} outputPath - Output file path
 */
function compressBrotli(content, outputPath) {
    // Using quality level 8 for good balance between compression ratio and build speed
    // (Quality 11 is too slow for builds; 6-8 is optimal for production)
    const compressed = zlib.brotliCompressSync(content, {
        params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 8
        }
    });
    fs.writeFileSync(outputPath, compressed);
    return compressed.length;
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
 * Update HTML to use bundled files with cache busting
 * @param {string} cssHash - CSS file hash
 * @param {string} jsHash - JS file hash
 */
function updateHTML(cssHash, jsHash) {
    console.log('\nUpdating index.html to use bundled files...');

    const htmlPath = path.join(OUTPUT_DIR, 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Replace individual CSS files with hashed bundle
    html = html.replace(
        /<link rel="stylesheet" href="base\.css">\s*<link rel="stylesheet" href="components\.css">\s*<link rel="stylesheet" href="modals\.css">\s*<link rel="stylesheet" href="responsive\.css">/,
        `<link rel="stylesheet" href="bundle.${cssHash}.min.css">`
    );

    // Replace individual JS files with bundle
    // Generate regex pattern from JS_FILES array
    const jsFileNames = JS_FILES.map(f => path.basename(f, '.js')).join('|');
    const scriptRegex = new RegExp(`<script src="(${jsFileNames})\\.js"></script>\\s*`, 'g');

    html = html.replace(
        scriptRegex,
        ''
    );

    // Add bundled script with hash before sw-register.js
    html = html.replace(
        /<script src="sw-register\.js"><\/script>/,
        `<script src="bundle.${jsHash}.min.js"></script>\n    <script src="sw-register.js"></script>`
    );

    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log('  ✓ Updated HTML with cache-busted filenames');
}

/**
 * Main build function
 */
async function build() {
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

    // Generate hash for cache busting
    const cssHash = generateHash(minifiedCSS);
    const cssMinPath = path.join(OUTPUT_DIR, `bundle.${cssHash}.min.css`);
    fs.writeFileSync(cssMinPath, minifiedCSS, 'utf8');
    const minCSSSize = Buffer.byteLength(minifiedCSS, 'utf8');
    console.log(`  → Output: bundle.${cssHash}.min.css (${(minCSSSize / 1024).toFixed(2)} KB)`);
    console.log(`  → Size reduction: ${((1 - minCSSSize / cssSize) * 100).toFixed(1)}%`);

    // Compress CSS with Brotli
    console.log('  → Compressing with Brotli...');
    const cssBrotliPath = cssMinPath + '.br';
    const cssBrotliSize = compressBrotli(minifiedCSS, cssBrotliPath);
    console.log(`  → Brotli: ${(cssBrotliSize / 1024).toFixed(2)} KB (${((1 - cssBrotliSize / minCSSSize) * 100).toFixed(1)}% smaller)`);

    // Concatenate JS
    const jsOutput = path.join(OUTPUT_DIR, 'bundle.js');
    const jsSize = concatenateFiles(JS_FILES, jsOutput);

    // Minify JS with terser and generate source maps
    console.log('\nMinifying JS with Terser...');
    const js = fs.readFileSync(jsOutput, 'utf8');
    const { code: minifiedJS, map: sourceMap } = await minifyJSWithTerser(js, 'bundle.min.js');

    // Generate hash for cache busting
    const jsHash = generateHash(minifiedJS);
    const jsMinPath = path.join(OUTPUT_DIR, `bundle.${jsHash}.min.js`);
    const jsMapPath = path.join(OUTPUT_DIR, `bundle.${jsHash}.min.js.map`);

    // Update source map URL in minified JS
    const jsWithSourceMap = minifiedJS + `\n//# sourceMappingURL=bundle.${jsHash}.min.js.map`;
    fs.writeFileSync(jsMinPath, jsWithSourceMap, 'utf8');
    fs.writeFileSync(jsMapPath, sourceMap, 'utf8');

    const minJSSize = Buffer.byteLength(jsWithSourceMap, 'utf8');
    console.log(`  → Output: bundle.${jsHash}.min.js (${(minJSSize / 1024).toFixed(2)} KB)`);
    console.log(`  → Size reduction: ${((1 - minJSSize / jsSize) * 100).toFixed(1)}%`);
    console.log(`  → Source map: bundle.${jsHash}.min.js.map (${(Buffer.byteLength(sourceMap, 'utf8') / 1024).toFixed(2)} KB)`);

    // Compress JS with Brotli
    console.log('  → Compressing with Brotli...');
    const jsBrotliPath = jsMinPath + '.br';
    const jsBrotliSize = compressBrotli(jsWithSourceMap, jsBrotliPath);
    console.log(`  → Brotli: ${(jsBrotliSize / 1024).toFixed(2)} KB (${((1 - jsBrotliSize / minJSSize) * 100).toFixed(1)}% smaller)`);

    // Copy static files
    copyStaticFiles();

    // Update HTML with hashed filenames
    updateHTML(cssHash, jsHash);

    console.log('\n' + '='.repeat(60));
    console.log('Build Complete!');
    console.log('='.repeat(60));
    console.log(`Output directory: ${OUTPUT_DIR}`);
    console.log(`Total bundle size: ${((minCSSSize + minJSSize) / 1024).toFixed(2)} KB`);
    console.log(`Brotli compressed: ${((cssBrotliSize + jsBrotliSize) / 1024).toFixed(2)} KB`);
    console.log('\nCache-busted filenames:');
    console.log(`  CSS: bundle.${cssHash}.min.css`);
    console.log(`  JS:  bundle.${jsHash}.min.js`);
}

// Run build
(async () => {
    try {
        await build();
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
})();
