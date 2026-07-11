#!/usr/bin/env node
/**
 * FTIR Library Splitter
 *
 * Splits the monolithic ftir-library.json into category-based chunks
 * for lazy loading and reduced initial bundle size.
 *
 * Categories come from the `category` field baked into each substance
 * record (see migrate-library.js / build-library.js); substances without
 * one are categorized via substance-utilities.js keyword matching.
 *
 * The index version is a content hash of the library, so clients'
 * IndexedDB caches invalidate automatically whenever the data changes.
 *
 * Output Structure:
 * dist/
 *   library/
 *     index.json         - Metadata, category list, content-hash version
 *     <category>.json    - One file per category present in the data
 *     search-index.json  - Name/formula lookup
 */

/* eslint-env node */
/* global Buffer, process */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { categorizeSubstance } = require('./substance-utilities.js');

/**
 * Split library into category-based files
 */
function splitLibrary() {
    console.log('='.repeat(60));
    console.log('FTIR Library Splitter');
    console.log('='.repeat(60));

    // Read the full library
    console.log('\nReading ftir-library.json...');
    const rawLibrary = fs.readFileSync('ftir-library.json', 'utf8');
    const library = JSON.parse(rawLibrary);
    console.log(`  Total substances: ${library.length}`);

    // Version = content hash, so any data change invalidates client caches
    const version = crypto.createHash('sha256').update(rawLibrary).digest('hex').slice(0, 12);
    console.log(`  Library version (content hash): ${version}`);

    // Create output directory
    const outputDir = path.join('dist', 'library');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`\nCreated directory: ${outputDir}`);
    }

    // Group substances by their baked-in category
    console.log('\nCategorizing substances...');
    const categories = {};
    library.forEach(substance => {
        const category = categorizeSubstance(substance);
        (categories[category] = categories[category] || []).push(substance);
    });

    // Write category files (compact JSON — no pretty-printing)
    console.log('\nWriting category files...');
    const categoryStats = {};

    for (const [category, substances] of Object.entries(categories)) {
        const filename = `${category}.json`;
        const filepath = path.join(outputDir, filename);
        const content = JSON.stringify(substances);

        fs.writeFileSync(filepath, content, 'utf8');

        const sizeKB = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(2);
        console.log(`  ✓ ${filename} - ${substances.length} substances (${sizeKB} KB)`);

        categoryStats[category] = {
            count: substances.length,
            sizeBytes: Buffer.byteLength(content, 'utf8'),
            filename: filename
        };
    }

    // Create index file with metadata
    console.log('\nCreating index file...');
    const index = {
        version: version,
        totalSubstances: library.length,
        categories: Object.entries(categoryStats)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, stats]) => ({
                name: name,
                displayName: name.charAt(0).toUpperCase() + name.slice(1),
                count: stats.count,
                sizeBytes: stats.sizeBytes,
                filename: stats.filename
            })),
        generatedAt: new Date().toISOString(),
        note: 'Load category files on-demand to reduce initial bundle size'
    };

    const indexPath = path.join(outputDir, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index), 'utf8');
    console.log(`  ✓ index.json (${(Buffer.byteLength(JSON.stringify(index), 'utf8') / 1024).toFixed(2)} KB)`);

    // Create search index
    console.log('\nCreating search index...');
    const searchIndex = {};

    library.forEach(substance => {
        const category = categorizeSubstance(substance);
        const entry = {
            category: category,
            id: substance.id,
            name: substance.name,
            formula: substance.formula || ''
        };

        const nameKey = substance.name.toLowerCase();
        (searchIndex[nameKey] = searchIndex[nameKey] || []).push(entry);

        if (substance.formula) {
            const formulaKey = substance.formula.toLowerCase();
            (searchIndex[formulaKey] = searchIndex[formulaKey] || []).push(entry);
        }
    });

    const searchIndexPath = path.join(outputDir, 'search-index.json');
    const searchIndexContent = JSON.stringify(searchIndex);
    fs.writeFileSync(searchIndexPath, searchIndexContent, 'utf8');
    console.log(`  ✓ search-index.json (${(Buffer.byteLength(searchIndexContent, 'utf8') / 1024).toFixed(2)} KB)`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Results:');
    console.log('='.repeat(60));

    const originalSize = fs.statSync('ftir-library.json').size;
    const totalSplitSize = Object.values(categoryStats).reduce((sum, s) => sum + s.sizeBytes, 0);

    console.log(`Library size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Split library total: ${(totalSplitSize / 1024 / 1024).toFixed(2)} MB across ${Object.keys(categoryStats).length} categories`);
    console.log(`Largest chunk: ${Math.max(...Object.values(categoryStats).map(s => s.sizeBytes)) / 1024 | 0} KB`);

    console.log('\n✅ Library split complete!');
}

// Run the splitter
try {
    splitLibrary();
} catch (error) {
    console.error('❌ Error splitting library:', error);
    process.exit(1);
}
