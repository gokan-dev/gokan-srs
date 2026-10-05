import type { VocabProgress } from '../models/vocabulary.model';
import type { GrammarExample, Sentence } from '@gokan/dataset-schema';
import { CONSTANTS } from '../commons/constants';
import { isProductionActivated } from '../services/scheduling';
import { calculateMasteryLoops } from './srs.utils';
import { hashString } from './deterministicPick';

/**
 * Shared sentence ranking: decides which example sentence a card shows, with one
 * rule for every activity that picks a sentence (the grammar review, the vocab
 * production cloze, the vocab meaning-in-context card).
 *
 * The goal is comprehensible input, not just familiarity: reading research puts
 * unassisted comprehension at roughly 98% known-word coverage (Hu & Nation 2000),
 * so a single unknown word in a short sentence already drops well below that. An
 * unknown word must therefore decide the ranking on its own, never be traded
 * against extra known words the way a plain per-word average would allow.
 *
 * Each word in a sentence gets one role, feeding the `targets`/`progress` half of
 * a score:
 * - `unknown`: resolved to a vocab id the learner has not introduced. Counts 1
 *   toward `unknownWeight`.
 * - `target`: introduced, production ring below `targetRingCeiling`. Counts
 *   toward the sentence, and its production ring value feeds the progress sum.
 * - `context`: production ring at the ceiling. Neutral: familiar enough to be
 *   plain context, so it no longer holds a sentence in place.
 *
 * A word that never resolved to a vocab id at all is invisible to the roles
 * above, but is not free: it also feeds `unknownWeight`, weighted by how
 * readable it still is on its own -
 * - contains a kanji: 1 (unchanged from a resolved-unknown word - it cannot be
 *   read either way).
 * - katakana only, 2+ characters: `unresolvedKatakanaWeight` (0.5) - it can be
 *   sounded out, and is usually a name or loanword rather than genuine unknown
 *   vocabulary.
 * - anything else (hiragana function words, particles, punctuation, digits): 0.
 *
 * How "not resolved" is found differs by sentence shape, so there is one scoring
 * entry point per shape rather than a single function guessing at the data:
 * - `scoreGrammarExample` walks `GrammarExample.words[]` directly (each word is
 *   already segmented), skipping `patternWordIndices` entirely - the pattern is
 *   blanked and is the grammar under test, never an unknown.
 * - `scoreVocabSentence` has no word-level segmentation to read, only
 *   `Sentence.matches` span offsets into `original`; it scans the text NOT
 *   covered by any vocab id's spans for maximal kanji/katakana runs.
 *
 * Ranking keys, in order (`compareSentenceScores`):
 * 1. `unknownWeight`, lowest first. Decides the ranking on its own whenever it
 *    differs - no number of extra known words can outweigh it.
 * 2. Length band (`Math.ceil(length / lengthBand)`), shortest first. Coarse
 *    bands rather than raw length, so a 14-character sentence does not
 *    automatically beat a 15-character one, and ties within a band still fall
 *    to the learner's own words below.
 * 3. `targets`, most first.
 * 4. `progress`: the summed production ring of the targets, highest first. This
 *    is what makes a chosen sentence STICK: each review raises its words'
 *    rings, so it keeps winning, until a word reaches the ceiling and drops out
 *    of the sum. The sentence rotates because its words were learned, not on a
 *    timer.
 * 5. A per-sentence hash on a stable seed (the card's own id, never a review
 *    count), so an exact tie resolves to the same sentence every time.
 */

export type LearnerVocab = ReadonlyMap<string, VocabProgress>;

export type WordRole = 'unknown' | 'target' | 'context';

export interface SentenceScore {
    /** Lower is better. Resolved-unknown and kanji-bearing unresolved words weigh 1; unresolved katakana (2+ chars) weighs `unresolvedKatakanaWeight`; everything else weighs 0. */
    unknownWeight: number;
    /** Character count of the sentence's Japanese text (`jp` / `original`). */
    length: number;
    targets: number;
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
 * Scores a flat list of RESOLVED vocab ids (each counted once however often it
 * occurs, matching a repeated word in a sentence to a single role). `exclude`
 * drops ids that must not influence the ranking (a vocab card's own word, which
 * every candidate contains anyway). Shared by both `scoreGrammarExample` and
 * `scoreVocabSentence` - this is the one part of scoring that does not depend on
 * the sentence's shape.
 */
function scoreResolvedIds(
    vocabIds: Iterable<string>,
    learner: LearnerVocab,
    exclude: ReadonlySet<string>
): { targets: number; unknownWeight: number; progress: number } {
    let targets = 0;
    let unknownWeight = 0;
    let progress = 0;
    for (const id of new Set(vocabIds)) {
        if (exclude.has(id)) continue;
        const role = wordRole(id, learner);
        if (role === 'unknown') {
            unknownWeight += 1;
        } else if (role === 'target') {
            targets++;
            progress += productionRing(learner.get(id)!);
        }
    }
    return { targets, unknownWeight, progress };
}

const KANJI_RE = /[一-鿿々]/;
const KATAKANA_ONLY_RE = /^[ァ-ヺー]+$/;

/** Unknown weight of a single UNRESOLVED word (grammar shape), by what it still tells a reader on its own. */
function unresolvedWordWeight(surface: string): number {
    if (KANJI_RE.test(surface)) return 1;
    if (surface.length >= 2 && KATAKANA_ONLY_RE.test(surface)) return CONSTANTS.srs.sentenceSelection.unresolvedKatakanaWeight;
    return 0;
}

/**
 * Scores a `GrammarExample`: every word in `words[]` other than the pattern
 * markers (`patternWordIndices`, always excluded - they are the grammar under
 * test, never an unknown) contributes either through its resolved vocab id
 * (`scoreResolvedIds`) or, when unresolved, through `unresolvedWordWeight`.
 */
export function scoreGrammarExample(
    example: Pick<GrammarExample, 'words' | 'patternWordIndices' | 'jp'>,
    learner: LearnerVocab
): SentenceScore {
    const resolvedIds: string[] = [];
    let unresolvedWeight = 0;

    example.words.forEach((word, i) => {
        if (example.patternWordIndices.includes(i)) return;
        if (word.vocabId) {
            resolvedIds.push(word.vocabId);
        } else {
            unresolvedWeight += unresolvedWordWeight(word.surface);
        }
    });

    const resolved = scoreResolvedIds(resolvedIds, learner, new Set());
    return {
        unknownWeight: resolved.unknownWeight + unresolvedWeight,
        length: example.jp.length,
        targets: resolved.targets,
        progress: resolved.progress,
    };
}

const KANJI_RUN_RE = /[一-鿿々]+/g;
const KATAKANA_RUN_RE = /[ァ-ヺー]{2,}/g;

/** Unknown weight contributed by one fragment of text with no vocab-id coverage at all. */
function unresolvedTextWeight(text: string): number {
    const kanjiRuns = text.match(KANJI_RUN_RE)?.length ?? 0;
    const katakanaRuns = text.match(KATAKANA_RUN_RE)?.length ?? 0;
    return kanjiRuns + katakanaRuns * CONSTANTS.srs.sentenceSelection.unresolvedKatakanaWeight;
}

/** Every vocab match span in a sentence, merged into non-overlapping ranges regardless of which id owns them. */
function coveredRanges(sentence: Sentence): [number, number][] {
    const ranges: [number, number][] = Object.values(sentence.matches ?? {})
        .flat()
        .map(m => [m.start, m.start + m.length]);
    ranges.sort((a, b) => a[0] - b[0]);

    const merged: [number, number][] = [];
    for (const range of ranges) {
        const last = merged[merged.length - 1];
        if (last && range[0] <= last[1]) {
            last[1] = Math.max(last[1], range[1]);
        } else {
            merged.push([...range]);
        }
    }
    return merged;
}

/**
 * Unknown weight from the parts of `sentence.original` NOT covered by any
 * vocab id's match spans. Each uncovered fragment is scored independently
 * (never concatenated with another) so a kanji run ending one fragment can
 * never merge with a kanji run starting the next across a covered word in
 * between - that would undercount two separate unresolved words as one.
 */
function unresolvedTextWeightOf(sentence: Sentence): number {
    const covered = coveredRanges(sentence);
    let weight = 0;
    let cursor = 0;
    for (const [start, end] of covered) {
        if (start > cursor) weight += unresolvedTextWeight(sentence.original.slice(cursor, start));
        cursor = Math.max(cursor, end);
    }
    if (cursor < sentence.original.length) weight += unresolvedTextWeight(sentence.original.slice(cursor));
    return weight;
}

/**
 * Scores a vocab `Sentence` from the vocab ids it contains plus whatever its
 * `matches` spans leave uncovered in `original`. `exclude` drops ids that must
 * not influence the ranking (a vocab card's own word, which every candidate
 * contains anyway) - its own span still counts as covered text, just not
 * toward `targets`/`unknownWeight`.
 */
export function scoreVocabSentence(
    sentence: Sentence,
    learner: LearnerVocab,
    exclude: ReadonlySet<string> = new Set()
): SentenceScore {
    const resolved = scoreResolvedIds(sentence.vocabIds, learner, exclude);
    return {
        unknownWeight: resolved.unknownWeight + unresolvedTextWeightOf(sentence),
        length: sentence.original.length,
        targets: resolved.targets,
        progress: resolved.progress,
    };
}

// Float keys: two sentences whose keys differ only by rounding noise are a tie.
const EPSILON = 1e-9;

function lengthBand(length: number): number {
    return Math.ceil(length / CONSTANTS.srs.sentenceSelection.lengthBand);
}

/** Negative when `a` ranks above `b`, positive when below, 0 on an exact tie. */
export function compareSentenceScores(a: SentenceScore, b: SentenceScore): number {
    const unknown = a.unknownWeight - b.unknownWeight;
    if (Math.abs(unknown) > EPSILON) return unknown;

    const band = lengthBand(a.length) - lengthBand(b.length);
    if (band !== 0) return band;

    const targets = b.targets - a.targets;
    if (targets !== 0) return targets;

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
        s => scoreVocabSentence(s, learner, exclude),
        s => s.id,
        vocabId
    );
}
