#!/usr/bin/env bun
// Checks a finished build (dist/), as the last step of `bun run build`: every size budget
// (src/lib/budgets.ts), no Svelte runtime in any client asset, and the search acceptance queries
// run against the real built index of every served locale rather than a fixture. Exits non-zero,
// failing the build, on any miss. Thin glue over pure, tested modules; verified by running it.

import fs from 'node:fs';
import path from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { listFiles } from '@gokan/deploy/build-files';
import { serveDictionaryOnRequest } from '../../../scripts/lib/builtSite';
import { countedBytes, describe, firstScreen, firstScreenRowsOf, overBudget, percentile, type BudgetName, type Measurement, type PageBudgetName } from '../src/lib/budgets';
import { alternateProblems, brokenLinks } from '../src/lib/builtLinks';
import { DATASET_PATHS } from '../src/lib/datasetPaths';
import { misroutedPaths } from '../src/lib/servedPaths';
import { datasetLanguageOf, htmlLang, localePrefix, SERVED_LOCALES, type ServedLocale } from '../src/lib/locale';
import { inSection, linkUrls } from '../src/lib/localeLinks';
import { BASE_PATH, SITE_ORIGIN } from '../src/lib/site';
import { sitemapProblems as sitemapFileProblems } from '../src/lib/sitemap';
import { messagesFor } from '../src/lib/messages';
import { kanaToHepburn, readingOfRow } from '@gokan/dataset-schema';
import type { TextFile } from '@gokan/dataset-schema/text';
import { fromColumns } from '../src/lib/searchIndex';
import { firstGloss, ROMAJI_PAGE_CAP, romajiOf } from '../src/lib/romaji';
import { prepareIndex, search, TIER, type PreparedIndex } from '../src/lib/searchQuery';
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
    imports?: string[];
}

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

/**
 * Brotli as CloudFront sends a page or an asset. Quality 5 matched what it served on 2026-11-19
 * within about 2% on every page type measured (#268: kanji/一 12.2 KB here, 12.5 KB served; the
 * JLPT N2 list 19.0 and 19.0; grammar/n5-088 8.1 and 8.2; app.scss 2.6 and 2.5), where quality 3
 * (scripts/lib/builtSite.ts, measured on the app's large JSON files) put pages about 10% over.
 */
const BROTLI_QUALITY = 5;
const brotliSize = (body: Buffer | string) => brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } }).length;
const read = (relative: string) => fs.readFileSync(path.join(DIST_DIR, relative));

/** A built file, raw and brotli. */
function fileMeasurement(budget: BudgetName, file: string): Measurement {
    const body = read(file);
    return { budget, subject: file, raw: body.length, brotli: brotliSize(body) };
}

/** Files a reader downloads together (a page's stylesheets, a script and its chunks), each compressed on its own as it is served. */
function filesMeasurement(budget: BudgetName, subject: string, files: string[]): Measurement {
    const each = files.map(file => fileMeasurement(budget, file));
    return { budget, subject, raw: each.reduce((sum, m) => sum + m.raw, 0), brotli: each.reduce((sum, m) => sum + m.brotli, 0) };
}

/** The stylesheets a page links, by their files under dist/, in its order: every one blocks its first paint. */
function stylesheetsOf(html: string): string[] {
    return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(([, href]) => href.slice(BASE_PATH.length + 1));
}

function measure(manifest: Record<string, ViteManifestEntry>): { measurements: Measurement[]; sheets: Set<string> } {
    const measurements: Measurement[] = [];
    /** Each set of stylesheets a measured page links, with the first page that links it. */
    const stylesheetSets = new Map<string, string>();
    const linksSheets = (html: string, subject: string) => {
        const sheets = stylesheetsOf(html).join(' + ');
        if (sheets !== '' && !stylesheetSets.has(sheets)) stylesheetSets.set(sheets, subject);
    };
    /**
     * A page, whole or (a list page, FIRST_SCREEN_ROWS) to the end of its first screen. The raw
     * figure is the whole page's, as it is stored.
     */
    const page = (budget: PageBudgetName, file: string, subject: string): Measurement => {
        const body = read(file);
        const html = body.toString('utf-8');
        const rows = firstScreenRowsOf(budget);
        const counted = rows === null ? html : firstScreen(html, rows);
        linksSheets(html, subject);
        return { budget, subject: counted.length < html.length ? `${subject} (first screen, ${rows} rows)` : subject, raw: body.length, brotli: brotliSize(counted) };
    };
    /** The heaviest page of a set, by what its budget counts. */
    const heaviest = (pages: Measurement[]) => pages.reduce((a, b) => (countedBytes(b) > countedBytes(a) ? b : a));

    // Word pages, English's and (when the build serves it) Chinese's, held to the same budget; a
    // prerendered build without them is modeProblems' to report. The 90th percentile of each figure.
    for (const prefix of ['', 'zh-hans']) {
        const words = ENTITY_PAGES === 'prerendered' ? wordPages(prefix) : [];
        if (words.length === 0) continue;
        const pages = words.map(id => page('wordPageP90', pageOf(prefix, 'vocab', id), path.join(prefix, 'vocab', id, '/')));
        const label = prefix === '' ? 'word pages' : `${prefix} word pages`;
        measurements.push({ budget: 'wordPageP90', subject: `${words.length} ${label}`, raw: percentile(pages.map(m => m.raw), 90), brotli: percentile(pages.map(m => m.brotli), 90) });
    }
    const kanji = (ENTITY_PAGES === 'prerendered' ? kanjiPages() : []).map(character => page('kanjiPageMax', pageOf('kanji', character), `kanji/${character}`));
    if (kanji.length > 0) measurements.push(heaviest(kanji));

    // A grammar point is named by its level and number (n5-088); the other directories are browse pages.
    const points = (ENTITY_PAGES === 'prerendered' ? subdirectories('grammar').filter(name => /^n[1-5]-\d+$/.test(name)) : []).map(id => page('grammarPageMax', pageOf('grammar', id), `grammar/${id}`));
    if (points.length > 0) measurements.push(heaviest(points));

    // Every romaji page (#278): at most 15 words each, the heaviest held to the first round trip.
    const romajiPages = romajiPageNames().map(name => page('romajiPageMax', pageOf('romaji', name), `romaji/${name}/`));
    if (romajiPages.length > 0) measurements.push(heaviest(romajiPages));

    measurements.push(page('homePage', 'index.html', 'home'));
    if (fs.existsSync(path.join(DIST_DIR, 'zh-hans', 'index.html'))) measurements.push(page('homePage', pageOf('zh-hans'), 'zh-hans/'));
    measurements.push(page('grammarIndex', pageOf('grammar'), 'grammar/'));

    // Every locale's JLPT lists: English's, and Chinese's when the build serves it.
    for (const vocab of ['vocab', path.join('zh-hans', 'vocab')].filter(dir => fs.existsSync(path.join(DIST_DIR, dir)))) {
        for (const list of subdirectories(vocab).filter(name => name.startsWith('jlpt-'))) {
            measurements.push(page('jlptPage', pageOf(vocab, list), `${vocab}/${list}/`));
            for (const n of subdirectories(path.join(vocab, list))) {
                measurements.push(page('jlptPage', pageOf(vocab, list, n), `${vocab}/${list}/${n}/`));
            }
        }
    }

    measurements.push(page('kanjiOrderPage', pageOf('kanji', 'orders'), 'kanji/orders/'));
    for (const order of subdirectories(path.join('kanji', 'orders'))) {
        measurements.push(page('kanjiOrderPage', pageOf('kanji', 'orders', order), `kanji/orders/${order}/`));
        for (const range of subdirectories(path.join('kanji', 'orders', order))) {
            measurements.push(page('kanjiOrderPage', pageOf('kanji', 'orders', order, range), `kanji/orders/${order}/${range}/`));
        }
    }

    // The page types no budget above measures link their own sheets too: one page of each, in
    // every locale that serves it, so every page's stylesheets are summed below.
    const grammarFamily = fs.existsSync(path.join(DIST_DIR, 'grammar', 'family')) ? subdirectories(path.join('grammar', 'family')).sort()[0] : undefined;
    const otherPages = [['kanji'], ['grammar', 'chapters'], ['grammar', 'conjugations'], ['grammar', 'families'], ...(grammarFamily === undefined ? [] : [['grammar', 'family', grammarFamily]])];
    for (const prefix of ['', 'zh-hans']) {
        for (const segments of otherPages) {
            const file = pageOf(prefix, ...segments);
            if (fs.existsSync(path.join(DIST_DIR, file))) linksSheets(read(file).toString('utf-8'), path.join(prefix, ...segments, '/'));
        }
    }

    // What blocks each page's first paint, together: the shared sheet, its page type's, its locale's.
    for (const [sheets, example] of stylesheetSets) {
        const files = sheets.split(' + ');
        measurements.push(filesMeasurement('blockingStylesheets', `${files.map(file => path.basename(file)).join(' + ')} (${example})`, files));
    }

    // A script with the chunks it imports statically: the bundler moves a module two scripts share
    // (the search engine's romaji and the detail script's kana folding) into a chunk of its own,
    // which each still downloads.
    const withImports = (budget: BudgetName, entry: ViteManifestEntry, seen = new Set<string>()): Measurement => {
        const files: string[] = [];
        const walk = (at: ViteManifestEntry) => {
            if (seen.has(at.file)) return;
            seen.add(at.file);
            files.push(at.file);
            for (const chunk of at.imports ?? []) walk(manifest[chunk]);
        };
        walk(entry);
        return filesMeasurement(budget, entry.file, files);
    };
    const searchEntry = manifest['src/client/search.ts'];
    measurements.push(withImports('searchScript', searchEntry));
    for (const chunk of searchEntry.dynamicImports ?? []) {
        measurements.push(withImports('searchEngine', manifest[chunk], new Set([searchEntry.file, ...(searchEntry.imports ?? []).map(shared => manifest[shared].file)])));
    }
    measurements.push(withImports('detailScript', manifest['src/client/detailTabs.ts']));
    measurements.push(withImports('playerScript', manifest['src/client/player.ts']));

    measurements.push(fileMeasurement('searchCore', path.join('data', 'search-core.json')));

    for (const font of fs.readdirSync(path.join(DIST_DIR, 'assets')).filter(name => name.endsWith('.woff2'))) {
        measurements.push(fileMeasurement('webFont', path.join('assets', font)));
    }
    return { measurements, sheets: new Set([...stylesheetSets.keys()].flatMap(sheets => sheets.split(' + '))) };
}

/** The entity pages' sheets: on request, no page in dist/ links them (their budgets are the static build's). */
const ENTITY_STYLES = ['src/styles/pages/vocab.scss', 'src/styles/pages/kanji.scss', 'src/styles/pages/grammar.scss'];

/**
 * Every page type's stylesheet (lib/server/assets.ts, PAGE_STYLES) is linked by a page measured
 * above, so the blocking stylesheet budget sums every set a page links, not only the measured
 * pages': a page type added without a page here fails, rather than going unchecked.
 */
function unmeasuredStylesheetProblems(manifest: Record<string, ViteManifestEntry>, sheets: Set<string>): string[] {
    return Object.entries(manifest)
        .filter(([source]) => /^src\/styles\/pages\/.+\.scss$/.test(source) && !(ENTITY_PAGES === 'on-request' && ENTITY_STYLES.includes(source)))
        .filter(([, entry]) => !sheets.has(entry.file))
        .map(([source, entry]) => `${source} (${entry.file}) is linked by no page check-build measures: its blocking stylesheets are not budgeted (add one of its pages to measure())`);
}

/** The build has the pages its mode says: every entity page prerendered, or none and the server built. */
function modeProblems(): string[] {
    const [words, kanji] = [wordPages().length + wordPages('zh-hans').length, kanjiPages().length];
    if (ENTITY_PAGES === 'prerendered') return words > 0 && kanji > 0 ? [] : [`prerendered build with ${words} word and ${kanji} kanji pages in dist/`];
    const problems = words + kanji > 0 ? [`on-request build with ${words} word and ${kanji} kanji pages in dist/: they are the server's`] : [];
    if (!fs.existsSync(path.join(APP_DIR, 'build', 'handler.js'))) problems.push('on-request build without its server (build/handler.js)');
    return problems;
}

/**
 * Problems other than sizes: a second web font, a Svelte runtime reaching the browser, or the
 * site's origin in a client script. No script reads the origin, so one that carries it is longer
 * on staging (a longer origin) than in CI, where its budget is measured: 1.67.0's detail script
 * passed CI and failed the staging deploy by 2 bytes.
 */
function assetProblems(): string[] {
    const problems: string[] = [];
    const assets = fs.readdirSync(path.join(DIST_DIR, 'assets'));
    const fonts = assets.filter(name => /\.(woff2?|ttf|otf)$/.test(name));
    if (fonts.length !== 1) problems.push(`expected one web font, found ${fonts.length}: ${fonts.join(', ')}`);
    for (const script of assets.filter(name => name.endsWith('.js'))) {
        const source = fs.readFileSync(path.join(DIST_DIR, 'assets', script), 'utf-8');
        // Every Svelte client runtime build links its error codes to svelte.dev/e/.
        if (source.includes('svelte.dev/e/')) problems.push(`assets/${script} contains the Svelte client runtime`);
        if (source.includes(SITE_ORIGIN)) problems.push(`assets/${script} contains the site origin (${SITE_ORIGIN}), so its size depends on the environment`);
    }
    return problems;
}

/** The romaji pages built (English's only, #278): their romaji. */
const romajiPageNames = () => (fs.existsSync(path.join(DIST_DIR, 'romaji')) ? subdirectories('romaji') : []);

/** Text's entities decoded as far as the shell and Svelte write them (documentShell.ts). */
const decodeEntities = (text: string) => text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** A page's meta description, its entities decoded. */
function descriptionOf(html: string): string {
    return decodeEntities(/<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '');
}

/** The words a word page's "Also read" line names (#278): each one's id, from its link, and the term after it. */
function alsoReadNamed(html: string): { id: string; term: string }[] {
    const line = (/<p class="meta entry-romaji-shared">(.*?)<\/p>/s.exec(html)?.[1] ?? '').replace(/<!--.*?-->/gs, '');
    return [...line.matchAll(/<a href="[^"]*\/vocab\/(\d+)\/" lang="ja">[^<]*<\/a>([^<]*)/g)].map(([, id = '', after = '']) => ({
        id,
        term: decodeEntities(after.replace(/, and [\d,]+ more$/, '').replace(/, $/, '').trim()),
    }));
}

/**
 * The romaji pages and the romaji on the word pages (#278): some romaji pages, never more than
 * ROMAJI_PAGE_CAP, each listing two words or more, all of them and only them in sitemap-romaji.xml;
 * and every English word page (prerendered) carrying its romaji in its reading line, before any other
 * reading, and in its description, its "Also read" line naming every word apart.
 */
function romajiProblems(): string[] {
    const problems: string[] = [];
    const names = romajiPageNames();
    if (names.length === 0) problems.push('no romaji page was built (dist/romaji/)');
    if (names.length > ROMAJI_PAGE_CAP) problems.push(`${names.length} romaji pages, over the cap of ${ROMAJI_PAGE_CAP} (lib/romaji.ts)`);
    for (const name of names) {
        const rows = read(pageOf('romaji', name)).toString('utf-8').match(/<li><a href="[^"]*\/vocab\/\d+\/"/g)?.length ?? 0;
        if (rows < 2) problems.push(`romaji/${name}/ lists ${rows} word${rows === 1 ? '' : 's'}: a romaji page is for a romaji two words share or more`);
    }
    const sitemap = fs.existsSync(path.join(DIST_DIR, 'sitemap-romaji.xml')) ? fs.readFileSync(path.join(DIST_DIR, 'sitemap-romaji.xml'), 'utf-8') : '';
    const listed = new Set([...sitemap.matchAll(/<loc>[^<]*\/romaji\/([^/<]+)\/<\/loc>/g)].map(([, name]) => name));
    if (listed.size !== names.length || names.some(name => !listed.has(name))) problems.push(`sitemap-romaji.xml lists ${listed.size} romaji pages, the build has ${names.length}`);

    if (ENTITY_PAGES === 'prerendered') {
        const rows = builtIndexFiles('en').flatMap(file => fromColumns(file.w));
        const readings = new Map(rows.map(row => [row[0], readingOfRow(row)]));
        const glosses = new Map(rows.map(row => [row[0], row[3]]));
        const missing: string[] = [];
        const misplaced: string[] = [];
        const alike: string[] = [];
        for (const id of wordPages()) {
            const reading = readings.get(id);
            if (reading === undefined) continue;
            const romaji = romajiOf(reading);
            const html = read(pageOf('vocab', id)).toString('utf-8');
            const inLine = html.includes(`<p class="entry-sub entry-romaji" lang="ja-Latn">${romaji.replace(/&/g, '&amp;')}</p>`);
            if (!inLine || !descriptionOf(html).includes(`, ${romaji})`)) missing.push(`vocab/${id}/ (${romaji}): ${inLine ? 'not in its description' : 'not in its reading line'}`);
            // The romaji is the primary reading's: nothing of the other readings (a .meta, "also ...")
            // before it on the header line, where 端 はし · also …、つま hashi read as つま's.
            else if (html.slice(html.indexOf('class="entry-line"'), html.indexOf('entry-romaji')).includes('class="meta"')) misplaced.push(`vocab/${id}/ (${romaji})`);
            // "Also read" tells the words it names apart (alsoReadTerms): none named by this word's
            // first gloss nor by another's term (取る to take, 撮る to take), unless their whole glosses
            // are one, when nothing in English parts them (差す and 射す, both "to shine").
            const named = alsoReadNamed(html);
            const own = { id, term: firstGloss(glosses.get(id)) };
            for (const word of named) {
                const twin = [own, ...named].find(other => other !== word && other.term === word.term && word.term !== '');
                if (twin && glosses.get(twin.id) !== glosses.get(word.id)) alike.push(`vocab/${id}/ names ${word.id} "${word.term}", as ${twin.id}`);
            }
        }
        problems.push(...missing.slice(0, 5).map(found => `a word page without its romaji: ${found}`));
        if (missing.length > 5) problems.push(`and ${missing.length - 5} more word pages without their romaji`);
        problems.push(...misplaced.slice(0, 5).map(found => `a word page with its romaji after its other readings, not its own: ${found}`));
        if (misplaced.length > 5) problems.push(`and ${misplaced.length - 5} more word pages with their romaji after their other readings`);
        problems.push(...alike.slice(0, 5).map(found => `an "Also read" line naming two words alike: ${found}`));
        if (alike.length > 5) problems.push(`and ${alike.length - 5} more "Also read" lines naming two words alike`);
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
    // A kanji by its character, meaning and readings, first among the kanji (#264).
    for (const query of ['水', 'water', 'みず', 'すい', 'スイ', 'sui', 'mizu']) {
        const kanji = search(index, query).kanji.map(row => row[0]);
        expect(kanji[0] === '水', `"${query}": the kanji 水 is not the first kanji (${kanji.slice(0, 3).join(', ')})`);
    }
    expect(search(index, '水').groups[0] === 'kanji', '"水": the kanji are not shown first');
    expect(headwords('mizu', 1)[0] === '水', `"mizu": the word 水 not first (${headwords('mizu', 3).join(', ')})`);
    // A grammar point by its title, its romaji with or without spaces, and words of its title in romaji.
    for (const query of ['てから', 'te kara', 'tekara']) {
        const grammar = search(index, query).grammar.map(row => row[1]);
        expect(grammar.some(title => title.includes('てから') && !title.includes('でない') && !title.includes('という')), `"${query}": the point てから is not among the results (${grammar.slice(0, 3).join(', ')})`);
    }
    const teForm = search(index, 'te form').grammar.map(row => row[1]);
    expect(teForm.some(title => title.includes('て-form')), `"te form": no て-form point among the results (${teForm.slice(0, 3).join(', ')})`);
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
    // Kanji are matched by their English meanings in every locale: the dataset has no other yet (#264).
    const water = search(index, 'water').kanji.map(row => row[0]);
    if (water[0] !== '水') problems.push(`"water" does not find the kanji 水 first in the ${locale} index (${water.slice(0, 3).join(', ')})`);
    return { problems: problems.slice(0, 10), pages: sample.map(row => links.vocabPath(row[0])) };
}

const localeSearches = SERVED_LOCALES.filter(locale => localePrefix(locale) !== '').map(localeSearchProblems);

const manifest = readJson(path.join('.vite', 'manifest.json')) as Record<string, ViteManifestEntry>;
const { measurements, sheets: measuredSheets } = measure(manifest);
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

const problems = [...over.map(m => `over budget: ${describe(m)}`), ...modeProblems(), ...unmeasuredStylesheetProblems(manifest, measuredSheets), ...assetProblems(), ...searchProblems(), ...localeSearches.flatMap(found => found.problems), ...sitemapProblems(), ...romajiProblems(), ...routingProblems(), ...linkProblems(), ...alternatesProblems(), ...sourceNameProblems(), ...(await unmatchedPathProblems())];

// A budget over many pages reports its heaviest.
const MANY_PAGES: Partial<Record<BudgetName, string>> = { jlptPage: 'JLPT list pages', kanjiOrderPage: 'kanji order pages' };
for (const m of measurements.filter(m => MANY_PAGES[m.budget] === undefined)) console.log(`[check-build] ${describe(m)}`);
for (const [budget, pages] of Object.entries(MANY_PAGES)) {
    const group = measurements.filter(m => m.budget === budget);
    console.log(`[check-build] ${describe(group.reduce((a, b) => (countedBytes(b) > countedBytes(a) ? b : a)))} (heaviest of ${group.length} ${pages})`);
}

if (problems.length > 0) {
    for (const problem of problems) console.error(`[check-build] ${problem}`);
    process.exit(1);
}
if (ENTITY_PAGES === 'on-request') console.log('[check-build] entity pages rendered on request: their budgets are measured on the static build (check:parity --against-server).');
console.log('[check-build] every budget met, no Svelte runtime, search acceptance queries pass.');
