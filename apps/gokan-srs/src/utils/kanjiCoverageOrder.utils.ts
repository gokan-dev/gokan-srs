import { CONSTANTS } from '../commons/constants';

/**
 * The kanji_coverage learning order's score, the one place it is computed:
 * SRSService.findCandidatesKanjiCoverage (the queue refill) and the listening
 * library's "Your learning order" sort both call it, so the two cannot drift.
 */

const { wordsPerKanji, maxCreditedKanji, rankBoost, rankOffset } = CONSTANTS.srs.kanjiCoverage;

/** A word the order could offer: learnable and not in the learner's queue. */
export interface CoverageCandidate {
    id: string;
    /** Frequency rank, 0 = most frequent. */
    rank: number;
    kanji: readonly string[];
}

/**
 * The words the order could offer, in frequency order: the one place the
 * refill and the listening sort build the scorer's input. `ranked` is every
 * word in frequency order with its rank; `isLearnable` is the learner's rule
 * (isLearnableNow), passed in by both callers so it is written once.
 */
export function coverageCandidates(
    ranked: Iterable<readonly [string, number]>,
    kanjiOf: ReadonlyMap<string, readonly string[]>,
    activeIds: ReadonlySet<string>,
    isLearnable: (id: string) => boolean
): CoverageCandidate[] {
    const candidates: CoverageCandidate[] = [];
    for (const [id, rank] of ranked) {
        if (activeIds.has(id) || !isLearnable(id)) continue;
        candidates.push({ id, rank, kanji: kanjiOf.get(id) ?? [] });
    }
    return candidates;
}

/**
 * Log-scale usefulness plus a fixed discount per credited kanji: a frequency
 * penalty that flattens with rank, so a credited kanji lifts a word by a ratio
 * of ranks, never by a fixed number of places. With no kanji credited it is
 * pure frequency.
 */
export function kanjiCoverageScore(rank: number, creditedKanji: number): number {
    return Math.min(maxCreditedKanji, creditedKanji) * Math.log(rankBoost) - Math.log(rank + rankOffset);
}

/**
 * Each word's score against the kanji still uncovered. A kanji credits only
 * its few most frequent remaining words, so a long compound (自分自身) does not
 * take the bonus that the kanji's everyday words (自分) should get.
 * `candidates` must be in frequency order.
 */
export function kanjiCoverageScores(
    candidates: readonly CoverageCandidate[],
    uncovered: ReadonlyMap<string, number>
): Map<string, number> {
    const nominated = new Map<string, number>();
    const scores = new Map<string, number>();
    for (const word of candidates) {
        let credited = 0;
        for (const kanji of new Set(word.kanji)) {
            if (!uncovered.has(kanji)) continue;
            const seen = nominated.get(kanji) ?? 0;
            if (seen >= wordsPerKanji) continue;
            nominated.set(kanji, seen + 1);
            credited++;
        }
        scores.set(word.id, kanjiCoverageScore(word.rank, credited));
    }
    return scores;
}

/**
 * The next `count` words of the order, best score first, re-scored after each
 * pick so a batch does not cover the same kanji twice. `uncovered` maps each
 * known kanji below the coverage target to how many more words it needs
 * (computeUncoveredKanji). `candidates` must be in frequency order.
 */
export function pickKanjiCoverage(
    candidates: readonly CoverageCandidate[],
    uncovered: ReadonlyMap<string, number>,
    count: number
): string[] {
    const missing = new Map(uncovered);
    const remaining = [...candidates];
    const picked: string[] = [];
    while (picked.length < count && remaining.length > 0) {
        // Nothing left to cover: the score is pure frequency, which is the order remaining is already in.
        if (missing.size === 0) {
            picked.push(...remaining.slice(0, count - picked.length).map(word => word.id));
            break;
        }
        const scores = kanjiCoverageScores(remaining, missing);
        let best = 0;
        for (let i = 1; i < remaining.length; i++) {
            if (scores.get(remaining[i].id)! > scores.get(remaining[best].id)!) best = i;
        }
        const [word] = remaining.splice(best, 1);
        picked.push(word.id);
        for (const kanji of new Set(word.kanji)) {
            const needed = missing.get(kanji);
            if (needed === undefined) continue;
            if (needed <= 1) missing.delete(kanji);
            else missing.set(kanji, needed - 1);
        }
    }
    return picked;
}
