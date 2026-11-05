// Node-only data access for the compiled gokan-dataset. Used by the prerender script
// (scripts/prerender.ts) and nowhere else - never import this from a .svelte component or
// any file that ends up in the client bundle (it uses `node:fs`, which doesn't exist in the
// browser). The `.server.ts` suffix is a naming convention flagging that, not an enforced
// boundary (this app has no framework-level server/client split like SvelteKit does).
//
// Every loader here takes an explicit `compiledDir` rather than resolving one internally, so
// tests can point at a small fixture directory instead of the real ~1GB submodule checkout -
// see dataset.server.test.ts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { englishView, type EnglishView } from '@gokan/dataset-schema/english';
import type { FrequencyIndex, GrammarConjugationIndex, GrammarContrastIndex, GrammarExample, GrammarJlptIndex, GrammarPoint, GrammarTeachingOrder, GrammarVariantGroupIndex, JlptIndex, Kanji, KanjiOrderId, KanjiOrderList, KanjiVocabIndex, Sentence, Vocabulary } from '@gokan/dataset-schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// apps/gokan-dictionary/src/lib -> apps/gokan-dictionary -> apps -> repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DATASET_SUBMODULE_PATH = path.join('apps', 'gokan-srs', 'dataset');

/**
 * Resolves the compiled dataset directory, auto-initializing the shared gokan-dataset
 * submodule (checked out once, under apps/gokan-srs/dataset - see CLAUDE.md's Dataset
 * Consumption section) if it hasn't been fetched yet.
 *
 * gokan-srs's own equivalent (scripts/sync-dataset.ts) deliberately fails fast instead of
 * auto-initializing, because its CI (deploy.yml) already checks out the submodule via
 * `submodules: true` on actions/checkout - a missing submodule there means something is
 * genuinely wrong. gokan-dictionary's CI (ci-gokan-dictionary.yml) does not check out
 * submodules (editing workflow files is out of scope for automated changes to this repo), so
 * this is the only remaining place that can fetch it before a build needs real data.
 */
export function resolveCompiledDir(): string {
    const compiledDir = path.join(REPO_ROOT, DATASET_SUBMODULE_PATH, 'compiled');

    if (!fs.existsSync(compiledDir)) {
        console.warn(`[dataset] ${compiledDir} not found, running "git submodule update --init ${DATASET_SUBMODULE_PATH}"...`);
        execFileSync('git', ['submodule', 'update', '--init', DATASET_SUBMODULE_PATH], {
            cwd: REPO_ROOT,
            stdio: 'inherit',
        });
    }

    if (!fs.existsSync(compiledDir)) {
        throw new Error(
            `[dataset] ${compiledDir} still missing after submodule init. ` +
            `Run "git submodule update --init --recursive" manually and retry.`
        );
    }

    return compiledDir;
}

const views = new Map<string, EnglishView>();

/**
 * One compiled file, in the English shape this app reads. The dataset keeps each file's text
 * apart from its core, per language; its English view puts them back together, as they were
 * before the text layer (see @gokan/dataset-schema/english).
 */
function readCompiled<T>(compiledDir: string, ...segments: string[]): T {
    let view = views.get(compiledDir);
    if (!view) {
        view = englishView(compiledDir);
        views.set(compiledDir, view);
    }
    // The dataset's own build typed this file; the view gives back the shape the types describe.
    return view.json(segments.join('/')) as T;
}

export function listVocabIds(compiledDir: string): string[] {
    return fs.readdirSync(path.join(compiledDir, 'vocab'))
        .filter(name => name.endsWith('.json'))
        .map(name => name.slice(0, -'.json'.length));
}

export function loadVocab(compiledDir: string, id: string): Vocabulary {
    return readCompiled<Vocabulary>(compiledDir, 'vocab', `${id}.json`);
}

export function loadKanjiList(compiledDir: string): Kanji[] {
    return readCompiled<Kanji[]>(compiledDir, 'kanji.json');
}

export function loadKanjiVocabIndex(compiledDir: string): KanjiVocabIndex {
    return readCompiled<KanjiVocabIndex>(compiledDir, 'index', 'kanji-vocab.json');
}

/** One kanji learning order's kanji, in teaching order: step N is the Nth. */
export function loadKanjiOrderList(compiledDir: string, order: KanjiOrderId): KanjiOrderList {
    return readCompiled<KanjiOrderList>(compiledDir, 'index', 'kanji-orders', `${order}.json`);
}

export function loadSentences(compiledDir: string, vocabId: string): Sentence[] | null {
    if (!fs.existsSync(path.join(compiledDir, 'sentences', `${vocabId}.json`))) return null;
    return readCompiled<Sentence[]>(compiledDir, 'sentences', `${vocabId}.json`);
}

/** JLPT level -> that level's vocab, frequency-ordered. Only ~6.4k of ~36k vocab are listed. */
export function loadVocabJlptIndex(compiledDir: string): JlptIndex {
    return readCompiled<JlptIndex>(compiledDir, 'index', 'jlpt.json');
}

/** Every vocab, most frequent first: the order of the dictionary's search index. */
export function loadFrequencyIndex(compiledDir: string): FrequencyIndex {
    return readCompiled<FrequencyIndex>(compiledDir, 'index', 'frequency.json');
}

// -- Grammar -----------------------------------------------------------------
// Grammar lives under its own compiled/grammar/ subtree (points/{id}.json + index/jlpt.json),
// mirroring the vocab layout one level down. Ids are ordered by JLPT level here rather than
// read off the directory listing, because that order is the one the pages present.

export function loadGrammarJlptIndex(compiledDir: string): GrammarJlptIndex {
    return readCompiled<GrammarJlptIndex>(compiledDir, 'grammar', 'index', 'jlpt.json');
}

/** Every grammar point id, ordered easiest-first (N5 -> N1), matching the SRS's own order. */
export function listGrammarIds(compiledDir: string): string[] {
    const index = loadGrammarJlptIndex(compiledDir);
    const ids: string[] = [];
    for (const level of [5, 4, 3, 2, 1]) {
        ids.push(...(index[level] ?? []));
    }
    return ids;
}

export function loadGrammarPoint(compiledDir: string, id: string): GrammarPoint {
    return readCompiled<GrammarPoint>(compiledDir, 'grammar', 'points', `${id}.json`);
}

/**
 * The authored introduction order (issue #58) - chapters plus their flattened
 * order. Used to build the chapter browser/detail pages and each point's
 * chapter locator. Not every point appears in it (a non-canonical variant
 * realization is taught only via its canonical, so it has no independent slot).
 */
export function loadGrammarTeachingOrder(compiledDir: string): GrammarTeachingOrder {
    return readCompiled<GrammarTeachingOrder>(compiledDir, 'grammar', 'index', 'teaching-order.json');
}

/** Family id -> its authored contrast lessons/interchangeable note, for the family pages. */
export function loadGrammarContrasts(compiledDir: string): GrammarContrastIndex {
    return readCompiled<GrammarContrastIndex>(compiledDir, 'grammar', 'index', 'contrasts.json');
}

/** Canonical point id -> its realization variants, for the "Other forms" section on a point page. */
export function loadGrammarVariantGroups(compiledDir: string): GrammarVariantGroupIndex {
    return readCompiled<GrammarVariantGroupIndex>(compiledDir, 'grammar', 'index', 'variant-groups.json');
}

/** Point id -> conjugation drill items, for the 40 `kind: 'inflection'` points' conjugation tables. */
export function loadGrammarConjugations(compiledDir: string): GrammarConjugationIndex {
    return readCompiled<GrammarConjugationIndex>(compiledDir, 'grammar', 'conjugations.json');
}

/**
 * The corpus-mined example pool for a point (issue #73's dataset half), for the "Corpus
 * examples" section on its page. One file per eligible point rather than a whole-index file
 * (mirrors loadSentences' per-vocab layout) - most points (~350/828) have none at all, which
 * is the common, permanent case, not an error.
 */
export function loadGrammarMinedExamples(compiledDir: string, id: string): GrammarExample[] | null {
    if (!fs.existsSync(path.join(compiledDir, 'grammar', 'mined', `${id}.json`))) return null;
    return readCompiled<GrammarExample[]>(compiledDir, 'grammar', 'mined', `${id}.json`);
}
