import type { MediaWordCount } from '../models/media.model';
import type { FrequencyIndex, JlptIndex, KKLCIndex } from '../models/index.model';
import type { LearningOrder } from '../models/user.model';

/**
 * Ordering for the listening library's "words to learn" lists, per episode and
 * for a whole series. Pure: the indexes are loaded by the caller (they are the
 * same frequency, JLPT and KKLC indexes the quiz's own refill uses).
 */

export type WordSort = 'yours' | 'occurrences' | 'frequency' | 'jlpt' | 'kklc';

export const WORD_SORTS: { value: WordSort; label: string }[] = [
    { value: 'yours', label: 'Your learning order' },
    { value: 'occurrences', label: 'Most used here' },
    { value: 'frequency', label: 'General frequency' },
    { value: 'jlpt', label: 'JLPT level' },
    { value: 'kklc', label: 'Kanji order (KKLC)' },
];

/** Per-word facts from the vocab indexes, keyed by vocab id. */
export interface WordOrderContext {
    /** 0 = most frequent word in the dataset. */
    frequencyRank: Map<string, number>;
    kanjiOf: Map<string, string[]>;
    /** 5 = N5 (easiest) .. 1 = N1. Absent for the majority of words, which have no JLPT level. */
    jlptLevel: Map<string, number>;
    kklcStep: Map<string, number>;
}

export function buildWordOrderContext(frequency: FrequencyIndex, jlpt: JlptIndex, kklc: KKLCIndex): WordOrderContext {
    const frequencyRank = new Map<string, number>();
    const kanjiOf = new Map<string, string[]>();
    frequency.forEach((entry, rank) => {
        frequencyRank.set(entry.id, rank);
        kanjiOf.set(entry.id, entry.containedKanji);
    });
    const jlptLevel = new Map<string, number>();
    for (const [level, entries] of Object.entries(jlpt)) {
        for (const entry of entries) jlptLevel.set(entry.id, Number(level));
    }
    const kklcStep = new Map<string, number>();
    for (const [step, ids] of Object.entries(kklc)) {
        for (const id of ids) if (!kklcStep.has(id)) kklcStep.set(id, Number(step));
    }
    return { frequencyRank, kanjiOf, jlptLevel, kklcStep };
}

/** What the learner's own vocab order depends on: their settings and kanji. */
export interface LearnerOrder {
    order: LearningOrder;
    knownKanji: Set<string>;
    /** KKLC step reached, for the kklc order. */
    kklcStep: number;
    ignoreKnownKanji: boolean;
    /**
     * Known kanji still below the kanji-coverage target in the learner's
     * vocabulary (computeUncoveredKanji). Only read by the kanji_coverage order.
     */
    uncoveredKanji: Set<string>;
}

/**
 * Known kanji that appear in fewer than `target` of the learner's words: the
 * kanji_coverage order favours words that cover them. Mirrors step 2 of
 * SRSService.findCandidatesKanjiCoverage.
 */
export function computeUncoveredKanji(
    activeIds: Iterable<string>,
    knownKanji: Set<string>,
    kanjiOf: Map<string, string[]>,
    target: number
): Set<string> {
    const counts = new Map<string, number>();
    for (const kanji of knownKanji) counts.set(kanji, 0);
    for (const id of activeIds) {
        for (const kanji of kanjiOf.get(id) ?? []) {
            if (counts.has(kanji)) counts.set(kanji, counts.get(kanji)! + 1);
        }
    }
    return new Set([...counts].filter(([, count]) => count < target).map(([kanji]) => kanji));
}

/**
 * Whether the learner's own queue could introduce this word right now: under
 * the kklc order, its step is reached; under every other order, all its kanji
 * are known (unless they turned that requirement off).
 */
export function isLearnableNow(vocabId: string, context: WordOrderContext, learner: LearnerOrder): boolean {
    if (learner.order === 'kklc') return (context.kklcStep.get(vocabId) ?? Infinity) <= learner.kklcStep;
    if (learner.ignoreKnownKanji) return true;
    const kanji = context.kanjiOf.get(vocabId);
    return kanji !== undefined && kanji.every(k => learner.knownKanji.has(k));
}

/** Weight of one uncovered kanji against frequency rank, as in SRSService.findCandidatesKanjiCoverage. */
const KANJI_COVERAGE_RANK_VALUE = 2500;

/** Lower sorts first. Words a key knows nothing about go last. */
function keyOf(sort: Exclude<WordSort, 'yours' | 'occurrences'>, vocabId: string, context: WordOrderContext): number[] {
    const rank = context.frequencyRank.get(vocabId) ?? Infinity;
    switch (sort) {
        case 'frequency':
            return [rank];
        case 'jlpt': {
            const level = context.jlptLevel.get(vocabId);
            return [level === undefined ? Infinity : 5 - level, rank];
        }
        case 'kklc':
            return [context.kklcStep.get(vocabId) ?? Infinity, rank];
    }
}

function learnerKey(vocabId: string, context: WordOrderContext, learner: LearnerOrder): number[] {
    const learnable = isLearnableNow(vocabId, context, learner) ? 0 : 1;
    if (learner.order === 'kanji_coverage') {
        const rank = context.frequencyRank.get(vocabId) ?? Infinity;
        const covered = (context.kanjiOf.get(vocabId) ?? []).filter(k => learner.uncoveredKanji.has(k)).length;
        return [learnable, -(covered * KANJI_COVERAGE_RANK_VALUE - rank)];
    }
    return [learnable, ...keyOf(learner.order, vocabId, context)];
}

function compareKeys(a: number[], b: number[]): number {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i] ?? 0;
        const y = b[i] ?? 0;
        if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
}

/**
 * Sorts a word list. 'yours' mirrors the learner's vocab learning order: words
 * their queue could introduce now come first, ordered the way that queue
 * orders them. Every sort falls back to most-used-here, then id, so ties and
 * words missing from an index stay stable. Without a context (indexes still
 * loading) every sort is most-used-here.
 */
export function sortWords(
    words: MediaWordCount[],
    sort: WordSort,
    context: WordOrderContext | null,
    learner: LearnerOrder | null
): MediaWordCount[] {
    const byUse = (a: MediaWordCount, b: MediaWordCount) => b[1] - a[1] || a[0].localeCompare(b[0]);
    if (!context || sort === 'occurrences' || (sort === 'yours' && !learner)) return [...words].sort(byUse);

    const keys = new Map(words.map(([id]) => [
        id,
        sort === 'yours' ? learnerKey(id, context, learner!) : keyOf(sort, id, context),
    ]));
    return [...words].sort((a, b) => compareKeys(keys.get(a[0])!, keys.get(b[0])!) || byUse(a, b));
}
