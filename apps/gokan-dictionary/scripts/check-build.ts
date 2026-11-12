#!/usr/bin/env bun
// Checks a finished build (dist/), as the last step of `bun run build`: every size budget
// (src/lib/budgets.ts), no Svelte runtime in any client asset, and the search acceptance queries
// run against the real built index of every served locale rather than a fixture. Exits non-zero,
// failing the build, on any miss. Thin glue over pure, tested modules; verified by running it.

import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { listFiles } from '@gokan/deploy/build-files';
import { serveDictionaryOnRequest } from '../../../scripts/lib/builtSite';
import { describe, overBudget, percentile, type Measurement } from '../src/lib/budgets';
import { alternateProblems, brokenLinks } from '../src/lib/builtLinks';
import { DATASET_PATHS } from '../src/lib/datasetPaths';
import { misroutedPaths } from '../src/lib/servedPaths';
import { datasetLanguageOf, htmlLang, localePrefix, SERVED_LOCALES, type ServedLocale } from '../src/lib/locale';
import { inSection, linkUrls } from '../src/lib/localeLinks';
import { BASE_PATH, SITE_ORIGIN } from '../src/lib/site';
import { sitemapProblems as sitemapFileProblems } from '../src/lib/sitemap';
import { messagesFor } from '../src/lib/messages';
import { kanaToHepburn } from '@gokan/dataset-schema';
import type { TextFile } from '@gokan/dataset-schema/text';
import { fromColumns } from '../src/lib/searchIndex';
import { prepareIndex, search, TIER, type PreparedIndex } from '../src/lib/searchQuery';
import { readingOfRow } from '../src/lib/searchRow';
import type { SearchIndexFile, SearchWordRow } from '../src/lib/types';

const APP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(APP_DIR, 'dist');
/** The dataset checkout the build read (lib/dataset.server.ts resolves the same one; sourceNameProblems fails if it finds no text there). */
const COMPILED_DIR = path.join(APP_DIR, '..', 'gokan-srs', 'dataset', 'compiled');

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

/** The word pages under `prefix`: English's (''), or a locale's (zh-hans/vocab/{id}/) when the build serves it (VITE_DICTIONARY_LOCALES). */
function wordPages(prefix = ''): string[] {
    const dir = path.join(prefix, 'vocab');
    return fs.existsSync(path.join(DIST_DIR, dir)) ? subdirectories(dir).filter(name => /^\d+$/.test(name)) : [];
}
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
    const chineseWords = ENTITY_PAGES === 'prerendered' ? wordPages('zh-hans') : [];
    if (chineseWords.length > 0) {
        measurements.push({ budget: 'wordPageP90', subject: `${chineseWords.length} zh-hans word pages`, bytes: percentile(chineseWords.map(id => sizeOf(pageOf('zh-hans', 'vocab', id))), 90) });
    }
    const kanjiSizes = (ENTITY_PAGES === 'prerendered' ? kanjiPages() : []).map(character => ({ character, bytes: sizeOf(pageOf('kanji', character)) }));
    if (kanjiSizes.length > 0) {
        const heaviest = kanjiSizes.reduce((a, b) => (b.bytes > a.bytes ? b : a));
        measurements.push({ budget: 'kanjiPageMax', subject: `kanji/${heaviest.character}`, bytes: heaviest.bytes });
    }

    measurements.push({ budget: 'grammarIndex', subject: 'grammar/', bytes: sizeOf(pageOf('grammar')) });

    // Every locale's JLPT lists: English's, and Chinese's when the build serves it.
    for (const vocab of ['vocab', path.join('zh-hans', 'vocab')].filter(dir => fs.existsSync(path.join(DIST_DIR, dir)))) {
        for (const list of subdirectories(vocab).filter(name => name.startsWith('jlpt-'))) {
            measurements.push({ budget: 'jlptPage', subject: `${vocab}/${list}/`, bytes: sizeOf(pageOf(vocab, list)) });
            for (const page of subdirectories(path.join(vocab, list))) {
                measurements.push({ budget: 'jlptPage', subject: `${vocab}/${list}/${page}/`, bytes: sizeOf(pageOf(vocab, list, page)) });
            }
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
    for (const [source, { file }] of Object.entries(manifest).filter(([source]) => source.startsWith('src/styles/locales/'))) {
        measurements.push({ budget: 'localeStylesheet', subject: `${file} (${source})`, bytes: sizeOf(file) });
    }
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
    const [words, kanji] = [wordPages().length + wordPages('zh-hans').length, kanjiPages().length];
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

/** A locale's directory under dist/ (its segment; none for English), as path segments. */
const localeDir = (locale: ServedLocale) => localePrefix(locale).split('/').filter(Boolean);

/** A locale's built index files, core then full, as its pages' script fetches them (searchIndexPaths). */
function builtIndexFiles(locale: ServedLocale): SearchIndexFile[] {
    const dir = path.join('data', ...localeDir(locale));
    return [readJson(path.join(dir, 'search-core.json')) as SearchIndexFile, readJson(path.join(dir, 'search-full.json')) as SearchIndexFile];
}

/** The issue's acceptance queries (#118), against the real index: core and full, as a reader gets them. */
function searchProblems(): string[] {
    const index = prepareIndex(builtIndexFiles('en'));
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

/** How many words of another locale's index its acceptance queries sample, spread over its frequency order. */
const LOCALE_SEARCH_SAMPLE = 25;

/** A Chinese gloss's first meaning, as the matcher splits it (lib/searchQuery.ts): NFKC, no parenthesised notes, up to its first separator. */
const firstChineseSense = (gloss: string) => gloss.normalize('NFKC').replace(/\([^)]*\)/g, '').split(/[,;、。]/).map(part => part.trim()).find(part => part !== '') ?? '';

/**
 * Another locale's search (#228), against its real index: every word in it has a page in the
 * locale (built in dist/; on request, the sample is asked of the server, unmatchedPathProblems),
 * and for a sample of its words, the headword, the kana, the romaji and the first meaning in the
 * locale's language each find the word, linked to its page in the section.
 */
function localeSearchProblems(locale: ServedLocale): { problems: string[]; pages: string[] } {
    const files = builtIndexFiles(locale);
    const index: PreparedIndex = prepareIndex(files, datasetLanguageOf(locale));
    const rows: SearchWordRow[] = files.flatMap(file => fromColumns(file.w));
    const links = linkUrls(locale);
    const problems: string[] = [];
    if (rows.length === 0) return { problems: [`the ${locale} search index holds no word`], pages: [] };

    if (ENTITY_PAGES === 'prerendered') {
        const missing = rows.filter(row => !fs.existsSync(path.join(DIST_DIR, ...localeDir(locale), 'vocab', row[0], 'index.html')));
        for (const row of missing.slice(0, 5)) problems.push(`the ${locale} search index holds ${row[0]} (${row[1]}), which has no ${locale} page`);
    }

    const size = Math.min(LOCALE_SEARCH_SAMPLE, rows.length);
    const sample = Array.from({ length: size }, (_, i) => rows[Math.floor((i * rows.length) / size)]);
    for (const row of sample) {
        const href = links.vocabPath(row[0]);
        if (!inSection(locale, href)) problems.push(`${row[1]} (${row[0]}): a ${locale} result links ${href}, outside its section`);
        const reading = readingOfRow(row);
        const queries: [kind: string, query: string, worstTier: number][] = [
            ['Japanese', row[1], TIER.exact],
            ['kana', reading, TIER.exact],
            // Hepburn, which the search reads back (kanaToRomaji is IME keystrokes: げんいん as "gennin").
            ['romaji', kanaToHepburn(reading), TIER.romaji],

            [locale, firstChineseSense(row[3]), TIER.sense],
        ];
        for (const [kind, query, worstTier] of queries) {
            const hit = search(index, query).words.find(found => found.row[0] === row[0]);
            if (!hit || hit.tier > worstTier) problems.push(`${row[1]} (${row[0]}): the ${kind} query "${query}" does not find it in the ${locale} index${hit ? ` (tier ${hit.tier})` : ''}`);
        }
    }
    return { problems: problems.slice(0, 10), pages: sample.map(row => links.vocabPath(row[0])) };
}

const localeSearches = SERVED_LOCALES.filter(locale => localePrefix(locale) !== '').map(localeSearchProblems);

const manifest = readJson(path.join('.vite', 'manifest.json')) as Record<string, ViteManifestEntry>;
const measurements = measure(manifest);
const over = overBudget(measurements);
/** Every sitemap the build writes (the index and each locale's, at dist/'s root) is one a search engine reads: none over its URL limit. */
function sitemapProblems(): string[] {
    const sitemaps = fs.readdirSync(DIST_DIR).filter(name => /^sitemap(-[a-z-]+)?\.xml$/.test(name));
    if (sitemaps.length === 0) return ['no sitemap.xml in dist/'];
    return sitemaps.flatMap(name => sitemapFileProblems(name, fs.readFileSync(path.join(DIST_DIR, name), 'utf-8')));
}

/** CloudFront routes by a dot in the path (lib/servedPaths.ts): every built path must follow it. */
function routingProblems(): string[] {
    const files = listFiles(DIST_DIR).filter(file => !file.startsWith('.vite/'));
    return misroutedPaths(files).slice(0, 5).map(file => `${file}: CloudFront would ask the wrong origin for it (a page path has no dot, a file name has one)`);
}

/** Every built page under `dir` (relative to dist/), as its index.html. */
function pagesUnder(dir: string): string[] {
    if (!fs.existsSync(path.join(DIST_DIR, dir))) return [];
    return listFiles(path.join(DIST_DIR, dir)).filter(file => file.endsWith('index.html')).map(file => path.join(dir, file));
}

const readBuilt = (file: string): string | null => (fs.existsSync(path.join(DIST_DIR, file)) ? fs.readFileSync(path.join(DIST_DIR, file), 'utf-8') : null);

/**
 * Every internal link on a Chinese page names a built page or file: it links a page in Chinese
 * only where one is served, and English's otherwise (lib/localeLinks.ts). English's pages are all
 * built, so a broken link there would be a missing page, which the other checks catch.
 */
function linkProblems(): string[] {
    // On request, a word page is the server's, not a file: a list page's link to one is checked
    // by the server answering it (check:parity --against-server), not here.
    const servedOnRequest = (file: string) => ENTITY_PAGES === 'on-request' && /^(zh-hans\/)?vocab\/\d+\/index\.html$/.test(file);
    const exists = (file: string) => servedOnRequest(file) || fs.existsSync(path.join(DIST_DIR, file));
    const problems: string[] = [];
    for (const page of pagesUnder('zh-hans')) {
        for (const href of brokenLinks(readBuilt(page) ?? '', BASE_PATH, exists)) problems.push(`${page} links ${href}, which is not built`);
    }
    return problems.slice(0, 5);
}

/**
 * Every page's hreflang alternates answer each other (lib/builtLinks.ts, alternateProblems): each
 * Chinese page, and each English page of a type Chinese serves (home, words, vocabulary lists).
 */
function alternatesProblems(): string[] {
    const english = ['index.html', ...pagesUnder('vocab')];
    return [...pagesUnder('zh-hans'), ...english].flatMap(page => alternateProblems(page, readBuilt, SITE_ORIGIN, BASE_PATH)).slice(0, 5);
}

/**
 * Every source a word page in another language may credit (its words' and sentences' text files)
 * has a name in the locale's catalog: a word page with one it cannot name fails to render, so a
 * source the dataset adds is named here first, never printed as its id.
 */
function sourceNameProblems(): string[] {
    const problems: string[] = [];
    for (const locale of SERVED_LOCALES.filter(served => localePrefix(served) !== '')) {
        const named = messagesFor(locale).sources;
        const language = datasetLanguageOf(locale);
        const found = new Set<string>();
        // The directories the pages read (lib/datasetPaths.ts, through localeText.ts): a missing one
        // means this check and the pages have drifted apart, so it fails rather than reading nothing.
        for (const group of [path.dirname(DATASET_PATHS.vocab('_')), path.dirname(DATASET_PATHS.sentences('_'))]) {
            const dir = path.join(COMPILED_DIR, DATASET_PATHS.text(language, group));
            if (!fs.existsSync(dir)) {
                problems.push(`the ${locale} text has no ${group} directory to read its sources from (${dir})`);
                continue;
            }
            for (const file of listFiles(dir).filter(name => name.endsWith('.json'))) {
                const text = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as TextFile;
                for (const entity of Object.values(text.entities)) for (const rendering of entity?.renderings ?? []) found.add(rendering.source.source);
            }
        }
        if (found.size === 0) problems.push(`the ${locale} text names no source at all (read under ${path.join(COMPILED_DIR, 'text', language)}): the check read nothing`);
        for (const id of found) if (named[id] === undefined) problems.push(`source "${id}" in the ${locale} text has no name in its catalog (lib/messages, sources)`);
    }
    return problems;
}

/**
 * A path no route matches answers 404 in the language of its section, from the server (build/,
 * built in either mode): never a 500 from an error page whose chrome and document disagree on its
 * locale (routes/+layout.ts and handleError both read it with localeOfPath). Only a server sees
 * these paths, so the prerendered files cannot show it.
 */
async function unmatchedPathProblems(): Promise<string[]> {
    const locales = SERVED_LOCALES.filter(locale => localePrefix(locale) !== '');
    if (locales.length === 0) return [];
    const site = await serveDictionaryOnRequest();
    try {
        const problems: string[] = [];
        for (const locale of locales) {
            for (const rest of ['/kanji/', '/nope/']) {
                const pathname = `/dictionary${localePrefix(locale)}${rest}`;
                const response = await fetch(`http://127.0.0.1:${site.port}${pathname}`);
                const html = await response.text();
                if (response.status !== 404) problems.push(`${pathname} answers ${response.status}, not 404`);
                else if (!html.includes(`<html lang="${htmlLang(locale)}"`)) problems.push(`${pathname}'s 404 is not a page in ${htmlLang(locale)}`);
            }
        }
        // The pages the sampled search results link (localeSearchProblems), in either mode.
        for (const pathname of localeSearches.flatMap(found => found.pages)) {
            const response = await fetch(`http://127.0.0.1:${site.port}${pathname}`);
            if (response.status !== 200) problems.push(`${pathname}, a search result, answers ${response.status}`);
        }
        return problems;
    } finally {
        site.stop();
    }
}

const problems = [...over.map(m => `over budget: ${describe(m)}`), ...modeProblems(), ...assetProblems(), ...searchProblems(), ...localeSearches.flatMap(found => found.problems), ...sitemapProblems(), ...routingProblems(), ...linkProblems(), ...alternatesProblems(), ...sourceNameProblems(), ...(await unmatchedPathProblems())];

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
