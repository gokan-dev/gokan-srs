// The dictionary's data from the gokan-dataset checkout on disk: `checkoutData`, the
// DictionaryData (lib/types.ts) the prerender script reads every page's data through. Node only:
// never import this from a .svelte component or any file that ends up in the client bundle (it
// uses `node:fs`). The `.server.ts` suffix is a naming convention flagging that, not an enforced
// boundary (this app has no framework-level server/client split like SvelteKit does).
//
// `checkoutData` takes an explicit `compiledDir` rather than resolving one itself, so tests can
// point it at a small fixture directory instead of the real ~1GB submodule checkout (see
// dataset.server.test.ts).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { englishView } from '@gokan/dataset-schema/english';
import type {
    FrequencyIndex, GrammarConjugationIndex, GrammarContrastIndex, GrammarExample, GrammarJlptIndex, GrammarPoint, GrammarTeachingOrder, GrammarVariantGroupIndex,
    JlptIndex, Kanji, KanjiOrderList, KanjiVocabIndex, Sentence, Vocabulary,
} from '@gokan/dataset-schema';
import type { DictionaryData, VocabSummary } from './types';
import { vocabSummaryFrom } from './vocabSummary';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// apps/gokan-dictionary/src/lib -> apps/gokan-dictionary -> apps -> repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DATASET_SUBMODULE_PATH = path.join('apps', 'gokan-srs', 'dataset');

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

/**
 * The dictionary's data, read from a compiled/ directory through its English view: each file in
 * the English shape this app's types describe. The dataset keeps each file's text apart from its
 * core, per language; the view puts them back together (see @gokan/dataset-schema/english).
 */
export function checkoutData(compiledDir: string): DictionaryData {
    const view = englishView(compiledDir);
    // The dataset's own build typed each file; the view gives back the shape the types describe.
    const read = <T>(relative: string): T => view.json(relative) as T;
    const exists = (relative: string): boolean => fs.existsSync(path.join(compiledDir, relative));
    // Reads are synchronous here; a throw becomes the promise's rejection, as it would over HTTP.
    const later = <T>(load: () => T): Promise<T> => new Promise(resolve => resolve(load()));

    const vocabIds = (): string[] => fs.readdirSync(path.join(compiledDir, 'vocab'))
        .filter(name => name.endsWith('.json'))
        .map(name => name.slice(0, -'.json'.length));
    const vocab = (id: string): Vocabulary => read<Vocabulary>(`vocab/${id}.json`);

    // Built once, from every word file, and kept: about 36k small summaries.
    let summaries: Promise<ReadonlyMap<string, VocabSummary>> | null = null;

    return {
        vocabIds: () => later(() => vocabIds()),
        vocab: id => later(() => vocab(id)),
        sentencesFor: vocabId => later(() => (exists(`sentences/${vocabId}.json`) ? read<Sentence[]>(`sentences/${vocabId}.json`) : null)),
        wordSummaries: () => {
            summaries ??= later(() => new Map(vocabIds().map(id => [id, vocabSummaryFrom(vocab(id))])));
            return summaries;
        },
        kanjiList: () => later(() => read<Kanji[]>('kanji.json')),
        kanjiVocabIndex: () => later(() => read<KanjiVocabIndex>('index/kanji-vocab.json')),
        kanjiOrder: order => later(() => read<KanjiOrderList>(`index/kanji-orders/${order}.json`)),
        vocabJlptIndex: () => later(() => read<JlptIndex>('index/jlpt.json')),
        frequencyIndex: () => later(() => read<FrequencyIndex>('index/frequency.json')),
        // Ordered by JLPT level rather than read off the directory listing: that order is the one
        // the pages present.
        grammarIds: () => later(() => {
            const index = read<GrammarJlptIndex>('grammar/index/jlpt.json');
            return [5, 4, 3, 2, 1].flatMap(level => index[level] ?? []);
        }),
        grammarPoint: id => later(() => read<GrammarPoint>(`grammar/points/${id}.json`)),
        grammarTeachingOrder: () => later(() => read<GrammarTeachingOrder>('grammar/index/teaching-order.json')),
        grammarContrasts: () => later(() => read<GrammarContrastIndex>('grammar/index/contrasts.json')),
        grammarVariantGroups: () => later(() => read<GrammarVariantGroupIndex>('grammar/index/variant-groups.json')),
        grammarConjugations: () => later(() => read<GrammarConjugationIndex>('grammar/conjugations.json')),
        // One file per eligible point: most points (~350/828) have none, the common, permanent
        // case, not an error.
        grammarMinedExamples: id => later(() => (exists(`grammar/mined/${id}.json`) ? read<GrammarExample[]>(`grammar/mined/${id}.json`) : null)),
    };
}
