import type { GrammarProgress } from '../models/grammar.model';
import { GRAMMAR_JLPT_LEVELS } from '../models/grammar.model';
import type { VocabProgress } from '../models/vocabulary.model';
import type { UserSettings } from '../models/user.model';
import type { AnswerResult } from './srs.service';
import { SRSService } from './srs.service';
import { CONSTANTS } from '../commons/constants';
import { GrammarService } from './grammar.service';
import { isGrammarFullyMastered, grammarNextReviewAt } from './grammarScheduling';
import { newSRSEntry, isProductionActivated } from './scheduling';
import { collectJlptCandidates, countJlptCandidates } from './jlptWalk';

/**
 * Grammar's equivalent of SRSService: reuses the same formula
 * (SRSService.calculateNextState) and evaluation helpers rather than a new
 * algorithm, per issue #17. Simpler than the vocab version throughout since a
 * GrammarProgress has a single SRSEntry and a single quiz type - no
 * reading/meaning batching or AI-context modes to account for.
 *
 * Learning order is always JLPT level (N5 -> N1, source order within a level) -
 * grammar has no frequency data to sort by, unlike vocab, so it doesn't need
 * settings.preferredLearningOrder's variety of orders.
 */
export class GrammarSRSService {
    static createGrammarProgress(grammarId: string): GrammarProgress {
        return {
            grammarId,
            stage: 'learning',
            introductionAt: null,
            nextReviewAt: null,
            lastReviewedAt: null,
            totalReviews: 0,
            consecutiveFailures: 0,
            entry: newSRSEntry(),
        };
    }

    static applyGrammarIntroChoice(progress: GrammarProgress, choice: 'learn' | 'skip'): GrammarProgress {
        const updated: GrammarProgress = { ...progress, introductionAt: new Date() };

        if (choice === 'skip') {
            const maxS = CONSTANTS.srs.formula.mastery.maxMemoryStrength;
            updated.entry = {
                ...updated.entry,
                memoryStrength: maxS,
                interval: CONSTANTS.srs.formula.maxInterval,
                dueDate: null,
                lastReviewedAt: new Date(),
            };
            updated.nextReviewAt = null;
            updated.stage = 'graduated';
        } else {
            const now = new Date();
            updated.nextReviewAt = now;
            updated.entry = { ...updated.entry, dueDate: now };
        }

        return updated;
    }

    /**
     * Applies one answer's result to a GrammarProgress. `result` is the
     * combined result across every blank in the exercise (worst-of: any wrong
     * blank -> 'wrong', else any minor_error -> 'minor_error', else 'correct') -
     * computed by the caller, since only it knows the per-blank breakdown.
     */
    static applyAnswer(
        progress: GrammarProgress,
        result: AnswerResult,
        latencyMs: number,
        now: Date,
        intervalModifier: number = 1.0,
        frequencyModifier: number = 1.0,
        // Scales the grammar point's memory-strength gain by how well the
        // sentence's *vocab* blanks went (see gradeGrammarAnswers): a demonstrated
        // grammar core always keeps its result, but earns proportionally less when
        // the surrounding vocab was missed. 1.0 = full gain.
        strengthDeltaModifier: number = 1.0
    ): { updated: GrammarProgress; result: AnswerResult; interval: number } {
        // Retry: mirrors VocabProgress.needsRetry - a successful/failed retry
        // doesn't touch SRS state, it's a training-only redo.
        if (progress.needsRetry) {
            const isSuccess = result === 'correct' || result === 'minor_error';
            return {
                updated: { ...progress, needsRetry: !isSuccess },
                result,
                interval: progress.entry.interval,
            };
        }

        const expectedLatency = CONSTANTS.srs.quizProperties.grammar.expectedLatency;
        const { newEntry, interval } = SRSService.calculateNextState(
            progress.entry, result, latencyMs, now, expectedLatency, intervalModifier, frequencyModifier, strengthDeltaModifier
        );

        const finalStage = isGrammarFullyMastered({ entry: newEntry }) ? 'graduated' : progress.stage;
        const finalNextReviewAt = finalStage === 'graduated' ? null : grammarNextReviewAt({ entry: newEntry });

        return {
            updated: {
                ...progress,
                entry: newEntry,
                stage: finalStage,
                nextReviewAt: finalNextReviewAt,
                lastReviewedAt: now,
                totalReviews: progress.totalReviews + 1,
                consecutiveFailures: result === 'correct' ? 0 : progress.consecutiveFailures + 1,
                needsRetry: result === 'wrong',
            },
            result,
            interval,
        };
    }

    /**
     * Advances a GrammarProgress past the current turn WITHOUT touching its SRS
     * state (memoryStrength/interval/difficulty untouched, so this genuinely
     * grants no credit) - used for the rare grammar point where none of its
     * examples have a single blankable word (computeBlankPlan's read-only
     * fallback), where there is nothing to grade. Only reschedules `dueDate`
     * forward by a fixed cooldown so the same ungradable card doesn't
     * immediately reappear on the very next queue pick.
     */
    static deferWithoutCredit(progress: GrammarProgress, now: Date): GrammarProgress {
        const deferredDueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return {
            ...progress,
            entry: { ...progress.entry, dueDate: deferredDueDate },
            nextReviewAt: deferredDueDate,
            lastReviewedAt: now,
            totalReviews: progress.totalReviews + 1,
        };
    }

    /**
     * Applies POSITIVE-ONLY vocab credit to the user's learning queue for the
     * non-pattern (vocab reinforcement) blanks the user answered correctly in a
     * grammar sentence. Only ever upward: `credits` is pre-filtered to
     * correct/minor_error results, and a word not in the learning queue is skipped
     * entirely. A wrong vocab blank never reaches here, so grammar practice can
     * never penalise vocab.
     *
     * **Credit goes to the PRODUCTION entry, not reading.** Filling a blank is
     * English sentence in, Japanese out, which is production's definition exactly.
     * Reading means the opposite question (given the written form, produce its
     * sound) and a blank never shows the written form to read - it is a gap the
     * learner writes into. This used to credit reading, which is the one direction
     * of the three that the exercise structurally cannot test.
     *
     * Credited at `reinforcementStrengthRatio` rather than in full: the direction is
     * right but the conditions are much easier than a production card's, since the
     * English sentence, the surrounding Japanese and the bracketing particles narrow
     * the candidates, and kanji is accepted where that card wants the reading.
     *
     * Deliberately NOT split across all three entries. Each entry drives its own
     * schedule, so crediting three would push three due dates out on one scaffolded
     * answer and thin out review pressure in two directions this never exercised.
     *
     * A word whose production entry has not been activated yet is **seeded first**
     * (`SRSService.seedProductionEntry`, strength from meaning at its usual ratio)
     * and then credited on top, so it joins the production rotation at its designed
     * baseline rather than at whatever one grammar blank happens to compute.
     *
     * No-op when production quizzes are disabled: the exercise trains a direction
     * the user has switched off, and crediting reading instead would just restore
     * the mismatch this exists to fix.
     *
     * Latency is neutralised (expectedLatency) rather than threaded through from
     * the card, since the single card-level timing can't be attributed per blank
     * and a stray fast/slow submit shouldn't skew an individual word's difficulty.
     */
    static applyVocabReinforcement(
        learningQueue: VocabProgress[],
        credits: { vocabId: string; result: AnswerResult }[],
        now: Date,
        settings: UserSettings
    ): VocabProgress[] {
        if (credits.length === 0) return learningQueue;

        const meaningEnabled = settings.enableMeaningQuiz !== false;
        const productionEnabled = settings.enableProductionQuiz !== false;
        if (!productionEnabled) return learningQueue;

        const frequencyModifier = CONSTANTS.srs.frequencyMultipliers[settings.learningFrequency];
        const neutralLatency = CONSTANTS.srs.quizProperties.production.expectedLatency;

        let changed = false;
        const next = learningQueue.map(vp => {
            const credit = credits.find(c => c.vocabId === vp.vocabId);
            if (!credit || (credit.result !== 'correct' && credit.result !== 'minor_error')) return vp;

            // Bring production online at its designed baseline before crediting, so a
            // word met first through grammar does not enter the rotation at whatever
            // strength one scaffolded blank produces.
            const seeded: VocabProgress = isProductionActivated(vp.production)
                ? vp
                : { ...vp, production: SRSService.seedProductionEntry(vp.production, vp.meaning, now) };

            // correctAnswer is unused because forcedResult (credit.result) is supplied.
            const { updated } = SRSService.applyAnswer(
                seeded, 'production', 'base', '', '',
                neutralLatency, now, credit.result, 1.0, frequencyModifier, meaningEnabled,
                productionEnabled, CONSTANTS.srs.production.reinforcementStrengthRatio
            );
            changed = true;
            return updated;
        });

        return changed ? next : learningQueue;
    }

    /**
     * Finds the next batch of grammar point IDs eligible for learning, in the
     * dataset's authored teaching order (see gokan-dataset's
     * `index/teaching-order.json` and its SCHEMA.md).
     *
     * The old behaviour - JLPT level (N5 -> N1), then the upstream file's own
     * order within a level - was alphabetical by title, which put the
     * superlative first, then seven near-synonymous connectives, and the case
     * particles at #40+ (`Noun は` #40, `Noun を` #43, `Verb て` #46). It
     * survives only as the fallback for when the order file can't be loaded.
     *
     * Introduction order only. Review order is untouched and stays interleaved
     * (`pickStableGrammar` over the due pool in grammarSelectors.ts) - teaching
     * near-synonyms adjacently is the point, but *reviewing* them adjacently
     * risks exactly the interference the vocab side already guards against.
     */
    static async getNextCandidates(
        currentQueue: GrammarProgress[],
        maxToFind: number,
        ignoredIds: Set<string> = new Set()
    ): Promise<string[]> {
        if (maxToFind <= 0) return [];

        const activeIds = new Set(currentQueue.map(g => g.grammarId));
        for (const id of ignoredIds) activeIds.add(id);
        const isTeachable = await this.buildTeachabilityFilter();

        const teachingOrder = await GrammarService.loadTeachingOrder();
        if (teachingOrder) {
            const found: string[] = [];
            for (const id of teachingOrder.order) {
                if (activeIds.has(id) || !isTeachable(id)) continue;
                found.push(id);
                if (found.length >= maxToFind) break;
            }
            return found;
        }

        const index = await GrammarService.loadJlptIndex();
        if (!index) return [];

        return collectJlptCandidates<string>(
            GRAMMAR_JLPT_LEVELS,
            level => index[level] ?? [],
            id => id,
            id => !activeIds.has(id) && isTeachable(id),
            maxToFind
        );
    }

    /**
     * Excludes points the current quiz cannot actually test.
     *
     * `kind: 'inflection'` points teach a DERIVATION (て-form, causative,
     * passive) - the correct answer differs per input word, so there is nothing
     * invariant for `computeBlankPlan` to blank. `n5-046` (the て-form) anchors
     * on て, so the cloze quiz would ask for a fixed kana rather than the
     * conjugation.
     *
     * They are teachable once the transformation drill has items for them, so
     * the gate is on DATA, not on kind: an inflection point is allowed through
     * only if `conjugations.json` actually carries drill items for it. That
     * matters for `n1-178`, which the dataset may legitimately have no items for
     * - gating on kind alone would let it through and present an unanswerable
     * card.
     *
     * Failure directions differ by index, on purpose:
     *  - kinds unavailable  -> everything teachable (the pre-kind behaviour);
     *    the alternative is silently emptying the learning queue.
     *  - conjugations unavailable -> no inflection point teachable; the
     *    alternative is serving a card with no question on it.
     */
    private static async buildTeachabilityFilter(): Promise<(id: string) => boolean> {
        const kinds = await GrammarService.loadKinds();
        const conjugations = await GrammarService.loadConjugations();
        return (id: string) => {
            if (kinds[id] !== 'inflection') return true;
            return (conjugations[id]?.items?.length ?? 0) > 0;
        };
    }

    /**
     * Must walk the same sequence as getNextCandidates, or the hub's "more new
     * available" signal desyncs from what a session can actually serve.
     */
    static async countLearnableGrammar(currentQueue: GrammarProgress[], limit = Infinity): Promise<number> {
        const activeIds = new Set(currentQueue.map(g => g.grammarId));
        const isTeachable = await this.buildTeachabilityFilter();

        const teachingOrder = await GrammarService.loadTeachingOrder();
        if (teachingOrder) {
            let count = 0;
            for (const id of teachingOrder.order) {
                if (activeIds.has(id) || !isTeachable(id)) continue;
                count++;
                if (count >= limit) return count;
            }
            return count;
        }

        const index = await GrammarService.loadJlptIndex();
        if (!index) return 0;

        return countJlptCandidates<string>(
            GRAMMAR_JLPT_LEVELS,
            level => index[level] ?? [],
            id => !activeIds.has(id) && isTeachable(id),
            limit
        );
    }

    static async hasMoreLearnableGrammar(currentQueue: GrammarProgress[]): Promise<boolean> {
        return (await this.countLearnableGrammar(currentQueue, 1)) > 0;
    }
}
