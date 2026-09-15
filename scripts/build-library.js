#!/usr/bin/env node

/**
 * Build Library — ENFSI JCAMP-DX → data/ftir-library.json
 *
 * The ENFSI DWG IR library ships one .JDX per measurement, so a single
 * compound appears many times (salt forms, ATR vs GC-IR, different labs).
 * This builder keeps ONE spectrum per compound:
 *
 *   1. Parse every .JDX (header + XY data), reading the InChIKey from the
 *      `CROSS REFERNCE` header — every file carries one.
 *   2. Group by the InChIKey connectivity block (first 14 characters), so
 *      stereoisomers and salt-keyed duplicates of one compound fall together;
 *      groups that still share a display name and base formula are merged.
 *   3. Pick the most representative spectrum per group:
 *      ATR direct measurement > other ATR > KBr pellet > GC solid-phase IR,
 *      validated entries preferred, then the majority salt form.
 *   4. Derive a clean display name (salt/hydrate suffixes stripped, majority
 *      spelling) and keep every other name seen as an alias for search.
 *   5. Convert absorbance → transmittance, downsample, encode compactly.
 *
 * Usage:
 *   node scripts/build-library.js [path/to/ENFSI_folder]
 *   (defaults to the newest ENFSI_* folder in the repo root)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpectrumCodec } from '../src/data/spectrum-codec.js';
import { categorizeSubstance } from '../src/data/substance-utilities.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_FILE = path.join(ROOT, 'data', 'ftir-library.json');
const TARGET_POINTS = 460;

const INCHIKEY_RE = /\b([A-Z]{14}-[A-Z]{10}-[A-Z])\b/;

// Preferred display names where the majority spelling in the source is
// awkward, keyed by InChIKey connectivity block.
const NAME_OVERRIDES = {
    SPCIYGNTAMCTRO: 'Psilocin',
    YDIIDRWHPFMLGR: 'alpha-PVP',
    SYHGEUNFJIGTRX: 'MDPV',
    QDNXSIYWHYGMCD: '3-MMC',
    DGXWNDGLEOIEGT: '4-FA',
};

// Salt / hydrate / form suffixes that distinguish measurements of the same
// compound. Stripped from the display name, kept as `form` on the record.
const FORM_TOKENS = [
    'hcl', 'hydrochloride', 'hydrochlorid', 'hbr', 'hydrobromide', 'sulphate', 'sulfate',
    'hydrogen sulfate', 'hydrogensulfate', 'phosphate', 'tartrate', 'fumarate', 'citrate',
    'oxalate', 'maleate', 'mesylate', 'nitrate',
    // (acetate/succinate/benzoate deliberately NOT here: those are usually esters
    //  of a different compound — THC-O-acetate, testosterone enanthate…)
    'monohydrate', 'hydrate', 'dihydrate', 'trihydrate', 'na', 'sodium', 'potassium',
    'base', 'neat', 'freebase', 'free base', 'salt', 'recrystallized', 'recrystallised',
];
const FORM_RE = new RegExp(
    '(?:[\\s\\-,]|^)\\(?(?:' + FORM_TOKENS.map(t => t.replace(/ /g, '\\s+')).join('|') +
    ')\\)?(?:\\s*[x×]?\\s*[\\d.,]*\\s*h2o)?(?=[\\s\\-,)]|$)', 'gi'
);

// ---------------------------------------------------------------------------
// JCAMP-DX parsing
// ---------------------------------------------------------------------------

/**
 * Parse a JCAMP-DX file into header fields + absorbance points.
 * @param {string} filePath
 * @returns {{header: Object, spectrum: Array<{wavenumber:number, absorbance:number}>}}
 */
export function parseJCAMP(filePath) {
    const content = fs.readFileSync(filePath, 'latin1');
    const lines = content.split('\n');

    const header = {};
    const xyData = [];
    let inData = false;

    for (const raw of lines) {
        const line = raw.trim();
        if (line.startsWith('##END')) break;
        if (line.startsWith('##')) {
            const m = line.match(/^##([^=]+)=\s*(.*)$/);
            if (m) {
                header[m[1].trim()] = m[2].trim();
                if (m[1].trim() === 'XYDATA') inData = true;
            }
        } else if (inData && line) {
            const parts = line.split(/\s+/).map(Number);
            if (!Number.isNaN(parts[0])) xyData.push(parts);
        }
    }

    const deltaX = parseFloat(header.DELTAX || 1);
    const xFactor = parseFloat(header.XFACTOR || 1);
    const yFactor = parseFloat(header.YFACTOR || 1);

    const spectrum = [];
    for (const row of xyData) {
        const x = row[0] * xFactor;
        for (let j = 1; j < row.length; j++) {
            spectrum.push({ wavenumber: x + (j - 1) * deltaX, absorbance: row[j] * yFactor });
        }
    }
    return { header, spectrum };
}

function toTransmittance(spectrum) {
    const maxAbs = Math.max(...spectrum.map(p => p.absorbance));
    return spectrum.map(p => ({
        wavenumber: p.wavenumber,
        transmittance: maxAbs > 0 ? 100 * (1 - p.absorbance / maxAbs) : 100,
    }));
}

/**
 * Resample onto an evenly spaced grid of exactly `n` points (linear
 * interpolation). Instrument resolution is 4–8 cm⁻¹, so ~460 points over
 * 400–4000 cm⁻¹ (≈8 cm⁻¹) keeps every real feature.
 */
function resample(spectrum, n) {
    const sorted = [...spectrum].sort((a, b) => a.wavenumber - b.wavenumber);
    if (sorted.length <= n) return sorted;
    const x0 = sorted[0].wavenumber;
    const x1 = sorted[sorted.length - 1].wavenumber;
    const out = [];
    let j = 0;
    for (let i = 0; i < n; i++) {
        const x = x0 + (x1 - x0) * i / (n - 1);
        while (j < sorted.length - 2 && sorted[j + 1].wavenumber < x) j++;
        const a = sorted[j], b = sorted[j + 1];
        const t = b.wavenumber === a.wavenumber ? 0 : (x - a.wavenumber) / (b.wavenumber - a.wavenumber);
        out.push({ wavenumber: x, transmittance: a.transmittance + (b.transmittance - a.transmittance) * t });
    }
    return out;
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

/** "#0016n - Methylone / bk-MDMA" → "Methylone / bk-MDMA" */
function titleToName(title) {
    const m = (title || '').match(/^#\d+[nv]?\s*-\s*(.+)$/);
    return (m ? m[1] : title || '').trim();
}

/** Strip salt/hydrate/form qualifiers and trailing parentheticals like "(isomer I)". */
function stripForm(name) {
    let n = name.replace(/\s*\((?:isomer|recryst|mixture|tech|impure|from)[^)]*\)\s*/gi, ' ');
    n = n.replace(FORM_RE, ' ');
    n = n.replace(/\s*\(\s*\)\s*/g, ' ');
    n = n.replace(/\s{2,}/g, ' ').replace(/^[\s\-,/]+|[\s\-,/]+$/g, '').trim();
    // "(4-MMC)" → "4-MMC"
    if (/^\([^()]*\)$/.test(n)) n = n.slice(1, -1).trim();
    return n;
}

/** Salt/form label for a measurement, from its title. */
function detectForm(name) {
    const lower = name.toLowerCase();
    if (/\bhcl\b|hydrochlorid/.test(lower)) return 'HCl';
    if (/\bhbr\b|hydrobromide/.test(lower)) return 'HBr';
    if (/sulph?ate/.test(lower)) return 'sulphate';
    for (const t of ['phosphate', 'tartrate', 'fumarate', 'citrate', 'oxalate', 'maleate', 'nitrate']) {
        if (lower.includes(t)) return t;
    }
    if (/\bbase\b|\bneat\b|freebase/.test(lower)) return 'base';
    return null;
}

/** Pick the majority spelling of a name, preferring a capitalised variant on ties. */
function majority(values) {
    const counts = new Map();
    for (const v of values) {
        const k = v.toLowerCase();
        const e = counts.get(k) || { n: 0, forms: new Map() };
        e.n++;
        e.forms.set(v, (e.forms.get(v) || 0) + 1);
        counts.set(k, e);
    }
    const [, best] = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[0].length - b[0].length)[0];
    const spellings = [...best.forms.entries()].sort((a, b) => b[1] - a[1] || (/^[A-Z0-9]/.test(b[0]) ? 1 : 0) - (/^[A-Z0-9]/.test(a[0]) ? 1 : 0));
    return spellings[0][0];
}

/**
 * Display name + aliases for a group of measurements of one compound.
 * Names like "Mephedrone HCl / 4-MMC HCl" contribute "Mephedrone" (primary
 * candidate) and "4-MMC" (alias).
 */
function nameGroup(entries) {
    const primaries = [];
    const aliasSet = new Map(); // lower → display
    for (const e of entries) {
        const segments = e.name.split(/\s*\/\s*/).map(stripForm).filter(Boolean);
        if (segments.length === 0) continue;
        primaries.push(segments[0]);
        for (const s of segments.slice(1)) aliasSet.set(s.toLowerCase(), s);
        for (const extra of (e.header.NAMES || '').split(/\s*;\s*/)) {
            const s = stripForm(extra);
            if (s && s !== '-') aliasSet.set(s.toLowerCase(), s);
        }
    }
    // If every name was nothing but form tokens (rare), fall back to the raw titles
    let name = majority(primaries.length ? primaries : entries.map(e => e.name));
    // "caffeine" → "Caffeine", but leave "alpha-PVP" / "p-Benzoquinone" alone
    if (/^[a-z][a-z]{2,}(\s|$)/.test(name)) name = name[0].toUpperCase() + name.slice(1);
    // A two-letter code ("AL") is a poor headline when a real name is available
    if (name.length <= 2) {
        const longer = [...aliasSet.values()].find(a => a.length > 2 && !/^\d|\[|\(/.test(a) && a.length < 40);
        if (longer) name = longer;
    }
    // Other primary spellings are aliases too (e.g. "Amfetamine" vs "Amphetamine")
    for (const p of primaries) aliasSet.set(p.toLowerCase(), aliasSet.get(p.toLowerCase()) || p);
    aliasSet.delete(name.toLowerCase());
    const aliases = [...aliasSet.values()].slice(0, 8);
    return { name, aliases };
}

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// ---------------------------------------------------------------------------
// Choosing the representative spectrum
// ---------------------------------------------------------------------------

function measurementType(header) {
    const proc = (header['SAMPLING PROCEDURE'] || '').toLowerCase();
    if (proc.startsWith('gc')) return 'GC-IR';
    if (proc.startsWith('kbr')) return 'KBr';
    return 'ATR';
}

function score(entry, majorityForm) {
    const proc = (entry.header['SAMPLING PROCEDURE'] || '').toLowerCase();
    let s = 0;
    if (entry.measurement === 'ATR') s += 30;
    else if (entry.measurement === 'KBr') s += 20;
    if (proc.includes('direct measurement')) s += 5;
    if (entry.header.CLASS === 'Validated') s += 3;
    if (entry.form === majorityForm) s += 2;
    if (entry.firstX <= 460 && entry.lastX >= 3900) s += 1; // full range
    if (entry.points >= 400) s += 1;
    return s;
}

function pickRepresentative(entries) {
    const forms = entries.map(e => e.form).filter(Boolean);
    const majorityForm = forms.length ? majority(forms) : null;
    return [...entries].sort((a, b) => score(b, majorityForm) - score(a, majorityForm) || a.id - b.id)[0];
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function findSourceDir(argDir) {
    if (argDir) return path.resolve(argDir);
    const candidates = fs.readdirSync(ROOT)
        .filter(n => /^ENFSI_/i.test(n) && fs.statSync(path.join(ROOT, n)).isDirectory())
        .sort()
        .reverse();
    if (candidates.length === 0) {
        throw new Error('No ENFSI_* folder found in the repo root. Pass the JCAMP-DX folder as an argument.');
    }
    return path.join(ROOT, candidates[0]);
}

export function buildLibrary(sourceDir) {
    const dir = findSourceDir(sourceDir);
    const files = fs.readdirSync(dir).filter(f => /\.jdx$/i.test(f)).sort();
    console.log('='.repeat(60));
    console.log('ENFSI library build');
    console.log('='.repeat(60));
    console.log(`Source: ${path.relative(ROOT, dir) || dir}  (${files.length} JCAMP-DX files)`);

    // 1–2. Parse and group by InChIKey
    const groups = new Map();
    let skipped = 0;
    for (const file of files) {
        let parsed;
        try {
            parsed = parseJCAMP(path.join(dir, file));
        } catch (error) {
            console.warn(`  ! ${file}: ${error.message}`);
            skipped++;
            continue;
        }
        const { header, spectrum } = parsed;
        const fullKey = (header['CROSS REFERNCE'] || header['CROSS REFERENCE'] || '').match(INCHIKEY_RE)?.[1];
        const key = fullKey?.slice(0, 14);
        if (!key || spectrum.length < 50) {
            console.warn(`  ! ${file}: ${!key ? 'no InChIKey' : 'too few points'} — skipped`);
            skipped++;
            continue;
        }
        const name = titleToName(header.TITLE) || file.replace(/\.jdx$/i, '');
        const entry = {
            id: parseInt(file.match(/^#(\d+)/)?.[1] || '0', 10),
            file, header, spectrum, name, inchikey: fullKey,
            form: detectForm(name),
            measurement: measurementType(header),
            firstX: spectrum[0].wavenumber,
            lastX: spectrum[spectrum.length - 1].wavenumber,
            points: spectrum.length,
        };
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
    }
    console.log(`Parsed ${files.length - skipped} spectra → ${groups.size} distinct compounds`);

    // The library sometimes keys the same compound twice (salt InChI vs base
    // InChI, or a stray stereo layer). Merge groups whose display name and
    // base formula agree; give the rest a formula suffix so names stay unique.
    const named = new Map();
    for (const [key, entries] of groups) {
        const { name } = nameGroup(entries);
        const formula = (pickRepresentative(entries).header.MOLFORM || '').split('.')[0].toLowerCase();
        const sig = `${name.toLowerCase()}|${formula}`;
        if (named.has(sig)) {
            named.get(sig).push(...entries);
            groups.delete(key);
        } else {
            named.set(sig, entries);
        }
    }
    const byName = new Map();
    for (const entries of groups.values()) {
        const { name } = nameGroup(entries);
        if (!byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), []);
        byName.get(name.toLowerCase()).push(entries);
    }
    const disambiguate = new Set([...byName.values()].filter(v => v.length > 1).flat());
    console.log(`Merged salt/stereo duplicates → ${groups.size} compounds (${disambiguate.size} share a name and get a formula suffix)`);

    // 3–5. One record per compound
    const records = [];
    const usedIds = new Set();
    const stats = { ATR: 0, 'GC-IR': 0, KBr: 0, validated: 0 };
    for (const [key, entries] of groups) {
        const rep = pickRepresentative(entries);
        let { name, aliases } = nameGroup(entries);
        if (NAME_OVERRIDES[key]) {
            if (!aliases.some(a => a.toLowerCase() === name.toLowerCase())) aliases.unshift(name);
            name = NAME_OVERRIDES[key];
            aliases = aliases.filter(a => a.toLowerCase() !== name.toLowerCase());
        }
        if (disambiguate.has(entries) && rep.header.MOLFORM) {
            name = `${name} (${rep.header.MOLFORM.split('.')[0]})`;
        }

        let id = slugify(name) || slugify(key);
        if (usedIds.has(id)) id = `${id}_${key.slice(0, 4).toLowerCase()}`;
        usedIds.add(id);

        const record = {
            id,
            name,
            aliases,
            formula: rep.header.MOLFORM || '',
            mw: rep.header.MW ? Number(parseFloat(rep.header.MW).toFixed(2)) : null,
            iupac: rep.header['CAS NAME'] && rep.header['CAS NAME'] !== '-' ? rep.header['CAS NAME'] : '',
            inchikey: rep.inchikey,
            form: rep.form,
            measurement: rep.measurement,
            validated: rep.header.CLASS === 'Validated',
            variants: entries.length,
            source: `ENFSI DWG IR Library (${rep.header.ORIGIN?.replace(/^ENFSI DWG\s*/i, '') || 'unknown release'})`,
            enfsiId: rep.id,
        };
        record.category = categorizeSubstance({ ...record, category: undefined });
        record.spectrum = SpectrumCodec.encodeSpectrum(resample(toTransmittance(rep.spectrum), TARGET_POINTS));

        stats[rep.measurement]++;
        if (record.validated) stats.validated++;
        records.push(record);
    }

    records.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(records), 'utf8');

    const categories = {};
    for (const r of records) categories[r.category] = (categories[r.category] || 0) + 1;

    console.log(`\nWrote ${records.length} records → ${path.relative(ROOT, OUTPUT_FILE)} (${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`Representative spectra: ATR ${stats.ATR}, KBr ${stats.KBr}, GC-IR ${stats['GC-IR']} (${stats.validated} validated)`);
    console.log('Categories:', Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
    return records;
}

// Run when executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        buildLibrary(process.argv[2]);
    } catch (error) {
        console.error('Build failed:', error.message);
        process.exit(1);
    }
}
