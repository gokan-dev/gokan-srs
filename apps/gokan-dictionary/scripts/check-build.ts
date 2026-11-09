#!/usr/bin/env bun
// Checks a finished build (dist/), as the last step of `bun run build`: every size budget
// (src/lib/budgets.ts), no Svelte runtime in any client asset, and the search acceptance queries
// run against the real built index rather than a fixture. Exits non-zero, failing the build, on
// any miss. Thin glue over pure, tested modules; verified by running it.

import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { listFiles } from '@gokan/deploy/build-files';
import { describe, overBudget, percentile, type Measurement } from '../src/lib/budgets';
import { misroutedPaths } from '../src/lib/servedPaths';
import { prepareIndex, search, TIER } from '../src/lib/searchQuery';
import type { SearchIndexFile } from '../src/lib/types';

const APP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(APP_DIR, 'dist');

/**
 * How the build served the entity pages (vite.config.ts reads the same variable). Prerendered,
 * their budgets are measured here; on request, dist/ holds none and the server renders them
 * (build/), so their budgets are measured on the static build, which `check:parity
 * --against-server` proves the server's pages equal, byte for byte.
 */
const ENTITY_PAGES = process.env.DICTIONARY_ENTITY_PAGES === 'on-request' ? 'on-request' : 'prerendered';

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

const wordPages = () => subdirectories('vocab').filter(name => /^\d+$/.test(name));
/** A locale's word pages (zh-hans/vocab/{id}/), when the build serves it (VITE_DICTIONARY_LOCALES). */
const localeWordPages = (locale: string) => (fs.existsSync(path.join(DIST_DIR, locale, 'vocab')) ? subdirectories(path.join(locale, 'vocab')).filter(name => /^\d+$/.test(name)) : []);
// kanji/orders/ is the learning order pages, not a kanji: no kanji is named with a Latin word.
const kanjiPages = () => subdirectories('kanji').filter(name => name !== 'orders');

function measure(manifest: Record<string, ViteManifestEntry>): Measurement[] {
    const measurements: Measurement[] = [];

    // A prerendered build without them is modeProblems' to report.
    const words = ENTITY_PAGES === 'prerendered' ? wordPages() : [];
    if (words.length > 0) {
        measurements.push({ budget: 'wordPageP90', subject: `${words.length} word pages`, bytes: percentile(words.map(id => sizeOf(pageOf('vocab', id))), 90) });
    }
    // Chinese word pages are word pages: held to the same budget.
    const chineseWords = ENTITY_PAGES === 'prerendered' ? localeWordPages('zh-hans') : [];
    if (chineseWords.length > 0) {
        measurements.push({ budget: 'wordPageP90', subject: `${chineseWords.length} zh-hans word pages`, bytes: percentile(chineseWords.map(id => sizeOf(pageOf('zh-hans', 'vocab', id))), 90) });
    }
    const kanjiSizes = (ENTITY_PAGES === 'prerendered' ? kanjiPages() : []).map(character => ({ character, bytes: sizeOf(pageOf('kanji', character)) }));
    if (kanjiSizes.length > 0) {
        const heaviest = kanjiSizes.reduce((a, b) => (b.bytes > a.bytes ? b : a));
        measurements.push({ budget: 'kanjiPageMax', subject: `kanji/${heaviest.character}`, bytes: heaviest.bytes });
    }

    measurements.push({ budget: 'grammarIndex', subject: 'grammar/', bytes: sizeOf(pageOf('grammar')) });

    for (const list of subdirectories('vocab').filter(name => name.startsWith('jlpt-'))) {
        measurements.push({ budget: 'jlptPage', subject: `vocab/${list}/`, bytes: sizeOf(pageOf('vocab', list)) });
        for (const page of subdirectories(path.join('vocab', list))) {
            measurements.push({ budget: 'jlptPage', subject: `vocab/${list}/${page}/`, bytes: sizeOf(pageOf('vocab', list, page)) });
        }
    }

    measurements.push({ budget: 'kanjiOrderPage', subject: 'kanji/orders/', bytes: sizeOf(pageOf('kanji', 'orders')) });
    for (const order of subdirectories(path.join('kanji', 'orders'))) {
        measurements.push({ budget: 'kanjiOrderPage', subject: `kanji/orders/${order}/`, bytes: sizeOf(pageOf('kanji', 'orders', order)) });
        for (const range of subdirectories(path.join('kanji', 'orders', order))) {
            measurements.push({ budget: 'kanjiOrderPage', subject: `kanji/orders/${order}/${range}/`, bytes: sizeOf(pageOf('kanji', 'orders', order, range)) });
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

/** The build has the pages its mode says: every entity page prerendered, or none and the server built. */
function modeProblems(): string[] {
    const [words, kanji] = [wordPages().length + localeWordPages('zh-hans').length, kanjiPages().length];
    if (ENTITY_PAGES === 'prerendered') return words > 0 && kanji > 0 ? [] : [`prerendered build with ${words} word and ${kanji} kanji pages in dist/`];
    const problems = words + kanji > 0 ? [`on-request build with ${words} word and ${kanji} kanji pages in dist/: they are the server's`] : [];
    if (!fs.existsSync(path.join(APP_DIR, 'build', 'handler.js'))) problems.push('on-request build without its server (build/handler.js)');
    return problems;
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
    // "chot" gets the top 5: it also starts four JLPT words in ちょっ (直感...), which tie with ちょっと.
    for (const [query, headword, top] of [['tabe', '食べる', 3], ['taber', '食べる', 3], ['benky', '勉強', 3], ['nihong', '日本語', 3], ['chot', 'ちょっと', 5]] as const) {
        expect(headwords(query, top).includes(headword), `"${query}": ${headword} not in the top ${top} (${headwords(query, top).join(', ')})`);
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
/** CloudFront routes by a dot in the path (lib/servedPaths.ts): every built path must follow it. */
function routingProblems(): string[] {
    const files = listFiles(DIST_DIR).filter(file => !file.startsWith('.vite/'));
    return misroutedPaths(files).slice(0, 5).map(file => `${file}: CloudFront would ask the wrong origin for it (a page path has no dot, a file name has one)`);
}

const problems = [...over.map(m => `over budget: ${describe(m)}`), ...modeProblems(), ...assetProblems(), ...searchProblems(), ...routingProblems()];

// A budget over many pages reports its heaviest.
const MANY_PAGES: Partial<Record<Measurement['budget'], string>> = { jlptPage: 'JLPT list pages', kanjiOrderPage: 'kanji order pages' };
for (const m of measurements.filter(m => MANY_PAGES[m.budget] === undefined)) console.log(`[check-build] ${describe(m)}`);
for (const [budget, pages] of Object.entries(MANY_PAGES)) {
    const group = measurements.filter(m => m.budget === budget);
    console.log(`[check-build] ${describe(group.reduce((a, b) => (b.bytes > a.bytes ? b : a)))} (heaviest of ${group.length} ${pages})`);
}

if (problems.length > 0) {
    for (const problem of problems) console.error(`[check-build] ${problem}`);
    process.exit(1);
}
if (ENTITY_PAGES === 'on-request') console.log('[check-build] entity pages rendered on request: their budgets are measured on the static build (check:parity --against-server).');
console.log('[check-build] every budget met, no Svelte runtime, search acceptance queries pass.');
