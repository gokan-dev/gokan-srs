#!/usr/bin/env bun
// Checks a finished build (dist/), as the last step of `bun run build`: every size budget
// (src/lib/budgets.ts), no Svelte runtime in any client asset, and the search acceptance queries
// run against the real built index rather than a fixture. Exits non-zero, failing the build, on
// any miss. Thin glue over pure, tested modules; verified by running it.

import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { describe, overBudget, percentile, type Measurement } from '../src/lib/budgets';
import { prepareIndex, search, TIER } from '../src/lib/searchQuery';
import type { SearchIndexFile } from '../src/lib/types';

const DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

interface ViteManifestEntry {
    file: string;
    dynamicImports?: string[];
}

const sizeOf = (relative: string) => fs.statSync(path.join(DIST_DIR, relative)).size;
const pageOf = (...segments: string[]) => path.join(...segments, 'index.html');
const readJson = (relative: string): unknown => JSON.parse(fs.readFileSync(path.join(DIST_DIR, relative), 'utf-8'));

function subdirectories(relative: string): string[] {
    return fs.readdirSync(path.join(DIST_DIR, relative), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
}

function measure(manifest: Record<string, ViteManifestEntry>): Measurement[] {
    const measurements: Measurement[] = [];

    const wordPages = subdirectories('vocab').filter(name => /^\d+$/.test(name));
    measurements.push({ budget: 'wordPageP90', subject: `${wordPages.length} word pages`, bytes: percentile(wordPages.map(id => sizeOf(pageOf('vocab', id))), 90) });

    const kanjiSizes = subdirectories('kanji').map(character => ({ character, bytes: sizeOf(pageOf('kanji', character)) }));
    const heaviest = kanjiSizes.reduce((a, b) => (b.bytes > a.bytes ? b : a));
    measurements.push({ budget: 'kanjiPageMax', subject: `kanji/${heaviest.character}`, bytes: heaviest.bytes });

    measurements.push({ budget: 'grammarIndex', subject: 'grammar/', bytes: sizeOf(pageOf('grammar')) });

    for (const list of subdirectories('vocab').filter(name => name.startsWith('jlpt-'))) {
        measurements.push({ budget: 'jlptPage', subject: `vocab/${list}/`, bytes: sizeOf(pageOf('vocab', list)) });
        for (const page of subdirectories(path.join('vocab', list))) {
            measurements.push({ budget: 'jlptPage', subject: `vocab/${list}/${page}/`, bytes: sizeOf(pageOf('vocab', list, page)) });
        }
    }

    measurements.push({ budget: 'sharedStylesheet', subject: manifest['src/styles/app.scss'].file, bytes: sizeOf(manifest['src/styles/app.scss'].file) });
    const searchEntry = manifest['src/client/search.ts'];
    measurements.push({ budget: 'searchScript', subject: searchEntry.file, bytes: sizeOf(searchEntry.file) });
    for (const chunk of searchEntry.dynamicImports ?? []) {
        measurements.push({ budget: 'searchEngine', subject: manifest[chunk].file, bytes: sizeOf(manifest[chunk].file) });
    }

    const core = fs.readFileSync(path.join(DIST_DIR, 'data', 'search-core.json'));
    measurements.push({ budget: 'searchCoreGzip', subject: 'data/search-core.json', bytes: gzipSync(core, { level: 9 }).length });

    for (const font of fs.readdirSync(path.join(DIST_DIR, 'assets')).filter(name => name.endsWith('.woff2'))) {
        measurements.push({ budget: 'webFont', subject: `assets/${font}`, bytes: sizeOf(path.join('assets', font)) });
    }
    return measurements;
}

/** Problems other than sizes: a second web font, or a Svelte runtime reaching the browser. */
function assetProblems(): string[] {
    const problems: string[] = [];
    const assets = fs.readdirSync(path.join(DIST_DIR, 'assets'));
    const fonts = assets.filter(name => /\.(woff2?|ttf|otf)$/.test(name));
    if (fonts.length !== 1) problems.push(`expected one web font, found ${fonts.length}: ${fonts.join(', ')}`);
    for (const script of assets.filter(name => name.endsWith('.js'))) {
        // Every Svelte client runtime build links its error codes to svelte.dev/e/.
        if (fs.readFileSync(path.join(DIST_DIR, 'assets', script), 'utf-8').includes('svelte.dev/e/')) {
            problems.push(`assets/${script} contains the Svelte client runtime`);
        }
    }
    return problems;
}

/** The issue's acceptance queries (#118), against the real index: core and full, as a reader gets them. */
function searchProblems(): string[] {
    const index = prepareIndex([readJson('data/search-core.json') as SearchIndexFile, readJson('data/search-full.json') as SearchIndexFile]);
    const headwords = (query: string, count: number) => search(index, query).words.slice(0, count).map(hit => hit.row[1]);
    const problems: string[] = [];
    const expect = (ok: boolean, message: string) => {
        if (!ok) problems.push(message);
    };

    expect(headwords('eat', 3).includes('食べる'), `"eat": 食べる not in the top 3 (${headwords('eat', 3).join(', ')})`);
    expect(headwords('taberu', 1)[0] === '食べる', `"taberu": 食べる not first (${headwords('taberu', 3).join(', ')})`);
    // Romaji typed partway through a syllable still finds the word (#139).
    for (const [query, headword] of [['tabe', '食べる'], ['taber', '食べる'], ['benky', '勉強'], ['nihong', '日本語'], ['chot', 'ちょっと']]) {
        // Top 5: "chot" also starts four JLPT words in ちょっ (直感...), which tie with ちょっと.
        expect(headwords(query, 5).includes(headword), `"${query}": ${headword} not in the top 5 (${headwords(query, 5).join(', ')})`);
    }
    // An English word is read as English before it is read as the start of a reading (#139).
    for (const [query, headword] of [['car', '車'], ['house', '家']]) {
        const hits = search(index, query).words;
        const at = hits.findIndex(hit => hit.row[1] === headword);
        const firstRomaji = hits.findIndex(hit => hit.tier === TIER.romajiPrefix);
        expect(at !== -1 && (firstRomaji === -1 || at < firstRomaji), `"${query}": ${headword} not before the romaji prefix matches (${headwords(query, 3).join(', ')})`);
    }
    expect(headwords('食べた', 1)[0] === '食べる', `"食べた": 食べる not first (${headwords('食べた', 3).join(', ')})`);
    const sei = headwords('生', 10);
    for (const word of ['生', '生活', '先生', '学生']) {
        expect(sei.includes(word), `"生": ${word} not in the first 10 (${sei.join(', ')})`);
    }
    expect(search(index, '生').kanji.some(row => row[0] === '生'), '"生": the kanji 生 is not among the results');
    // The point's title is "～から、～": its placeholders and punctuation are not part of the pattern.
    const kara = search(index, 'から').grammar.map(row => row[1]);
    expect(kara.some(title => title.replace(/[～〜、。\s]/g, '') === 'から'), `"から": the grammar point から is not among the results (${kara.slice(0, 3).join(', ')})`);
    return problems;
}

const manifest = readJson(path.join('.vite', 'manifest.json')) as Record<string, ViteManifestEntry>;
const measurements = measure(manifest);
const over = overBudget(measurements);
const problems = [...over.map(m => `over budget: ${describe(m)}`), ...assetProblems(), ...searchProblems()];

for (const m of measurements.filter(m => m.budget !== 'jlptPage')) console.log(`[check-build] ${describe(m)}`);
const jlpt = measurements.filter(m => m.budget === 'jlptPage');
console.log(`[check-build] ${describe(jlpt.reduce((a, b) => (b.bytes > a.bytes ? b : a)))} (heaviest of ${jlpt.length} JLPT list pages)`);

if (problems.length > 0) {
    for (const problem of problems) console.error(`[check-build] ${problem}`);
    process.exit(1);
}
console.log('[check-build] every budget met, no Svelte runtime, search acceptance queries pass.');
