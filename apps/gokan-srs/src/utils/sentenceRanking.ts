import type { VocabProgress } from '../models/vocabulary.model';
import type { Sentence } from '../models/sentence.model';
import { CONSTANTS } from '../commons/constants';
import { isProductionActivated } from '../services/scheduling';
import { calculateMasteryLoops } from './srs.utils';
import { hashString } from './deterministicPick';

/**
 * Shared sentence ranking: decides which example sentence a card shows, with one
 * rule for every activity that picks a sentence (the grammar review, the vocab
 * production cloze, the vocab meaning-in-context card).
 *
 * The goal is familiarity, not variety. A sentence built from words the learner is
 * currently learning is easier to read, and seeing the SAME sentence again ties a
 * word to a concrete context, which helps separate near-synonyms. Because every
 * activity ranks the same corpus against the same learner vocabulary, grammar and
 * vocab gravitate toward the same sentences, so that familiarity is shared.
 *
 * Each word in a sentence gets one role:
 * - `unknown`: not introduced. Costs readability (`readabilityPenalty`).
 * - `target`: introduced, production ring below `targetRingCeiling`. Counts toward
 *   the sentence, and its production ring value feeds the progress sum.
 * - `context`: production ring at the ceiling. Neutral: familiar enough to be plain
 *   context, so it no longer holds a sentence in place.
 *
 * Ranking keys, in order:
 * 1. `targets - readabilityPenalty * unknowns`, highest first.
 * 2. `progress`: the summed production ring of the targets, highest first. This is
 *    what makes a chosen sentence STICK: each review raises its words' rings, so it
 *    keeps winning, until a word reaches the ceiling and drops out of the sum. The
 *    sentence rotates because its words were learned, not on a timer.
 * 3. A per-sentence hash on a stable seed (the card's own id, never a review
 *    count), so an exact tie resolves to the same sentence every time.
 */

export type LearnerVocab = ReadonlyMap<string, VocabProgress>;

export type WordRole = 'unknown' | 'target' | 'context';

export interface SentenceScore {
    targets: number;
    unknowns: number;
    /** Sum of the targets' production ring values (0..targetRingCeiling each). */
    progress: number;
}

export function indexLearnerVocab(queue: readonly VocabProgress[] | undefined): LearnerVocab {
    return new Map((queue ?? []).map(vp => [vp.vocabId, vp]));
}

/** A word's production ring (MasteryRing's first loop, 0..100). 0 while production is not activated. */
export function productionRing(vp: VocabProgress): number {
    if (!vp.production || !isProductionActivated(vp.production)) return 0;
    return calculateMasteryLoops(vp.production.memoryStrength).p1;
}

export function wordRole(vocabId: string, learner: LearnerVocab): WordRole {
    const vp = learner.get(vocabId);
    if (!vp || vp.introductionAt === null) return 'unknown';
    return productionRing(vp) >= CONSTANTS.srs.sentenceSelection.targetRingCeiling ? 'context' : 'target';
}

/**
 * Scores a sentence from the vocab ids it contains. Each id counts once however
 * often it occurs, and `exclude` drops ids that must not influence the ranking
 * (a vocab card's own word, which every candidate contains anyway).
 */
export function scoreSentence(
    vocabIds: Iterable<string>,
    learner: LearnerVocab,
    exclude: ReadonlySet<string> = new Set()
): SentenceScore {
    const score: SentenceScore = { targets: 0, unknowns: 0, progress: 0 };
    for (const id of new Set(vocabIds)) {
        if (exclude.has(id)) continue;
        const role = wordRole(id, learner);
        if (role === 'unknown') {
            score.unknowns++;
        } else if (role === 'target') {
            score.targets++;
            score.progress += productionRing(learner.get(id)!);
        }
    }
    return score;
}

function primaryKey(score: SentenceScore): number {
    return score.targets - CONSTANTS.srs.sentenceSelection.readabilityPenalty * score.unknowns;
}

// Float keys: two sentences whose keys differ only by rounding noise are a tie.
const EPSILON = 1e-9;

/** Negative when `a` ranks above `b`, positive when below, 0 on an exact tie. */
export function compareSentenceScores(a: SentenceScore, b: SentenceScore): number {
    const primary = primaryKey(b) - primaryKey(a);
    if (Math.abs(primary) > EPSILON) return primary;
    const progress = b.progress - a.progress;
    if (Math.abs(progress) > EPSILON) return progress;
    return 0;
}

/**
 * The best-ranked candidate, or null for an empty list. `keyOf` must identify a
 * sentence stably (its id, or its text when it has none); `seed` should be the
 * card's own id, so that ties do not reshuffle from one review to the next.
 */
export function pickMostProductive<T>(
    candidates: readonly T[],
    scoreOf: (candidate: T) => SentenceScore,
    keyOf: (candidate: T) => string,
    seed: string
): T | null {
    let best: { candidate: T; score: SentenceScore; tieBreak: number } | null = null;
    for (const candidate of candidates) {
        const score = scoreOf(candidate);
        const tieBreak = hashString(`${seed}:${keyOf(candidate)}`);
        if (!best) {
            best = { candidate, score, tieBreak };
            continue;
        }
        const cmp = compareSentenceScores(score, best.score);
        if (cmp < 0 || (cmp === 0 && tieBreak < best.tieBreak)) {
            best = { candidate, score, tieBreak };
        }
    }
    return best?.candidate ?? null;
}

/**
 * The vocab cards' entry point: ranks a word's own example sentences by the words
 * AROUND it (the word itself is in every candidate, so it is excluded), seeded on
 * the word's id. Used by the production cloze and the meaning-in-context card.
 */
export function pickSentenceForVocab(
    vocabId: string,
    sentences: readonly Sentence[],
    learner: LearnerVocab
): Sentence | null {
    const exclude = new Set([vocabId]);
    return pickMostProductive(
        sentences,
        s => scoreSentence(s.vocabIds, learner, exclude),
        s => s.id,
        vocabId
    );
}
