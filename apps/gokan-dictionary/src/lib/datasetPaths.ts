// Where each file the dictionary reads sits in the compiled dataset (relative to compiled/, as it
// is published under /dataset/): one list for both sources, the checkout (dataset.server.ts) and
// the published dataset over HTTP (lib/server/httpData.ts), so the two can never read different
// files for the same question.

import type { KanjiOrderId } from '@gokan/dataset-schema';

export const DATASET_PATHS = {
    vocab: (id: string) => `vocab/${id}.json`,
    sentences: (vocabId: string) => `sentences/${vocabId}.json`,
    kanjiList: 'kanji.json',
    kanjiVocabIndex: 'index/kanji-vocab.json',
    kanjiOrder: (order: KanjiOrderId) => `index/kanji-orders/${order}.json`,
    vocabJlptIndex: 'index/jlpt.json',
    frequencyIndex: 'index/frequency.json',
    grammarJlptIndex: 'grammar/index/jlpt.json',
    grammarPoint: (id: string) => `grammar/points/${id}.json`,
    grammarTeachingOrder: 'grammar/index/teaching-order.json',
    grammarContrasts: 'grammar/index/contrasts.json',
    grammarVariantGroups: 'grammar/index/variant-groups.json',
    grammarConjugations: 'grammar/conjugations.json',
    grammarMinedExamples: (id: string) => `grammar/mined/${id}.json`,
    /** A core file's text in a language other than English, as published (text/zh-hans/vocab/1358280.json). */
    text: (language: string, corePath: string) => `text/${language}/${corePath}`,
    /** A language's text index: the core files with text in it, by group (vocab, sentences, kanji). */
    textEntities: (language: string) => `text/${language}/index/entities.json`,
} as const;
