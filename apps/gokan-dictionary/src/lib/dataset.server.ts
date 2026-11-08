// The dictionary's data from the gokan-dataset checkout on disk: `checkoutData`, the
// DictionaryData (lib/types.ts) the pages read their data through (lib/server/pages.ts). Node
// only (`node:fs`): SvelteKit refuses a `.server.ts` module in anything bound for the browser.
//
// `checkoutData` takes an explicit `compiledDir` rather than resolving one itself, so tests can
// point it at a small fixture directory instead of the real ~1GB submodule checkout (see
// dataset.server.test.ts).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { englishView } from '@gokan/dataset-schema/english';
import type {
    FrequencyIndex, GrammarConjugationIndex, GrammarContrastIndex, GrammarExample, GrammarJlptIndex, GrammarPoint, GrammarTeachingOrder, GrammarVariantGroupIndex,
    JlptIndex, Kanji, KanjiOrderList, KanjiVocabIndex, Sentence, Vocabulary,
} from '@gokan/dataset-schema';
import { DATASET_PATHS } from './datasetPaths';
import type { DatasetLanguage } from './locale';
import { grammarSummaryOf } from './grammarBrowse';
import type { DictionaryData, GrammarSummary, VocabSummary } from './types';
import { vocabSummaryFrom } from './vocabSummary';

const DATASET_SUBMODULE_PATH = path.join('apps', 'gokan-srs', 'dataset');

/**
 * The repo root: the nearest directory, from the working directory up, that holds a `.gitmodules`
 * naming the dataset submodule. Found from the working directory, not this file: once SvelteKit
 * bundles the server, this module runs from `.svelte-kit/output/`, wherever that is.
 */
function repoRoot(): string {
    for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
        const gitmodules = path.join(dir, '.gitmodules');
        if (fs.existsSync(gitmodules) && fs.readFileSync(gitmodules, 'utf-8').includes('apps/gokan-srs/dataset')) return dir;
        if (path.dirname(dir) === dir) throw new Error(`[dataset] no repo root above ${process.cwd()}: run the build from inside the gokan-srs checkout.`);
    }
}

/**
 * Resolves the compiled dataset directory, auto-initializing the shared gokan-dataset
 * submodule (checked out once, under apps/gokan-srs/dataset - see CLAUDE.md's Dataset
 * Consumption section) if it hasn't been fetched yet.
 *
 * gokan-srs's own equivalent (its vite.config.ts) deliberately fails fast instead of
 * auto-initializing, because its CI (deploy.yml) already checks out the submodule via
 * `submodules: true` on actions/checkout - a missing submodule there means something is
 * genuinely wrong. gokan-dictionary's CI (ci-gokan-dictionary.yml) does not check out
 * submodules (editing workflow files is out of scope for automated changes to this repo), so
 * this is the only remaining place that can fetch it before a build needs real data.
 */
export function resolveCompiledDir(): string {
    const root = repoRoot();
    const compiledDir = path.join(root, DATASET_SUBMODULE_PATH, 'compiled');

    if (!fs.existsSync(compiledDir)) {
        console.warn(`[dataset] ${compiledDir} not found, running "git submodule update --init ${DATASET_SUBMODULE_PATH}"...`);
        execFileSync('git', ['submodule', 'update', '--init', DATASET_SUBMODULE_PATH], {
            cwd: root,
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

/**
 * Each language's view of a compiled/ directory. The dataset keeps each file's text apart from its
 * core, per language; a view puts them back together, in the shape this app's types describe (see
 * @gokan/dataset-schema/english). English is the one the dataset projects today.
 */
const VIEWS: Record<DatasetLanguage, typeof englishView> = { en: englishView };

/** The dictionary's data, read from a compiled/ directory through its view in `language`. */
export function checkoutData(compiledDir: string, language: DatasetLanguage): DictionaryData {
    const view = VIEWS[language](compiledDir);
    // The dataset's own build typed each file; the view gives back the shape the types describe.
    const read = <T>(relative: string): T => view.json(relative) as T;
    const exists = (relative: string): boolean => fs.existsSync(path.join(compiledDir, relative));
    // Reads are synchronous here; a throw becomes the promise's rejection, as it would over HTTP.
    const later = <T>(load: () => T): Promise<T> => new Promise(resolve => resolve(load()));

    const vocabIds = (): string[] => fs.readdirSync(path.join(compiledDir, 'vocab'))
        .filter(name => name.endsWith('.json'))
        .map(name => name.slice(0, -'.json'.length));
    const vocab = (id: string): Vocabulary => read<Vocabulary>(DATASET_PATHS.vocab(id));

    // Built once, from every word file, and kept: about 36k small summaries.
    let summaries: Promise<ReadonlyMap<string, VocabSummary>> | null = null;
    let grammarSummaries: Promise<ReadonlyMap<string, GrammarSummary>> | null = null;
    // Ordered by JLPT level rather than read off the directory listing: that order is the one
    // the pages present.
    const grammarIds = (): string[] => {
        const index = read<GrammarJlptIndex>(DATASET_PATHS.grammarJlptIndex);
        return [5, 4, 3, 2, 1].flatMap(level => index[level] ?? []);
    };
    const grammarPoint = (id: string): GrammarPoint => read<GrammarPoint>(DATASET_PATHS.grammarPoint(id));

    return {
        vocabIds: () => later(() => vocabIds()),
        vocab: id => later(() => vocab(id)),
        sentencesFor: vocabId => later(() => (exists(DATASET_PATHS.sentences(vocabId)) ? read<Sentence[]>(DATASET_PATHS.sentences(vocabId)) : null)),
        wordSummaries: () => {
            summaries ??= later(() => new Map(vocabIds().map(id => [id, vocabSummaryFrom(vocab(id))])));
            return summaries;
        },
        grammarSummaries: () => {
            grammarSummaries ??= later(() => new Map(grammarIds().map(id => [id, grammarSummaryOf(grammarPoint(id))])));
            return grammarSummaries;
        },
        kanjiList: () => later(() => read<Kanji[]>(DATASET_PATHS.kanjiList)),
        kanjiVocabIndex: () => later(() => read<KanjiVocabIndex>(DATASET_PATHS.kanjiVocabIndex)),
        kanjiOrder: order => later(() => read<KanjiOrderList>(DATASET_PATHS.kanjiOrder(order))),
        vocabJlptIndex: () => later(() => read<JlptIndex>(DATASET_PATHS.vocabJlptIndex)),
        frequencyIndex: () => later(() => read<FrequencyIndex>(DATASET_PATHS.frequencyIndex)),
        grammarIds: () => later(() => grammarIds()),
        grammarPoint: id => later(() => grammarPoint(id)),
        grammarTeachingOrder: () => later(() => read<GrammarTeachingOrder>(DATASET_PATHS.grammarTeachingOrder)),
        grammarContrasts: () => later(() => read<GrammarContrastIndex>(DATASET_PATHS.grammarContrasts)),
        grammarVariantGroups: () => later(() => read<GrammarVariantGroupIndex>(DATASET_PATHS.grammarVariantGroups)),
        grammarConjugations: () => later(() => read<GrammarConjugationIndex>(DATASET_PATHS.grammarConjugations)),
        // One file per eligible point: most points (~350/828) have none, the common, permanent
        // case, not an error.
        grammarMinedExamples: id => later(() => (exists(DATASET_PATHS.grammarMinedExamples(id)) ? read<GrammarExample[]>(DATASET_PATHS.grammarMinedExamples(id)) : null)),
    };
}
