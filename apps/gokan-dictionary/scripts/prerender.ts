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
// directly (verified against Svelte 5.56's actual compiler/server-runtime API before writing
// this), completely independent of the Vite build. Vite's own `vite build` (run first, see
// package.json) has one job: produce the two browser-facing assets this script links into
// every generated page - the global stylesheet and the search script (vite.config.ts lists
// them as explicit rollup inputs) - resolved here via the client build's manifest.json rather
// than hardcoded filenames, since Vite content-hashes them.
import './svelte-ssr-loader';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from 'svelte/server';

import {
    resolveCompiledDir,
    listVocabIds,
    loadVocab,
    loadKanjiList,
    loadKanjiVocabIndex,
    loadSentences,
    loadSearchIndex,
    listGrammarIds,
    loadGrammarPoint,
    loadVocabJlptIndex,
    loadGrammarTeachingOrder,
    loadGrammarContrasts,
    loadGrammarVariantGroups,
    loadGrammarConjugations,
} from '../src/lib/dataset.server';
import { vocabSummaryFrom } from '../src/lib/vocabSummary';
import {
    vocabMeta,
    kanjiMeta,
    grammarMeta,
    grammarIndexMeta,
    kanjiIndexMeta,
    vocabIndexMeta,
    vocabJlptMeta,
    homeMeta,
    grammarChaptersIndexMeta,
    grammarChapterMeta,
    grammarFamilyMeta,
    grammarConjugationsIndexMeta,
} from '../src/lib/seo';
import {
    vocabPath,
    kanjiPath,
    grammarPath,
    grammarIndexPath,
    kanjiIndexPath,
    vocabIndexPath,
    vocabJlptPath,
    homePath,
    assetPath,
    grammarChaptersIndexPath,
    grammarChapterPath,
    grammarFamilyPath,
    grammarConjugationsIndexPath,
} from '../src/lib/urls';
import { renderDocument } from '../src/lib/documentShell';
import { buildSitemapXml, buildRobotsTxt, shouldEmitRobotsTxt } from '../src/lib/sitemap';
import type { GrammarSummary, VocabSummary } from '../src/lib/types';
import { toBrowseRow, groupRows } from '../src/lib/grammarBrowse';
import { buildChapterLocatorIndex, buildChapterIndexRows } from '../src/lib/grammarChapters';
import { buildFamilyPages } from '../src/lib/grammarFamilies';
import { buildVariantSiblings } from '../src/lib/grammarVariants';
import { groupConjugationsByForm } from '../src/lib/grammarConjugations';
import type { Vocabulary } from '../src/models/vocabulary.model';
import type { GrammarPoint } from '../src/models/grammar.model';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(APP_ROOT, 'dist');

const MAX_KANJI_VOCAB_LIST = 50;
const MAX_SENTENCES = 3;

interface ViteManifestEntry {
    file: string;
}

function readClientManifest(): Record<string, ViteManifestEntry> {
    const manifestPath = path.join(DIST_DIR, '.vite', 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`[prerender] ${manifestPath} not found - run "vite build" before prerendering.`);
    }
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

function writePage(distRelSegments: string[], html: string): void {
    const dir = path.join(DIST_DIR, ...distRelSegments);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
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

async function main(): Promise<void> {
    const startedAt = Date.now();

    const compiledDir = resolveCompiledDir();
    const manifest = readClientManifest();
    // assetPath, not a bare '/' + file: in subfolder mode every href on the page has to carry
    // BASE_PATH, and a stylesheet 404 is the one breakage that still renders a plausible-looking
    // (unstyled) page rather than failing loudly.
    const stylesheetHref = assetPath(manifest['src/styles/app.scss'].file);
    // One stylesheet per page type, so a rule change on one page does not alter the bytes of
    // every other page (which would re-upload the whole site - see CLAUDE.md's Deployment
    // section). Pages built purely from shared rules pass nothing.
    const pageStyles = {
        home: assetPath(manifest['src/styles/pages/home.scss'].file),
        vocab: assetPath(manifest['src/styles/pages/vocab.scss'].file),
        kanji: assetPath(manifest['src/styles/pages/kanji.scss'].file),
        kanjiIndex: assetPath(manifest['src/styles/pages/kanji-index.scss'].file),
        grammar: assetPath(manifest['src/styles/pages/grammar.scss'].file),
        grammarIndex: assetPath(manifest['src/styles/pages/grammar-index.scss'].file),
        grammarChapters: assetPath(manifest['src/styles/pages/grammar-chapters.scss'].file),
        grammarFamily: assetPath(manifest['src/styles/pages/grammar-family.scss'].file),
        grammarConjugations: assetPath(manifest['src/styles/pages/grammar-conjugations.scss'].file),
    };
    const searchScriptHref = assetPath(manifest['src/client/search.ts'].file);
    const grammarBrowserScriptHref = assetPath(manifest['src/client/grammarBrowser.ts'].file);

    // Dynamic imports so scripts/svelte-ssr-loader.ts (imported above for its side effect) has
    // already registered before these .svelte files are compiled - see that file's comment.
    const { default: HomePage } = await import('../src/pages/HomePage.svelte');
    const { default: VocabPage } = await import('../src/pages/VocabPage.svelte');
    const { default: KanjiPage } = await import('../src/pages/KanjiPage.svelte');
    const { default: GrammarPage } = await import('../src/pages/GrammarPage.svelte');
    const { default: GrammarIndexPage } = await import('../src/pages/GrammarIndexPage.svelte');
    const { default: GrammarChaptersIndexPage } = await import('../src/pages/GrammarChaptersIndexPage.svelte');
    const { default: GrammarChapterPage } = await import('../src/pages/GrammarChapterPage.svelte');
    const { default: GrammarFamilyPage } = await import('../src/pages/GrammarFamilyPage.svelte');
    const { default: GrammarConjugationsIndexPage } = await import('../src/pages/GrammarConjugationsIndexPage.svelte');
    const { default: KanjiIndexPage } = await import('../src/pages/KanjiIndexPage.svelte');
    const { default: VocabIndexPage } = await import('../src/pages/VocabIndexPage.svelte');
    const { default: VocabJlptPage } = await import('../src/pages/VocabJlptPage.svelte');

    console.log('[prerender] loading dataset indexes...');
    const vocabIds = listVocabIds(compiledDir);
    const kanjiList = loadKanjiList(compiledDir);
    const kanjiVocabIndex = loadKanjiVocabIndex(compiledDir);
    const searchIndex = loadSearchIndex(compiledDir);
    const vocabJlptIndex = loadVocabJlptIndex(compiledDir);

    // Built as a separate pass (rather than caching full Vocabulary objects while writing
    // pages below) so memory stays bounded to ~36k small {id, kanji, reading, gloss} records
    // instead of ~36k full parsed vocab files at once.
    console.log(`[prerender] indexing ${vocabIds.length} vocab summaries...`);
    const summaryById = new Map<string, VocabSummary>();
    for (const id of vocabIds) {
        summaryById.set(id, vocabSummaryFrom(loadVocab(compiledDir, id)));
    }

    const grammarIds = listGrammarIds(compiledDir);

    let sentenceCount = 0;
    const missingRelatedIds = new Set<string>();
    const sitemapPaths: string[] = [homePath()];

    console.log(`[prerender] writing ${vocabIds.length} vocab pages...`);
    for (const id of vocabIds) {
        const vocab: Vocabulary = loadVocab(compiledDir, id);
        const components = resolveSummaries(vocab.components ?? [], summaryById, missingRelatedIds);
        const parents = resolveSummaries(vocab.parents ?? [], summaryById, missingRelatedIds);
        const allSentences = loadSentences(compiledDir, id) ?? [];
        sentenceCount += allSentences.length;
        const sentences = allSentences.slice(0, MAX_SENTENCES);

        const { body } = render(VocabPage, { props: { vocab, components, parents, sentences } });
        const meta = vocabMeta(vocab);
        const html = renderDocument({
            title: meta.title,
            description: meta.description,
            canonicalPath: vocabPath(id),
            bodyHtml: body,
            stylesheetHref,
            pageStylesheetHref: pageStyles.vocab,
            scriptHref: searchScriptHref,
            structuredData: {
                '@context': 'https://schema.org',
                '@type': 'DefinedTerm',
                name: vocab.writtenForm.kanji,
                description: meta.description,
            },
        });
        writePage(['vocab', id], html);
        sitemapPaths.push(vocabPath(id));
    }

    if (missingRelatedIds.size > 0) {
        console.warn(`[prerender] ${missingRelatedIds.size} components/parents referenced ids with no vocab file (skipped in output, not fatal).`);
    }

    console.log(`[prerender] writing ${kanjiList.length} kanji pages...`);
    for (const kanji of kanjiList) {
        const vocabIdsForKanji = kanjiVocabIndex[kanji.character] ?? [];
        const vocabList = vocabIdsForKanji
            .slice(0, MAX_KANJI_VOCAB_LIST)
            .map(id => summaryById.get(id))
            .filter((summary): summary is VocabSummary => Boolean(summary));

        const { body } = render(KanjiPage, {
            props: { kanji, vocabList, vocabTotalCount: vocabIdsForKanji.length },
        });
        const meta = kanjiMeta(kanji, vocabIdsForKanji.length);
        const html = renderDocument({
            title: meta.title,
            description: meta.description,
            canonicalPath: kanjiPath(kanji.character),
            bodyHtml: body,
            stylesheetHref,
            pageStylesheetHref: pageStyles.kanji,
            scriptHref: searchScriptHref,
        });
        // Written under the raw character, NOT percent-encoded, unlike kanjiPath()'s URL
        // string: static hosts decode the request URL's percent-escapes before resolving a
        // file on disk, so the on-disk name must be the literal UTF-8 character to match what
        // a browser actually requests when it navigates to kanjiPath()'s href.
        writePage(['kanji', kanji.character], html);
        sitemapPaths.push(kanjiPath(kanji.character));
    }


    // -- Grammar --------------------------------------------------------------
    // Loaded in full up front (755 points, small files) rather than streamed like vocab: the
    // family/related-points list on each page needs OTHER points' titles, so a second lookup
    // pass would just re-read the same files.
    console.log(`[prerender] writing ${grammarIds.length} grammar pages...`);
    const grammarPoints = new Map<string, GrammarPoint>();
    for (const id of grammarIds) {
        grammarPoints.set(id, loadGrammarPoint(compiledDir, id));
    }

    const grammarSummaryOf = (point: GrammarPoint): GrammarSummary => ({
        id: point.id,
        title: point.title,
        jlptLevel: point.jlptLevel,
    });

    // The four pieces of the grammar system this app didn't surface before issue #58: the
    // authored teaching order (chapters), the family "when to use each" lessons, the
    // realization-variant groups, and the inflection points' conjugation drill tables. Loaded
    // once, up front, alongside the point files already loaded above.
    const teachingOrder = loadGrammarTeachingOrder(compiledDir);
    const contrasts = loadGrammarContrasts(compiledDir);
    const variantGroups = loadGrammarVariantGroups(compiledDir);
    const conjugationIndex = loadGrammarConjugations(compiledDir);
    const chapterLocatorIndex = buildChapterLocatorIndex(teachingOrder);

    for (const id of grammarIds) {
        const point = grammarPoints.get(id)!;
        const related = (point.family?.relatedPoints ?? [])
            .map(relatedId => grammarPoints.get(relatedId))
            .filter((other): other is GrammarPoint => Boolean(other))
            .map(grammarSummaryOf);
        const chapterLocator = chapterLocatorIndex.get(id) ?? null;
        const variants = buildVariantSiblings(point, variantGroups, grammarPoints);
        const conjugation = conjugationIndex[id] ?? null;

        const { body } = render(GrammarPage, { props: { point, related, chapterLocator, variants, conjugation } });
        const meta = grammarMeta(point);
        const html = renderDocument({
            title: meta.title,
            description: meta.description,
            canonicalPath: grammarPath(id),
            bodyHtml: body,
            stylesheetHref,
            pageStylesheetHref: pageStyles.grammar,
            scriptHref: searchScriptHref,
            structuredData: {
                '@context': 'https://schema.org',
                '@type': 'DefinedTerm',
                name: point.title,
                description: point.shortExplanation,
                inDefinedTermSet: 'Japanese grammar',
            },
        });
        writePage(['grammar', id], html);
        sitemapPaths.push(grammarPath(id));
    }

    console.log('[prerender] writing grammar index page...');
    const browseRows = grammarIds.map(id => toBrowseRow(grammarPoints.get(id)!));
    const grammarStaticGroups = groupRows(browseRows, 'family');

    const { body: grammarIndexBody } = render(GrammarIndexPage, {
        props: { groups: grammarStaticGroups, total: browseRows.length },
    });
    const grammarIndexMetaValue = grammarIndexMeta(grammarIds.length);
    writePage(['grammar'], renderDocument({
        title: grammarIndexMetaValue.title,
        description: grammarIndexMetaValue.description,
        canonicalPath: grammarIndexPath(),
        bodyHtml: grammarIndexBody,
        stylesheetHref,
        pageStylesheetHref: pageStyles.grammarIndex,
        scriptHref: searchScriptHref,
        // The only page carrying a second script: the interactive browser mounts over the
        // static list this page also renders.
        extraScriptHref: grammarBrowserScriptHref,
    }));
    sitemapPaths.push(grammarIndexPath());

    // -- Grammar curriculum (chapters), issue #58 ------------------------------
    // The authored teaching order as its own browsable curriculum, distinct from the grammar
    // index's level/family grouping: this answers "what order will I actually meet these in",
    // a strong "JLPT grammar curriculum/order" search target in its own right.
    console.log(`[prerender] writing ${teachingOrder.chapters.length} grammar chapter pages...`);
    const chapterRows = buildChapterIndexRows(teachingOrder, grammarPoints);

    const { body: chaptersIndexBody } = render(GrammarChaptersIndexPage, { props: { chapters: chapterRows } });
    const chaptersIndexMetaValue = grammarChaptersIndexMeta(chapterRows.length, teachingOrder.order.length);
    writePage(['grammar', 'chapters'], renderDocument({
        title: chaptersIndexMetaValue.title,
        description: chaptersIndexMetaValue.description,
        canonicalPath: grammarChaptersIndexPath(),
        bodyHtml: chaptersIndexBody,
        stylesheetHref,
        pageStylesheetHref: pageStyles.grammarChapters,
        scriptHref: searchScriptHref,
    }));
    sitemapPaths.push(grammarChaptersIndexPath());

    chapterRows.forEach((chapter, index) => {
        const previous = chapterRows[index - 1] ?? null;
        const next = chapterRows[index + 1] ?? null;
        const { body } = render(GrammarChapterPage, {
            props: {
                chapter,
                totalChapters: chapterRows.length,
                previous: previous ? { id: previous.id, title: previous.title } : null,
                next: next ? { id: next.id, title: next.title } : null,
            },
        });
        const meta = grammarChapterMeta(teachingOrder.chapters[index]);
        writePage(['grammar', 'chapters', chapter.id], renderDocument({
            title: meta.title,
            description: meta.description,
            canonicalPath: grammarChapterPath(chapter.id),
            bodyHtml: body,
            stylesheetHref,
            pageStylesheetHref: pageStyles.grammarChapters,
            scriptHref: searchScriptHref,
        }));
        sitemapPaths.push(grammarChapterPath(chapter.id));
    });

    // -- Grammar families (contrast lessons + variant comparison), issue #58 ---
    // One page per near-synonym family, comparing its members side by side - the family
    // "when to use each" lessons the SRS's own GrammarFamilyScreen surfaces, made public and
    // crawlable. A strong "X vs Y grammar" search target that no single point's own page can be
    // (でも vs しかし vs けれど is a question about three pages, not one).
    console.log('[prerender] writing grammar family pages...');
    const familyPages = buildFamilyPages([...grammarPoints.values()], contrasts);

    for (const family of familyPages) {
        const { body } = render(GrammarFamilyPage, { props: { family } });
        const meta = grammarFamilyMeta(family.name, family.members.length);
        writePage(['grammar', 'family', family.id], renderDocument({
            title: meta.title,
            description: meta.description,
            canonicalPath: grammarFamilyPath(family.id),
            bodyHtml: body,
            stylesheetHref,
            pageStylesheetHref: pageStyles.grammarFamily,
            scriptHref: searchScriptHref,
        }));
        sitemapPaths.push(grammarFamilyPath(family.id));
    }

    // -- Grammar conjugation reference, issue #58 ------------------------------
    // The 40 inflection points' own pages already carry their conjugation table (added above);
    // this index groups them by form so "Japanese potential form conjugation" has a single
    // strong landing page rather than requiring the reader to already know which point to look
    // for.
    console.log('[prerender] writing grammar conjugation reference page...');
    const conjugationGroups = groupConjugationsByForm(conjugationIndex, grammarPoints);

    const { body: conjugationsIndexBody } = render(GrammarConjugationsIndexPage, {
        props: { groups: conjugationGroups, pointCount: Object.keys(conjugationIndex).length },
    });
    const conjugationsIndexMetaValue = grammarConjugationsIndexMeta(conjugationGroups.length, Object.keys(conjugationIndex).length);
    writePage(['grammar', 'conjugations'], renderDocument({
        title: conjugationsIndexMetaValue.title,
        description: conjugationsIndexMetaValue.description,
        canonicalPath: grammarConjugationsIndexPath(),
        bodyHtml: conjugationsIndexBody,
        stylesheetHref,
        pageStylesheetHref: pageStyles.grammarConjugations,
        scriptHref: searchScriptHref,
    }));
    sitemapPaths.push(grammarConjugationsIndexPath());

    // -- Browse indexes -------------------------------------------------------
    // These exist so every page type has a depth-1 or depth-2 path from the site root. Kanji
    // pages in particular were previously linked only from whichever vocab pages happened to
    // contain them, leaving the rarer characters effectively orphaned.
    const JLPT_LEVELS = [5, 4, 3, 2, 1];

    console.log('[prerender] writing kanji index...');
    const kanjiGroups = [
        ...JLPT_LEVELS.map(level => ({
            level: level as number | null,
            kanji: kanjiList.filter(kanji => kanji.steps.jlpt === level),
        })),
        { level: null, kanji: kanjiList.filter(kanji => kanji.steps.jlpt === undefined) },
    ].filter(group => group.kanji.length > 0);

    const { body: kanjiIndexBody } = render(KanjiIndexPage, { props: { groups: kanjiGroups } });
    const kanjiIndexMetaValue = kanjiIndexMeta(kanjiList.length);
    writePage(['kanji'], renderDocument({
        title: kanjiIndexMetaValue.title,
        description: kanjiIndexMetaValue.description,
        canonicalPath: kanjiIndexPath(),
        bodyHtml: kanjiIndexBody,
        stylesheetHref,
        pageStylesheetHref: pageStyles.kanjiIndex,
        scriptHref: searchScriptHref,
    }));
    sitemapPaths.push(kanjiIndexPath());

    console.log('[prerender] writing vocabulary browse pages...');
    const jlptLevelWords = JLPT_LEVELS.map(level => ({
        level,
        // The index carries only {id, containedKanji}; the display fields come from the summary
        // map built above. An id with no summary is dropped rather than rendered blank.
        words: (vocabJlptIndex[String(level)] ?? [])
            .map(entry => summaryById.get(entry.id))
            .filter((summary): summary is VocabSummary => Boolean(summary)),
    })).filter(group => group.words.length > 0);

    const availableLevels = jlptLevelWords.map(group => group.level);

    for (const { level, words } of jlptLevelWords) {
        const { body } = render(VocabJlptPage, { props: { level, words, allLevels: availableLevels } });
        const meta = vocabJlptMeta(level, words.length);
        writePage(['vocab', `jlpt-n${level}`], renderDocument({
            title: meta.title,
            description: meta.description,
            canonicalPath: vocabJlptPath(level),
            bodyHtml: body,
            stylesheetHref,
            scriptHref: searchScriptHref,
        }));
        sitemapPaths.push(vocabJlptPath(level));
    }

    const { body: vocabIndexBody } = render(VocabIndexPage, {
        props: {
            levels: jlptLevelWords.map(({ level, words }) => ({ level, count: words.length })),
            totalCount: vocabIds.length,
        },
    });
    const vocabIndexMetaValue = vocabIndexMeta(vocabIds.length);
    writePage(['vocab'], renderDocument({
        title: vocabIndexMetaValue.title,
        description: vocabIndexMetaValue.description,
        canonicalPath: vocabIndexPath(),
        bodyHtml: vocabIndexBody,
        stylesheetHref,
        scriptHref: searchScriptHref,
    }));
    sitemapPaths.push(vocabIndexPath());

    console.log('[prerender] writing home page...');
    const { body: homeBody } = render(HomePage, {
        props: {
            vocabCount: vocabIds.length,
            kanjiCount: kanjiList.length,
            grammarCount: grammarIds.length,
            sentenceCount,
            // The most frequent N5 words: the index is frequency-ordered, so the head of the
            // easiest level is the closest thing the dataset has to "words a visitor will know".
            featured: (jlptLevelWords.find(group => group.level === 5)?.words ?? []).slice(0, 12),
        },
    });
    const homeMetaValue = homeMeta();
    const homeHtml = renderDocument({
        title: homeMetaValue.title,
        description: homeMetaValue.description,
        canonicalPath: homePath(),
        bodyHtml: homeBody,
        stylesheetHref,
        pageStylesheetHref: pageStyles.home,
        scriptHref: searchScriptHref,
    });
    fs.writeFileSync(path.join(DIST_DIR, 'index.html'), homeHtml);

    console.log('[prerender] writing search index, sitemap.xml, and robots.txt...');
    fs.mkdirSync(path.join(DIST_DIR, 'data'), { recursive: true });
    fs.writeFileSync(path.join(DIST_DIR, 'data', 'search.json'), JSON.stringify(searchIndex));
    fs.writeFileSync(path.join(DIST_DIR, 'data', 'grammar-browse.json'), JSON.stringify(browseRows));
    fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), buildSitemapXml(sitemapPaths));
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
        `${grammarIds.length} grammar pages, ${chapterRows.length} grammar chapter pages, ` +
        `${familyPages.length} grammar family pages, 1 grammar conjugation reference page, ` +
        `${jlptLevelWords.length + 3} index pages, 1 home page in ${elapsedSeconds}s.`,
    );
}

await main();
