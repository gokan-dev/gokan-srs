#!/usr/bin/env bun
// Build-time static site generator. Run via `bun run build` (chained after `vite build`, see
// package.json) or standalone via `bun run prerender` once dist/ already has a client build.
//
// Why this exists as a hand-rolled script instead of using SvelteKit or another SSR
// framework: the resolved decision on issue #19 was "build-time pre-rendering rather than a
// full SSR framework" - kept deliberately lightweight. Svelte's own server renderer
// (svelte/server's render()) only turns a component into an HTML *fragment*, not a full
// document, and normally you'd get to that fragment via a framework's routing/build
// integration. Here that wiring is done by hand: scripts/svelte-ssr-loader.ts registers a Bun
// runtime plugin that compiles .svelte files with svelte/compiler's `generate: 'server'` mode
// directly, completely independent of the Vite build. Vite's own `vite build` (run first, see
// package.json) has one job: produce the browser-facing assets this script links into the
// generated pages (the stylesheets and the two plain TypeScript scripts, vite.config.ts lists
// them as explicit inputs), resolved here via the client build's manifest.json rather than
// hardcoded filenames, since Vite content-hashes them. No page ever loads a Svelte runtime.
import './svelte-ssr-loader';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from 'svelte/server';
import type { Component } from 'svelte';

import {
    resolveCompiledDir,
    listVocabIds,
    loadVocab,
    loadKanjiList,
    loadKanjiVocabIndex,
    loadSentences,
    loadFrequencyIndex,
    listGrammarIds,
    loadGrammarPoint,
    loadVocabJlptIndex,
    loadGrammarTeachingOrder,
    loadGrammarContrasts,
    loadGrammarVariantGroups,
    loadGrammarConjugations,
    loadGrammarMinedExamples,
} from '../src/lib/dataset.server';
import { vocabSummaryFrom } from '../src/lib/vocabSummary';
import { UMAMI_WEBSITE_ID } from '../src/lib/site';
import {
    vocabMeta,
    kanjiMeta,
    grammarMeta,
    grammarIndexMeta,
    grammarFamiliesIndexMeta,
    kanjiIndexMeta,
    vocabIndexMeta,
    vocabJlptMeta,
    homeMeta,
    searchMeta,
    grammarChaptersIndexMeta,
    grammarChapterMeta,
    grammarFamilyMeta,
    grammarConjugationsIndexMeta,
    type PageMeta,
} from '../src/lib/seo';
import {
    vocabPath,
    kanjiPath,
    grammarPath,
    grammarIndexPath,
    grammarFamiliesIndexPath,
    kanjiIndexPath,
    vocabIndexPath,
    vocabJlptPath,
    homePath,
    searchPath,
    assetPath,
    grammarChaptersIndexPath,
    grammarChapterPath,
    grammarFamilyPath,
    grammarConjugationsIndexPath,
} from '../src/lib/urls';
import { japaneseWithoutLang, renderDocument } from '../src/lib/documentShell';
import { buildSitemapXml, buildRobotsTxt, shouldEmitRobotsTxt } from '../src/lib/sitemap';
import type { SearchWordRow, VocabSummary } from '../src/lib/types';
import { grammarSummaryOf, groupByLevel, inTeachingOrder } from '../src/lib/grammarBrowse';
import { buildChapterLocatorIndex, buildChapterIndexRows } from '../src/lib/grammarChapters';
import { buildFamilyPages } from '../src/lib/grammarFamilies';
import { buildVariantSiblings } from '../src/lib/grammarVariants';
import { conjugationTables } from '../src/lib/grammarConjugations';
import { orderSentences } from '../src/lib/sentenceOrder';
import { searchGrammarRow, searchKanjiRow, searchWordRow, splitSearchIndex } from '../src/lib/searchIndex';
import { paginate, JLPT_PAGE_SIZE } from '../src/lib/pagination';
import { headwordOf, JLPT_LEVELS } from '@gokan/dataset-schema';
import type { GrammarPoint, Kanji, Vocabulary } from '@gokan/dataset-schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(APP_ROOT, 'dist');

// Pools go up to 60 sentences across 477 points (see gokan-dataset's Corpus-mined sentences
// note): capped here to bound page size.
const MAX_MINED_EXAMPLES = 25;
/** Common N5 words on the home page. */
const FEATURED_WORDS = 12;

interface ViteManifestEntry {
    file: string;
}

function readClientManifest(): Record<string, ViteManifestEntry> {
    const manifestPath = path.join(DIST_DIR, '.vite', 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`[prerender] ${manifestPath} not found - run "vite build" before prerendering.`);
    }
    const manifest: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return manifest as Record<string, ViteManifestEntry>;
}

/** Resolves related-vocab ids to summaries, tracking (without spamming) any that don't resolve. */
function resolveSummaries(ids: string[], summaryById: Map<string, VocabSummary>, missing: Set<string>): VocabSummary[] {
    const resolved: VocabSummary[] = [];
    for (const id of ids) {
        const summary = summaryById.get(id);
        if (summary) {
            resolved.push(summary);
        } else {
            missing.add(id);
        }
    }
    return resolved;
}

function bodyOf<Props extends Record<string, unknown>>(component: Component<Props>, props: Props): string {
    return render(component, { props }).body;
}

async function main(): Promise<void> {
    const startedAt = Date.now();

    const compiledDir = resolveCompiledDir();
    const manifest = readClientManifest();
    const asset = (entry: string) => assetPath(manifest[entry].file);
    // assetPath, not a bare '/' + file: in subfolder mode every href on the page has to carry
    // BASE_PATH, and a stylesheet 404 is the one breakage that still renders a plausible-looking
    // (unstyled) page rather than failing loudly.
    const stylesheetHref = asset('src/styles/app.scss');
    // One stylesheet per page type, so a rule change on one page does not alter the bytes of
    // every other page (which would re-upload the whole site). Pages built purely from shared
    // rules pass nothing.
    const pageStyles = {
        home: asset('src/styles/pages/home.scss'),
        vocab: asset('src/styles/pages/vocab.scss'),
        kanji: asset('src/styles/pages/kanji.scss'),
        kanjiIndex: asset('src/styles/pages/kanji-index.scss'),
        grammar: asset('src/styles/pages/grammar.scss'),
        grammarIndex: asset('src/styles/pages/grammar-index.scss'),
        grammarChapters: asset('src/styles/pages/grammar-chapters.scss'),
        grammarFamily: asset('src/styles/pages/grammar-family.scss'),
        grammarConjugations: asset('src/styles/pages/grammar-conjugations.scss'),
    };
    const searchScriptHref = asset('src/client/search.ts');
    const grammarFilterScriptHref = asset('src/client/grammarFilter.ts');

    const sitemapPaths: string[] = [];
    const missingLang: string[] = [];

    /**
     * Wraps a rendered body in the document shell and writes it to dist/<segments>/index.html,
     * listing `canonicalPath` in the sitemap unless the page is noindex. Every page links the
     * search script: the header's search field and the furigana toggle live there.
     */
    function writePage(
        segments: string[],
        canonicalPath: string,
        body: string,
        meta: PageMeta,
        options: { pageStylesheetHref?: string; extraScriptHref?: string; structuredData?: object; noindex?: boolean } = {},
    ): void {
        const html = renderDocument({
            title: meta.title,
            description: meta.description,
            canonicalPath,
            bodyHtml: body,
            stylesheetHref,
            scriptHref: searchScriptHref,
            analyticsWebsiteId: UMAMI_WEBSITE_ID,
            ...options,
        });
        const unmarked = japaneseWithoutLang(html);
        if (unmarked.length > 0) missingLang.push(`${canonicalPath}: ${unmarked[0]}`);

        const dir = path.join(DIST_DIR, ...segments);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), html);
        if (!options.noindex) sitemapPaths.push(canonicalPath);
    }

    // Dynamic imports so scripts/svelte-ssr-loader.ts (imported above for its side effect) has
    // already registered before these .svelte files are compiled - see that file's comment.
    const { default: HomePage } = await import('../src/pages/HomePage.svelte');
    const { default: VocabPage } = await import('../src/pages/VocabPage.svelte');
    const { default: KanjiPage } = await import('../src/pages/KanjiPage.svelte');
    const { default: GrammarPage } = await import('../src/pages/GrammarPage.svelte');
    const { default: GrammarIndexPage } = await import('../src/pages/GrammarIndexPage.svelte');
    const { default: GrammarFamiliesIndexPage } = await import('../src/pages/GrammarFamiliesIndexPage.svelte');
    const { default: GrammarChaptersIndexPage } = await import('../src/pages/GrammarChaptersIndexPage.svelte');
    const { default: GrammarChapterPage } = await import('../src/pages/GrammarChapterPage.svelte');
    const { default: GrammarFamilyPage } = await import('../src/pages/GrammarFamilyPage.svelte');
    const { default: GrammarConjugationsIndexPage } = await import('../src/pages/GrammarConjugationsIndexPage.svelte');
    const { default: KanjiIndexPage } = await import('../src/pages/KanjiIndexPage.svelte');
    const { default: VocabIndexPage } = await import('../src/pages/VocabIndexPage.svelte');
    const { default: VocabJlptPage } = await import('../src/pages/VocabJlptPage.svelte');
    const { default: SearchPage } = await import('../src/pages/SearchPage.svelte');

    console.log('[prerender] loading dataset indexes...');
    const vocabIds = listVocabIds(compiledDir);
    const kanjiList = loadKanjiList(compiledDir);
    const kanjiVocabIndex = loadKanjiVocabIndex(compiledDir);
    const vocabJlptIndex = loadVocabJlptIndex(compiledDir);
    const frequencyIndex = loadFrequencyIndex(compiledDir);

    // Built as a separate pass (rather than caching full Vocabulary objects while writing
    // pages below) so memory stays bounded to ~36k small summaries and search rows instead of
    // ~36k full parsed vocab files at once.
    console.log(`[prerender] indexing ${vocabIds.length} vocab summaries...`);
    const summaryById = new Map<string, VocabSummary>();
    const searchRowById = new Map<string, SearchWordRow>();
    for (const id of vocabIds) {
        const vocab = loadVocab(compiledDir, id);
        summaryById.set(id, vocabSummaryFrom(vocab));
        searchRowById.set(id, searchWordRow(vocab));
    }

    let sentenceCount = 0;
    const missingRelatedIds = new Set<string>();

    console.log(`[prerender] writing ${vocabIds.length} vocab pages...`);
    for (const id of vocabIds) {
        const vocab: Vocabulary = loadVocab(compiledDir, id);
        const components = resolveSummaries(vocab.components ?? [], summaryById, missingRelatedIds);
        const parents = resolveSummaries(vocab.parents ?? [], summaryById, missingRelatedIds);
        const allSentences = loadSentences(compiledDir, id) ?? [];
        sentenceCount += allSentences.length;
        const sentences = orderSentences(allSentences, id, headwordOf(vocab));

        const meta = vocabMeta(vocab);
        writePage(['vocab', id], vocabPath(id), bodyOf(VocabPage, { vocab, components, parents, sentences }), meta, {
            pageStylesheetHref: pageStyles.vocab,
            structuredData: {
                '@context': 'https://schema.org',
                '@type': 'DefinedTerm',
                name: headwordOf(vocab),
                description: meta.description,
            },
        });
    }

    if (missingRelatedIds.size > 0) {
        console.warn(`[prerender] ${missingRelatedIds.size} components/parents referenced ids with no vocab file (skipped in output, not fatal).`);
    }

    console.log(`[prerender] writing ${kanjiList.length} kanji pages...`);
    const kanjiWithPages: ReadonlySet<string> = new Set(kanjiList.map(kanji => kanji.character));
    for (const kanji of kanjiList) {
        // Every word, most frequent first (the index's order); the page collapses all but the first.
        const words = resolveSummaries(kanjiVocabIndex[kanji.character] ?? [], summaryById, missingRelatedIds);
        // Written under the raw character, NOT percent-encoded, unlike kanjiPath()'s URL
        // string: static hosts decode the request URL's percent-escapes before resolving a
        // file on disk, so the on-disk name must be the literal UTF-8 character to match what
        // a browser actually requests when it navigates to kanjiPath()'s href.
        writePage(['kanji', kanji.character], kanjiPath(kanji.character), bodyOf(KanjiPage, { kanji, words, kanjiWithPages }), kanjiMeta(kanji, words.length), {
            pageStylesheetHref: pageStyles.kanji,
        });
    }

    // -- Grammar --------------------------------------------------------------
    // Loaded in full up front (766 points, small files) rather than streamed like vocab: the
    // family/related-points list on each page needs OTHER points' titles, so a second lookup
    // pass would just re-read the same files.
    const grammarIds = listGrammarIds(compiledDir);
    console.log(`[prerender] writing ${grammarIds.length} grammar pages...`);
    const grammarPoints = new Map<string, GrammarPoint>();
    for (const id of grammarIds) {
        grammarPoints.set(id, loadGrammarPoint(compiledDir, id));
    }

    // The authored teaching order (chapters), the family "when to use each" lessons, the
    // realization-variant groups, and the inflection points' conjugation drill tables.
    const teachingOrder = loadGrammarTeachingOrder(compiledDir);
    const contrasts = loadGrammarContrasts(compiledDir);
    const variantGroups = loadGrammarVariantGroups(compiledDir);
    const conjugationIndex = loadGrammarConjugations(compiledDir);
    const chapterLocatorIndex = buildChapterLocatorIndex(teachingOrder);

    for (const [id, point] of grammarPoints) {
        const related = (point.family?.relatedPoints ?? [])
            .map(relatedId => grammarPoints.get(relatedId))
            .filter((other): other is GrammarPoint => Boolean(other))
            .map(grammarSummaryOf);
        const minedExamplesPool = loadGrammarMinedExamples(compiledDir, id) ?? [];

        const body = bodyOf(GrammarPage, {
            point,
            related,
            chapterLocator: chapterLocatorIndex.get(id) ?? null,
            variants: buildVariantSiblings(point, variantGroups, grammarPoints),
            conjugation: conjugationIndex[id] ?? null,
            minedExamples: minedExamplesPool.slice(0, MAX_MINED_EXAMPLES),
            minedExamplesTotalCount: minedExamplesPool.length,
        });
        writePage(['grammar', id], grammarPath(id), body, grammarMeta(point), {
            pageStylesheetHref: pageStyles.grammar,
            structuredData: {
                '@context': 'https://schema.org',
                '@type': 'DefinedTerm',
                name: point.title,
                description: point.shortExplanation,
                inDefinedTermSet: 'Japanese grammar',
            },
        });
    }

    console.log('[prerender] writing grammar index pages...');
    // Every point grouped by level, in the order the curriculum teaches it: each grammar page
    // sits at crawl depth 2. The filter (client/grammarFilter.ts) works over these rows.
    const pointsInOrder = inTeachingOrder([...grammarPoints.values()], teachingOrder.order);
    writePage(
        ['grammar'],
        grammarIndexPath(),
        bodyOf(GrammarIndexPage, { groups: groupByLevel(pointsInOrder.map(grammarSummaryOf)), total: grammarPoints.size }),
        grammarIndexMeta(grammarPoints.size),
        { pageStylesheetHref: pageStyles.grammarIndex, extraScriptHref: grammarFilterScriptHref },
    );

    // One page per near-synonym family, comparing its members: a strong "X vs Y grammar" search
    // target no single point's own page can be. The families index lists them all.
    const familyPages = buildFamilyPages([...grammarPoints.values()], contrasts);
    writePage(
        ['grammar', 'families'],
        grammarFamiliesIndexPath(),
        bodyOf(GrammarFamiliesIndexPage, { families: familyPages }),
        grammarFamiliesIndexMeta(familyPages.length),
        { pageStylesheetHref: pageStyles.grammarFamily },
    );
    for (const family of familyPages) {
        writePage(['grammar', 'family', family.id], grammarFamilyPath(family.id), bodyOf(GrammarFamilyPage, { family }), grammarFamilyMeta(family.name, family.members.length), {
            pageStylesheetHref: pageStyles.grammarFamily,
        });
    }

    // The authored teaching order as its own browsable curriculum: "what order will I meet these in".
    const chapterRows = buildChapterIndexRows(teachingOrder, grammarPoints);
    console.log(`[prerender] writing ${chapterRows.length} grammar chapter pages...`);
    writePage(
        ['grammar', 'chapters'],
        grammarChaptersIndexPath(),
        bodyOf(GrammarChaptersIndexPage, { groups: groupByLevel(chapterRows), chapterCount: chapterRows.length }),
        grammarChaptersIndexMeta(chapterRows.length, teachingOrder.order.length),
        { pageStylesheetHref: pageStyles.grammarChapters },
    );
    chapterRows.forEach((chapter, index) => {
        const previous = chapterRows[index - 1] ?? null;
        const next = chapterRows[index + 1] ?? null;
        const body = bodyOf(GrammarChapterPage, {
            chapter,
            totalChapters: chapterRows.length,
            previous: previous ? { id: previous.id, title: previous.title } : null,
            next: next ? { id: next.id, title: next.title } : null,
        });
        writePage(['grammar', 'chapters', chapter.id], grammarChapterPath(chapter.id), body, grammarChapterMeta(teachingOrder.chapters[index]), {
            pageStylesheetHref: pageStyles.grammarChapters,
        });
    });

    // The inflection points as one reference table per word type, so "Japanese potential form"
    // has a landing page without the reader knowing which point to look for.
    const tables = conjugationTables(conjugationIndex, grammarPoints);
    const formCount = Object.keys(conjugationIndex).length;
    writePage(
        ['grammar', 'conjugations'],
        grammarConjugationsIndexPath(),
        bodyOf(GrammarConjugationsIndexPage, { tables, formCount }),
        grammarConjugationsIndexMeta(new Set(Object.values(conjugationIndex).map(entry => entry.form)).size, formCount),
        { pageStylesheetHref: pageStyles.grammarConjugations },
    );

    // -- Browse indexes -------------------------------------------------------
    // These exist so every page type has a depth-1 or depth-2 path from the site root.
    console.log('[prerender] writing kanji index...');
    const kanjiGroups: { level: number | null; kanji: Kanji[] }[] = [
        ...JLPT_LEVELS.map(level => ({ level, kanji: kanjiList.filter(kanji => kanji.steps.jlpt === level) })),
        { level: null, kanji: kanjiList.filter(kanji => kanji.steps.jlpt === undefined) },
    ].filter(group => group.kanji.length > 0);
    writePage(['kanji'], kanjiIndexPath(), bodyOf(KanjiIndexPage, { groups: kanjiGroups }), kanjiIndexMeta(kanjiList.length), {
        pageStylesheetHref: pageStyles.kanjiIndex,
    });

    console.log('[prerender] writing vocabulary browse pages...');
    const jlptLevelWords = JLPT_LEVELS.map(level => ({
        level,
        // The index carries only {id, containedKanji}, frequency-ordered; the display fields come
        // from the summary map built above. An id with no summary is dropped rather than rendered blank.
        words: (vocabJlptIndex[level] ?? [])
            .map(entry => summaryById.get(entry.id))
            .filter((summary): summary is VocabSummary => Boolean(summary)),
    })).filter(group => group.words.length > 0);
    const availableLevels = jlptLevelWords.map(group => group.level);

    let jlptPageCount = 0;
    for (const { level, words } of jlptLevelWords) {
        // Split so no list page is too heavy for a phone (N1 is ~2,800 words).
        const pages = paginate(words, JLPT_PAGE_SIZE);
        pages.forEach((pageWords, index) => {
            const page = index + 1;
            const body = bodyOf(VocabJlptPage, {
                level,
                words: pageWords,
                total: words.length,
                page,
                pageCount: pages.length,
                firstRank: index * JLPT_PAGE_SIZE + 1,
                allLevels: availableLevels,
            });
            const segments = ['vocab', `jlpt-n${level}`, ...(page > 1 ? [String(page)] : [])];
            writePage(segments, vocabJlptPath(level, page), body, vocabJlptMeta(level, words.length, page));
            jlptPageCount += 1;
        });
    }

    writePage(
        ['vocab'],
        vocabIndexPath(),
        bodyOf(VocabIndexPage, { levels: jlptLevelWords.map(({ level, words }) => ({ level, count: words.length })), totalCount: vocabIds.length }),
        vocabIndexMeta(vocabIds.length),
    );

    writePage(['search'], searchPath(), bodyOf(SearchPage, {}), searchMeta(), { noindex: true });

    console.log('[prerender] writing home page...');
    const homeBody = bodyOf(HomePage, {
        vocabCount: vocabIds.length,
        kanjiCount: kanjiList.length,
        grammarCount: grammarPoints.size,
        sentenceCount,
        // The most frequent N5 words: the index is frequency-ordered, so the head of the
        // easiest level is the closest thing the dataset has to "words a visitor will know".
        featured: (jlptLevelWords.find(group => group.level === 5)?.words ?? []).slice(0, FEATURED_WORDS),
    });
    // The home page is dist/index.html itself: writePage writes there from an empty segment list.
    writePage([], homePath(), homeBody, homeMeta(), { pageStylesheetHref: pageStyles.home });

    if (missingLang.length > 0) {
        throw new Error(`[prerender] ${missingLang.length} page(s) have Japanese text not marked lang="ja", e.g.\n${missingLang.slice(0, 5).join('\n')}`);
    }

    console.log('[prerender] writing search index, sitemap.xml, and robots.txt...');
    // Frequency order is the ranking's last tie-break: a row's position is its rank.
    const wordRows = frequencyIndex
        .map(entry => searchRowById.get(entry.id))
        .filter((row): row is SearchWordRow => Boolean(row));
    const { core, full } = splitSearchIndex(
        wordRows,
        kanjiList.map(searchKanjiRow),
        pointsInOrder.map(searchGrammarRow),
    );
    fs.mkdirSync(path.join(DIST_DIR, 'data'), { recursive: true });
    fs.writeFileSync(path.join(DIST_DIR, 'data', 'search-core.json'), JSON.stringify(core));
    fs.writeFileSync(path.join(DIST_DIR, 'data', 'search-full.json'), JSON.stringify(full));
    // The home page first, as before: it is written last only because it counts the sentences.
    fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), buildSitemapXml([homePath(), ...sitemapPaths.filter(p => p !== homePath())]));
    if (shouldEmitRobotsTxt()) {
        fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), buildRobotsTxt());
    } else {
        // Subfolder mode: gokan-srs's public/robots.txt is the authoritative one for this host
        // and already carries our Sitemap: line. See shouldEmitRobotsTxt().
        console.log('[prerender] skipping robots.txt (subfolder deploy - gokan-srs owns the host root).');
    }

    const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
        `[prerender] done: ${vocabIds.length} vocab pages, ${kanjiList.length} kanji pages, ` +
        `${grammarPoints.size} grammar pages, ${chapterRows.length} grammar chapter pages, ` +
        `${familyPages.length} grammar family pages, ${jlptPageCount} JLPT list pages, ` +
        `${sitemapPaths.length} sitemap URLs in ${elapsedSeconds}s.`,
    );
}

await main();
