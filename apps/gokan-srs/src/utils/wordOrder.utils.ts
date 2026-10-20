import type { FrequencyIndex, JlptIndex, KanjiStepIndex, MediaWordCount } from '@gokan/dataset-schema';
import type { LearningOrder } from '../models/user.model';
import { coverageCandidates, kanjiCoverageScore, kanjiCoverageScores } from './kanjiCoverageOrder.utils';
import type { CoverageCandidate } from './kanjiCoverageOrder.utils';
import { numericEntries } from './records';
import { orderIncludesUsuallyKana } from './usuallyKana.utils';

/**
 * Ordering for the listening library's "words to learn" lists, per episode and
 * for a whole series. Pure: the indexes are loaded by the caller (they are the
 * same frequency, JLPT and kanji step indexes the quiz's own refill uses).
 */

export type WordSort = 'yours' | 'occurrences' | 'frequency' | 'jlpt' | 'kklc';

export const WORD_SORTS: { value: WordSort; label: string }[] = [
    { value: 'yours', label: 'Your learning order' },
    { value: 'occurrences', label: 'Most used here' },
    { value: 'frequency', label: 'General frequency' },
    { value: 'jlpt', label: 'JLPT level' },
    { value: 'kklc', label: 'Your kanji method' },
];

/** Per-word facts from the vocab indexes, keyed by vocab id. */
export interface WordOrderContext {
    /** 0 = most frequent word in the dataset. */
    frequencyRank: Map<string, number>;
    kanjiOf: Map<string, string[]>;
    /** 5 = N5 (easiest) .. 1 = N1. Absent for the majority of words, which have no JLPT level. */
    jlptLevel: Map<string, number>;
    /** The step of the learner's kanji method that unlocks the word (KanjiStepIndex). */
    kanjiStep: Map<string, number>;
    /** Words learned in kana (VocabIndexEntry.usuallyKana): no kanji needed, absent from the kanji-driven orders. */
    usuallyKana: Set<string>;
}

export function buildWordOrderContext(frequency: FrequencyIndex, jlpt: JlptIndex, kanjiSteps: KanjiStepIndex): WordOrderContext {
    const frequencyRank = new Map<string, number>();
    const kanjiOf = new Map<string, string[]>();
    const usuallyKana = new Set<string>();
    frequency.forEach((entry, rank) => {
        frequencyRank.set(entry.id, rank);
        kanjiOf.set(entry.id, entry.containedKanji);
        if (entry.usuallyKana) usuallyKana.add(entry.id);
    });
    const jlptLevel = new Map<string, number>();
    for (const [level, entries] of numericEntries(jlpt)) {
        for (const entry of entries) jlptLevel.set(entry.id, level);
    }
    const kanjiStep = new Map<string, number>();
    for (const [step, ids] of numericEntries(kanjiSteps)) {
        for (const id of ids) if (!kanjiStep.has(id)) kanjiStep.set(id, step);
    }
    return { frequencyRank, kanjiOf, jlptLevel, kanjiStep, usuallyKana };
}

/** What the learner's own vocab order depends on: their settings and kanji. */
export interface LearnerOrder {
    order: LearningOrder;
    knownKanji: Set<string>;
    /** How many kanji into their method the learner is, for the kklc (by kanji) order. */
    kanjiStep: number;
    ignoreKnownKanji: boolean;
    /**
     * Each word's kanji_coverage score (kanjiCoverageScores, built by
     * kanjiCoverageScoresFor). Only read by the kanji_coverage order.
     */
    coverageScores: ReadonlyMap<string, number>;
}

/**
 * Known kanji that appear in fewer than `target` of the learner's words, each
 * with how many more words it needs: the kanji_coverage order favours words
 * that cover them. The one place this is computed, for the queue refill
 * (SRSService.findCandidatesKanjiCoverage) and the listening library alike.
 */
export function computeUncoveredKanji(
    activeIds: Iterable<string>,
    knownKanji: ReadonlySet<string>,
    kanjiOf: ReadonlyMap<string, readonly string[]>,
    target: number
): Map<string, number> {
    const counts = new Map<string, number>();
    for (const kanji of knownKanji) counts.set(kanji, 0);
    for (const id of activeIds) {
        for (const kanji of new Set(kanjiOf.get(id))) {
            const count = counts.get(kanji);
            if (count !== undefined) counts.set(kanji, count + 1);
        }
    }
    const uncovered = new Map<string, number>();
    for (const [kanji, count] of counts) if (count < target) uncovered.set(kanji, target - count);
    return uncovered;
}

/**
 * The words the kanji_coverage order could offer now, in frequency order:
 * built the same way for the queue refill (SRSService.findCandidatesKanjiCoverage)
 * and the listening sort.
 */
export function kanjiCoverageCandidatesFor(
    activeIds: ReadonlySet<string>,
    context: WordOrderContext,
    learner: Omit<LearnerOrder, 'coverageScores'>
): CoverageCandidate[] {
    // frequencyRank was filled in frequency order, so its entries already are.
    return coverageCandidates(context.frequencyRank, context.kanjiOf, activeIds, id => isLearnableNow(id, context, learner));
}

/**
 * The kanji_coverage score of every word the learner's queue could introduce
 * now, scored as the queue refill scores its first pick. The refill also
 * counts the pending intro candidates as active (they cover kanji too), but it
 * runs only when none are pending, so in practice the inputs match. A static
 * ranking rather than the refill's greedy loop: close enough for a list a
 * learner picks from.
 */
export function kanjiCoverageScoresFor(
    activeIds: ReadonlySet<string>,
    context: WordOrderContext,
    learner: Omit<LearnerOrder, 'coverageScores'>,
    target: number
): Map<string, number> {
    return kanjiCoverageScores(
        kanjiCoverageCandidatesFor(activeIds, context, learner),
        computeUncoveredKanji(activeIds, learner.knownKanji, context.kanjiOf, target)
    );
}

/**
 * Whether the learner's own queue could introduce this word right now: under
 * the kklc (by kanji) order, its step of the learner's kanji method is reached;
 * under every other order, all its kanji are known (unless they turned that
 * requirement off). A word learned in kana needs no kanji, but the
 * kanji-driven orders never introduce it.
 */
export function isLearnableNow(vocabId: string, context: WordOrderContext, learner: Omit<LearnerOrder, 'coverageScores'>): boolean {
    if (context.usuallyKana.has(vocabId)) return orderIncludesUsuallyKana(learner.order);
    if (learner.order === 'kklc') return (context.kanjiStep.get(vocabId) ?? Infinity) <= learner.kanjiStep;
    if (learner.ignoreKnownKanji) return true;
    const kanji = context.kanjiOf.get(vocabId);
    return kanji !== undefined && kanji.every(k => learner.knownKanji.has(k));
}

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
            return [context.kanjiStep.get(vocabId) ?? Infinity, rank];
    }
}

function learnerKey(vocabId: string, context: WordOrderContext, learner: LearnerOrder): number[] {
    const learnable = isLearnableNow(vocabId, context, learner) ? 0 : 1;
    if (learner.order === 'kanji_coverage') {
        const score = learner.coverageScores.get(vocabId)
            ?? kanjiCoverageScore(context.frequencyRank.get(vocabId) ?? Infinity, 0);
        return [learnable, -score];
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
