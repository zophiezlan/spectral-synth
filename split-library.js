#!/usr/bin/env node
/**
 * FTIR Library Splitter
 *
 * Splits the monolithic ftir-library.json into category-based chunks
 * for lazy loading and reduced initial bundle size.
 *
 * Output Structure:
 * dist/
 *   library/
 *     index.json        - Metadata and category list
 *     opioids.json      - Opioid substances
 *     stimulants.json   - Stimulant substances
 *     benzodiazepines.json
 *     psychedelics.json
 *     cannabinoids.json
 *     steroids.json
 *     other.json
 */

/* eslint-env node */
/* global Buffer, process */

const fs = require('fs');
const path = require('path');

// Same categorization logic as substance-utilities.js
function categorizeSubstance(item) {
    const name = item.name.toLowerCase();
    // Note: Formula could be used for future categorization logic based on
    // molecular structure (e.g., identifying benzene rings, functional groups)

    // Opioids
    const opioidKeywords = ['morphine', 'heroin', 'codeine', 'fentanyl', 'oxycodone',
        'hydrocodone', 'buprenorphine', 'methadone', 'tramadol',
        'diacetylmorphine', 'acetylmorphine', 'alfentanil', 'sufentanil',
        'remifentanil', 'carfentanil', 'acetylfentanyl', 'furanylfentanyl',
        'acrylfentanyl', 'butyrfentanyl', 'valerylfentanyl'];
    if (opioidKeywords.some(keyword => name.includes(keyword))) {
        return 'opioids';
    }

    // Stimulants
    const stimulantKeywords = ['cocaine', 'amphetamine', 'methamphetamine', 'mdma',
        'mephedrone', 'caffeine', 'methylphenidate', 'cathinone',
        'methcathinone', 'ecstasy', 'speed', 'crystal',
        'ethylone', 'methylone', 'butylone', 'pentedrone',
        'ephedrine', 'pseudoephedrine', 'benzoylecgonine'];
    if (stimulantKeywords.some(keyword => name.includes(keyword))) {
        return 'stimulants';
    }

    // Benzodiazepines
    const benzoKeywords = ['diazepam', 'alprazolam', 'clonazepam', 'lorazepam',
        'temazepam', 'oxazepam', 'nitrazepam', 'flunitrazepam',
        'bromazepam', 'lormetazepam', 'etizolam', 'flubromazolam'];
    if (benzoKeywords.some(keyword => name.includes(keyword))) {
        return 'benzodiazepines';
    }

    // Psychedelics
    const psychedelicKeywords = ['lsd', 'lysergic', 'psilocybin', 'dmt', 'mescaline',
        '2c-b', '2c-i', '2c-e', 'nbome', 'dom', 'doi'];
    if (psychedelicKeywords.some(keyword => name.includes(keyword))) {
        return 'psychedelics';
    }

    // Cannabinoids
    const cannabinoidKeywords = ['thc', 'cbd', 'cannabinol', 'cannabidiol', 'cannabis',
        'jwh', 'am-2201', 'cp-47', 'hu-210'];
    if (cannabinoidKeywords.some(keyword => name.includes(keyword))) {
        return 'cannabinoids';
    }

    // Steroids
    const steroidKeywords = ['testosterone', 'stanozolol', 'nandrolone', 'methandienone',
        'boldenone', 'trenbolone', 'oxandrolone', 'methenolone',
        'drostanolone', 'mesterolone'];
    if (steroidKeywords.some(keyword => name.includes(keyword))) {
        return 'steroids';
    }

    return 'other';
}

/**
 * Split library into category-based files
 */
function splitLibrary() {
    console.log('='.repeat(60));
    console.log('FTIR Library Splitter');
    console.log('='.repeat(60));

    // Read the full library
    console.log('\nReading ftir-library.json...');
    const library = JSON.parse(fs.readFileSync('ftir-library.json', 'utf8'));
    console.log(`  Total substances: ${library.length}`);

    // Create output directory
    const outputDir = path.join('dist', 'library');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`\nCreated directory: ${outputDir}`);
    }

    // Categorize substances
    console.log('\nCategorizing substances...');
    const categories = {
        opioids: [],
        stimulants: [],
        benzodiazepines: [],
        psychedelics: [],
        cannabinoids: [],
        steroids: [],
        other: []
    };

    library.forEach(substance => {
        const category = categorizeSubstance(substance);
        categories[category].push(substance);
    });

    // Write category files
    console.log('\nWriting category files...');
    const categoryStats = {};

    for (const [category, substances] of Object.entries(categories)) {
        const filename = `${category}.json`;
        const filepath = path.join(outputDir, filename);
        const content = JSON.stringify(substances, null, 2);

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
        version: '1.0.0',
        totalSubstances: library.length,
        categories: Object.entries(categoryStats).map(([name, stats]) => ({
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
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
    console.log(`  ✓ index.json (${(Buffer.byteLength(JSON.stringify(index), 'utf8') / 1024).toFixed(2)} KB)`);

    // Create search index
    console.log('\nCreating search index...');
    const searchIndex = {};

    library.forEach(substance => {
        const category = categorizeSubstance(substance);
        const nameKey = substance.name.toLowerCase();

        // Store minimal info for each substance: category and id
        // Use array to handle potential duplicates
        if (!searchIndex[nameKey]) {
            searchIndex[nameKey] = [];
        }
        searchIndex[nameKey].push({
            category: category,
            id: substance.id,
            name: substance.name,
            formula: substance.formula || ''
        });

        // Add formula as searchable if present
        if (substance.formula) {
            const formulaKey = substance.formula.toLowerCase();
            if (!searchIndex[formulaKey]) {
                searchIndex[formulaKey] = [];
            }
            searchIndex[formulaKey].push({
                category: category,
                id: substance.id,
                name: substance.name,
                formula: substance.formula
            });
        }
    });

    const searchIndexPath = path.join(outputDir, 'search-index.json');
    const searchIndexContent = JSON.stringify(searchIndex, null, 2);
    fs.writeFileSync(searchIndexPath, searchIndexContent, 'utf8');
    console.log(`  ✓ search-index.json (${(Buffer.byteLength(searchIndexContent, 'utf8') / 1024).toFixed(2)} KB)`);

    // Calculate savings
    console.log('\n' + '='.repeat(60));
    console.log('Results:');
    console.log('='.repeat(60));

    const originalSize = fs.statSync('ftir-library.json').size;
    const totalSplitSize = Object.values(categoryStats).reduce((sum, s) => sum + s.sizeBytes, 0);

    console.log(`Original library size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Split library total: ${(totalSplitSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Overhead: ${(((totalSplitSize - originalSize) / originalSize) * 100).toFixed(1)}%`);
    console.log(`\nTypical initial load (2-3 categories): ${((categoryStats.other.sizeBytes + categoryStats.stimulants.sizeBytes) / 1024).toFixed(2)} KB`);
    console.log(`vs. full library: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`Savings: ${((1 - (categoryStats.other.sizeBytes + categoryStats.stimulants.sizeBytes) / originalSize) * 100).toFixed(1)}%`);

    console.log('\n✅ Library split complete!');
}

// Run the splitter
try {
    splitLibrary();
} catch (error) {
    console.error('❌ Error splitting library:', error);
    process.exit(1);
}
