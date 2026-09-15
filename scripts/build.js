#!/usr/bin/env node
/**
 * Production build
 *
 * esbuild bundles src/app.js (ES modules) and src/styles/main.css into
 * content-hashed, minified files with source maps, then this script
 * pre-compresses them with Brotli, copies the static shell (index.html,
 * manifest, service worker, library JSON) into dist/ and rewrites
 * index.html to point at the hashed bundles.
 *
 * `npm run build` runs this followed by split-library.js.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const STATIC_FILES = [
    'index.html',
    'manifest.json',
    'service-worker.js',
    'vercel.json',
    'data/ftir-library.json',
];

const kb = bytes => `${(bytes / 1024).toFixed(1)} KB`;

function brotli(file) {
    const content = fs.readFileSync(file);
    const compressed = zlib.brotliCompressSync(content, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 8 },
    });
    fs.writeFileSync(`${file}.br`, compressed);
    return compressed.length;
}

async function main() {
    console.log('='.repeat(60));
    console.log('Production build');
    console.log('='.repeat(60));

    // Clear previous bundles but keep dist/library (written by split-library.js)
    fs.mkdirSync(DIST, { recursive: true });
    for (const name of fs.readdirSync(DIST)) {
        if (name.startsWith('bundle.')) fs.rmSync(path.join(DIST, name));
    }

    const result = await build({
        absWorkingDir: ROOT,
        entryPoints: {
            app: 'src/app.js',
            styles: 'src/styles/main.css',
        },
        bundle: true,
        minify: true,
        sourcemap: true,
        format: 'esm',
        target: ['es2020'],
        outdir: DIST,
        entryNames: 'bundle.[hash].min',
        metafile: true,
        logLevel: 'warning',
    });

    // Find what esbuild actually emitted (names carry the content hash)
    const outputs = Object.entries(result.metafile.outputs)
        .filter(([, meta]) => meta.entryPoint)
        .map(([file, meta]) => ({
            file: path.relative(DIST, path.join(ROOT, file)),
            entry: meta.entryPoint,
            bytes: meta.bytes,
        }));
    const js = outputs.find(o => o.entry.endsWith('.js'));
    const css = outputs.find(o => o.entry.endsWith('.css'));

    console.log('\nBundles:');
    for (const out of outputs) {
        const br = brotli(path.join(DIST, out.file));
        console.log(`  ${out.file}  ${kb(out.bytes)}  (brotli ${kb(br)})`);
    }

    console.log('\nStatic files:');
    for (const rel of STATIC_FILES) {
        const src = path.join(ROOT, rel);
        if (!fs.existsSync(src)) {
            console.log(`  – ${rel} (missing, skipped)`);
            continue;
        }
        const dest = path.join(DIST, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        console.log(`  ✓ ${rel}`);
    }

    // Point index.html at the hashed bundles
    const htmlPath = path.join(DIST, 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const before = html;
    html = html.replace('<link rel="stylesheet" href="src/styles/main.css">',
        `<link rel="stylesheet" href="${css.file}">`);
    html = html.replace('<script type="module" src="src/app.js"></script>',
        `<script type="module" src="${js.file}"></script>`);
    if (html === before) {
        throw new Error('index.html: could not find the src/ entry tags to rewrite');
    }
    fs.writeFileSync(htmlPath, html);
    console.log('  ✓ index.html rewritten to use bundles');

    console.log('\n' + '='.repeat(60));
    console.log(`Build complete → ${path.relative(ROOT, DIST)}/`);
    console.log('='.repeat(60));
}

main().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
});
