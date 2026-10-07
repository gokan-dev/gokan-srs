// src/services/srs.service.ts
import { JLPT_LEVELS } from '@gokan/dataset-schema';
import type { SynonymRelation, Vocabulary } from '@gokan/dataset-schema';
import type { ReviewLog, SRSEntry, VocabProgress } from '../models/vocabulary.model';
import { CONSTANTS } from '../commons/constants';
import { VocabularyService } from './vocabulary.service';
import type { KanjiKnowledge, UserSettings } from '../models/user.model';
import { introQuizType, isVocabFullyMastered, vocabNextReviewAt, newSRSEntry, isProductionActivated } from './scheduling';
import type { QuizType } from '../utils/srs.utils';
import { collectJlptCandidates, countJlptCandidates } from './jlptWalk';
import { isFormOfWord, toInflectableWord } from '../utils/inflection.utils';
import { matchAnswer, matchBest, type AnswerResult, type Leniency } from '../utils/answerMatching';
import { orderIncludesUsuallyKana, usuallyKanaPacer, type UsuallyKanaPacer } from '../utils/usuallyKana.utils';

export type { AnswerResult } from '../utils/answerMatching';

/**
 * One member of the current production word's near-synonym cluster (issue #71
 * Part B, gokan-dataset's index/synonyms.json), resolved to its own accept-list
 * shape at card-load time - see useQuizOrchestration's loading effect - so
 * grading a collision against it stays synchronous.
 */
/**
 * What production grading reads off a vocab. `senses` carries the part-of-speech
 * tags the inflection generator needs; without it a word simply has no
 * inflections and only its dictionary forms are accepted.
 */
export type ProductionVocab = Pick<Vocabulary, 'reading' | 'writtenForm' | 'mergedVocabs' | 'usuallyKana'> & Partial<Pick<Vocabulary, 'senses'>>;

export interface ProductionSynonymCandidate {
    vocabId: string;
    relation: SynonymRelation;
    vocab: ProductionVocab;
    /** See VocabSynonym.shared / curated. */
    shared?: string[];
    curated?: boolean;
}

export interface ProductionSynonymMatch {
    candidate: ProductionSynonymCandidate;
    /** The candidate's OWN matched form (mirrors evaluateProductionAnswer's matchedAnswer). */
    matchedAnswer: string;
}

const F = CONSTANTS.srs.formula;

/** The settings that decide which vocabulary is introduced next. */
export type LearningOrderSettings = Pick<UserSettings, 'preferredLearningOrder' | 'kanjiCoverageTarget' | 'ignoreKnownKanjiRequirement'>;

/** What the learnable-vocabulary count reads from the user's progress. */
export interface LearnableScope {
    kanjiKnowledge: KanjiKnowledge;
    learningQueue: readonly Pick<VocabProgress, 'vocabId'>[];
}

export class SRSService {

    /* =======================
       ANSWER EVALUATION
       ======================= */

    /**
     * Checks user input against ALL acceptable readings, through the shared
     * matcher (utils/answerMatching.ts). Returns the best result found.
     */
    static evaluateAnswer(
        userInput: string,
        readings: { primary: string; alternatives: string[] },
        leniency: Leniency = 'standard'
    ): { result: AnswerResult; matchedAnswer: string } {
        return matchBest(userInput, [readings.primary, ...readings.alternatives], leniency);
    }

    /**
     * Checks user input against ALL acceptable meanings (glosses). Builds the
     * accept-list (each gloss split on its separators); the comparison itself is
     * the shared matcher's, like every other quiz.
     */
    static evaluateMeaning(
        userInput: string,
        meanings: string[]
    ): { result: AnswerResult; matchedAnswer: string } {
        const parts = meanings.flatMap(meaning => {
            // Parentheses go first so commas inside them ("go (to, from)") don't
            // split the gloss.
            let clean = meaning;
            let prev;
            do {
                prev = clean;
                clean = clean.replace(/\s*\([^()]*\)\s*/g, ' ');
            } while (clean !== prev);

            // Split on ; and , but not a comma inside a number (10,000).
            return clean.split(/;\s*|,(?!\d)\s*/).map(p => p.trim()).filter(p => p.length > 0);
        });

        const best = matchBest(userInput, parts);
        // Nothing accepted to reveal beyond the first gloss when nothing matched.
        return best.result === 'wrong' || best.result === 'pass'
            ? { result: best.result, matchedAnswer: meanings[0] || '' }
            : best;
    }

    /**
     * Checks a production answer (English prompt, Japanese reading answer)
     * against the FULL accept-list the way `computeBlankPlan` (`grammarSelectors.ts`)
     * already builds its own: the reading primary and alternatives, plus
     * `writtenForm.kanji` and its alternatives, plus any `mergedVocabs` readings
     * (issue #71 Part A). Previously this graded against `evaluateAnswer` on the
     * reading alone, so a correct kanji answer (必ず for かならず) graded `wrong`.
     *
     * ONE accept-list, ONE comparison rule. Production does not orchestrate its
     * own matching: it assembles the forms it will accept and hands them to
     * `evaluateAnswer`, exactly as the reading quiz and the grammar blanks do,
     * so a given typo is graded identically whichever quiz asked the question.
     *
     * Written forms briefly had a bespoke path here, matched EXACTLY and nothing
     * else, to keep them off the Levenshtein comparison: a distance-1 difference
     * between two kanji strings is usually a different word. The protection was
     * right, the placement was not. Exact-only cannot express "right word, tail
     * missing", so it graded 六 for 六つ as `wrong` at -0.40 (reported from
     * production). Moving the distinction into the shared matcher
     * (`matchAnswer`, utils/answerMatching.ts), as a kanji-skeleton rule, protects every quiz at once instead of this one call site, and the
     * special case here became dead weight.
     *
     * Shared by both production quiz cards (gloss-prompt and the sentence-cloze
     * card from issue #72) - both set `quizType: 'production'`, so this is the
     * single grading path either one goes through.
     */
    static evaluateProductionAnswer(
        userInput: string,
        vocab: ProductionVocab,
        // The cloze card's blanked surface and its reading (食べたら / たべたら),
        // accepted on the normal typo-tolerant path. They cover a sentence form
        // the inflection tables do not produce.
        extraForms: string[] = []
    ): { result: AnswerResult; matchedAnswer: string } {
        const evaluation = this.evaluateAnswer(userInput, {
            primary: vocab.reading.primary,
            alternatives: [
                ...vocab.reading.alternatives,
                ...(vocab.mergedVocabs?.map(m => m.originalPrimaryReading) ?? []),
                vocab.writtenForm.kanji,
                ...vocab.writtenForm.alternatives,
                ...extraForms,
            ],
        });
        if (evaluation.result === 'correct' || evaluation.result === 'pass') return evaluation;

        // Production tests whether the learner can produce the WORD, not its
        // conjugation (issue #95). Any form of it, in kanji or kana, is a correct
        // answer: 食べた, たべたら and 食べる all answer a cue for 食べる.
        if (isFormOfWord(userInput, toInflectableWord(vocab))) {
            return { result: 'correct', matchedAnswer: userInput.trim() };
        }
        return evaluation;
    }

    /**
     * Checks a WRONG production answer (per evaluateProductionAnswer above) against
     * the target word's precomputed near-synonym cluster (issue #71 Part B). Reuses
     * evaluateProductionAnswer per candidate - the identical accept-list logic used
     * to grade the target itself - so a "collision" here means the input is a
     * genuine written/reading form of that OTHER word, never a loose partial match.
     *
     * Only ever meaningful once the target's own evaluateProductionAnswer has
     * already graded 'wrong'; candidates are precomputed at card-load time (see
     * useQuizOrchestration's loading effect, same pattern as computeBlankPlan's
     * accept-lists), so this itself does no I/O and grading stays synchronous.
     *
     * An EXACT match wins over a typo match, whatever the candidate order: with
     * dozens of candidates per word, the input can be one candidate's exact form
     * and another's typo at once. つむ is 積む exactly, but it used to match 止む
     * (やむ) as a typo first and grade as that word instead (reported from
     * production). Otherwise the first typo match is returned.
     */
    static evaluateProductionSynonyms(
        userInput: string,
        candidates: ProductionSynonymCandidate[]
    ): ProductionSynonymMatch | null {
        let typoMatch: ProductionSynonymMatch | null = null;
        for (const candidate of candidates) {
            const evaluation = this.evaluateProductionAnswer(userInput, candidate.vocab);
            if (evaluation.result === 'wrong') continue;
            const match = { candidate, matchedAnswer: evaluation.matchedAnswer };
            if (evaluation.result === 'correct') return match;
            typoMatch ??= match;
        }

        return typoMatch;
    }

    /**
     * Applies a `confusable` synonym collision (issue #71 Part B): the answer is a
     * genuine OTHER word from the target's near-synonym cluster - overlapping
     * glosses, but distinct usage - not an acceptable substitute, but not the
     * unrelated-word kind of wrong either. Crediting the confusion would reward
     * exactly the coasting this exists to prevent (see the issue's 必ず/常に
     * example); penalising it at -0.40 like an unrelated word would punish the
     * learner for a mistake the gloss-only cue itself invites - so this applies
     * neither: memoryStrength/interval/difficulty are untouched, and
     * needsRetry.production re-asks until the TARGET itself is produced.
     *
     * The due date DOES move: to now plus the entry's own unchanged interval, as a
     * review that changed nothing would. It used to stay where it was, i.e. in the
     * past, since the word had just been asked. Once the retry was answered and
     * the flag cleared, the word was due again at once and came back later in the
     * same session as a full review with points (reported). A retry never touches
     * scheduling, so the schedule has to be settled here, by the answer that
     * started the retry, exactly as a wrong answer's is.
     */
    static applyConfusableSynonymAnswer(
        vocab: VocabProgress,
        now: Date,
        meaningQuizEnabled: boolean = true,
        productionQuizEnabled: boolean = true
    ): VocabProgress {
        const productionEntry = vocab.production ?? newSRSEntry(vocab.reading.difficulty);
        const intervalDays = Math.max(productionEntry.interval, F.minInterval);
        const production: SRSEntry = {
            ...productionEntry,
            lastReviewedAt: now,
            dueDate: new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000),
        };
        const settingsSlice = { enableMeaningQuiz: meaningQuizEnabled, enableProductionQuiz: productionQuizEnabled };

        return {
            ...vocab,
            production,
            nextReviewAt: vocab.stage === 'graduated'
                ? vocab.nextReviewAt
                : vocabNextReviewAt({ reading: vocab.reading, meaning: vocab.meaning, production, usuallyKana: vocab.usuallyKana }, settingsSlice),
            needsRetry: { ...vocab.needsRetry, production: true },
            lastReviewedAt: now,
            totalReviews: vocab.totalReviews + 1,
        };
    }

    /* =======================
       ANSWER APPLICATION
       ======================= */

    static applyAnswer(
        vocab: VocabProgress,
        quizType: QuizType,
        quizMode: 'base' | 'context' | undefined, // [NEW] Mode
        userAnswer: string,
        correctAnswer: string, // The specific reading/meaning matched
        latencyMs: number,
        now: Date,
        forcedResult?: AnswerResult, // Optional override
        growthLevel: number = 1.0, // This quiz type's calibration level (services/calibration.ts)
        frequencyModifier: number = 1.0, // User preference modifier
        meaningQuizEnabled: boolean = true, // Whether meaning quizzes are active for this user
        productionQuizEnabled: boolean = true, // Whether production quizzes are active for this user
        // Scales the memory-strength gain, mirroring the parameter calculateNextState
        // already takes and GrammarSRSService.applyAnswer already forwards. Used to
        // credit an exercise that genuinely trains a direction, but under easier
        // conditions than that direction's own quiz (see applyVocabReinforcement).
        strengthDeltaModifier: number = 1.0
    ): { updated: VocabProgress; result: AnswerResult, interval: number } {
        const result = forcedResult ?? matchAnswer(userAnswer, correctAnswer);

        // Entries keyed by quiz type rather than reading/meaning ternaries. With a
        // third type this is not a style preference: a ternary silently routes
        // anything that is not 'reading' into the meaning entry, so production
        // answers would have corrupted meaning's schedule with no type error.
        const entryOf = (v: VocabProgress, type: QuizType): SRSEntry =>
            type === 'reading' ? v.reading
                : type === 'meaning' ? v.meaning
                    : (v.production ?? newSRSEntry(v.reading.difficulty));

        // Retry is tracked per quiz type: a wrong reading answer only forces a
        // reading retry and never blocks meaning or production reviews (and vice versa).
        if (vocab.needsRetry?.[quizType]) {
            const isSuccess = result === 'correct' || result === 'minor_error';
            // Stamp lastReviewedAt on the entry even though scheduling fields are
            // untouched - a retry attempt is still a real interaction, and without
            // any timestamp trace, mergeVocabProgress has no way to tell "just
            // resolved locally" apart from a stale remote snapshot still carrying
            // the flag, and a background sync can resurrect an already-cleared retry.
            const retryEntry = entryOf(vocab, quizType);
            const updatedRetryEntry = { ...retryEntry, lastReviewedAt: now };
            return {
                updated: {
                    ...vocab,
                    reading: quizType === 'reading' ? updatedRetryEntry : vocab.reading,
                    meaning: quizType === 'meaning' ? updatedRetryEntry : vocab.meaning,
                    production: quizType === 'production' ? updatedRetryEntry : vocab.production,
                    needsRetry: { ...vocab.needsRetry, [quizType]: !isSuccess }
                },
                result,
                interval: retryEntry.interval
            };
        }

        // Select the correct entry to update
        const currentEntry = { ...entryOf(vocab, quizType) };

        // [NEW] Dynamically determine latency limit based on mode and type
        let expectedLatencyKey: keyof typeof CONSTANTS.srs.quizProperties =
            quizType === 'reading' ? 'reading'
                : quizType === 'production' ? 'production'
                    : 'meaning_base';
        if (quizType === 'meaning' && quizMode === 'context') {
            expectedLatencyKey = 'meaning_context';
        }
        const expectedLatency = CONSTANTS.srs.quizProperties[expectedLatencyKey].expectedLatency;

        const { newEntry, interval } = this.calculateNextState(currentEntry, result, latencyMs, now, expectedLatency, growthLevel, frequencyModifier, strengthDeltaModifier);

        // We update the specific entry first
        const updatedReading = quizType === 'reading' ? newEntry : vocab.reading;
        const updatedMeaning = quizType === 'meaning' ? newEntry : vocab.meaning;
        let updatedProduction = quizType === 'production' ? newEntry : vocab.production;

        // Same-session separation across reading/meaning/production is no longer done
        // here by pushing a due entry's dueDate forward. It used to be, for meaning
        // only (a correct reading answer staggered a due meaning +12h) - production
        // was deliberately left unstaggered since it's reseeded against reading's own
        // cadence, so a fixed push just repeated every session and production was
        // never once asked. That asymmetry, and the stagger silently resolving a
        // committed meaning task without the user answering it, are both why this was
        // replaced: the session layer now commits at most one quiz type per vocab
        // (`dedupTaskKeysByVocab` in `quizSelectors.ts`, reading > meaning >
        // production), which keeps every direction out of the same sitting uniformly
        // without mutating a genuinely-due entry's persisted schedule. See
        // docs/MODIFICATION_LOG.md.

        const settingsSlice = { enableMeaningQuiz: meaningQuizEnabled, enableProductionQuiz: productionQuizEnabled };

        // Lazy production activation (see seedProductionEntry). Answering a word in
        // an existing direction is what brings its production entry online, so the
        // backlog spreads itself over the user's own review curve instead of landing
        // in one release-day wave.
        //
        // Never onto a word that this answer just finished, though: a word already
        // mastered in every direction it was being trained in is done, and handing it
        // a fresh unmastered entry would un-graduate it and pull the user's completed
        // pile back into rotation. That is the same wave the lazy activation exists to
        // avoid, just arriving one word at a time instead of all at once.
        const masteredBeforeProduction = isVocabFullyMastered(
            { reading: updatedReading, meaning: updatedMeaning, production: undefined, usuallyKana: vocab.usuallyKana },
            settingsSlice
        );
        if (productionQuizEnabled && quizType !== 'production' && !masteredBeforeProduction) {
            updatedProduction = this.seedProductionEntry(updatedProduction, updatedMeaning, now);
        }

        // Graduation and next-review-at are always DERIVED (never hand-synced) via
        // scheduling.ts, which also correctly excludes meaning entirely when the
        // user has meaning quizzes disabled - so a word can graduate on reading
        // mastery alone instead of being stuck forever waiting on an untested meaning entry.
        const candidateVocab = { reading: updatedReading, meaning: updatedMeaning, production: updatedProduction, usuallyKana: vocab.usuallyKana };
        const finalStage = isVocabFullyMastered(candidateVocab, settingsSlice) ? 'graduated' : vocab.stage;
        const finalNextReviewAt = finalStage === 'graduated' ? null : vocabNextReviewAt(candidateVocab, settingsSlice);

        // Set retry flag on first wrong answer, scoped to the quiz type just answered.
        const needsRetry: VocabProgress['needsRetry'] = {
            ...vocab.needsRetry,
            [quizType]: result === 'wrong' && !vocab.needsRetry?.[quizType],
        };

        return {
            updated: {
                ...vocab,
                reading: updatedReading,
                meaning: updatedMeaning,
                production: updatedProduction,
                // Sync top-level fields
                stage: finalStage,
                nextReviewAt: finalNextReviewAt,
                lastReviewedAt: now,
                totalReviews: vocab.totalReviews + 1,
                consecutiveFailures: result === 'correct' ? 0 : vocab.consecutiveFailures + 1, // Keep legacy or tracking?
                needsRetry,
            },
            result,
            interval
        };
    }

    /**
     * Brings a word's production entry online the first time the word is reviewed
     * in any other direction, and returns it unchanged once it is active.
     *
     * This is the whole rollout strategy for the production quiz. A migration that
     * simply gave every existing word a due production entry would make a long-time
     * user's entire queue due at once on the day this shipped. Instead the migration
     * fills in an inert entry (dueDate null, which no due-check matches) and each
     * word activates when its own next reading or meaning review comes round, so the
     * new direction spreads over one full review cycle of the user's existing
     * schedule rather than arriving as a single wave.
     *
     * Strength is seeded from the word's meaning entry at a discount rather than from
     * zero: producing a word from English is harder than recognising it, so this is
     * well below parity, but a word the user already half-knows should not be drilled
     * from scratch. Both the ratio and the first-review delay live in
     * CONSTANTS.srs.production.
     */
    static seedProductionEntry(
        current: SRSEntry | undefined,
        meaning: SRSEntry,
        now: Date
    ): SRSEntry {
        if (isProductionActivated(current)) return current!;

        const { seedStrengthRatio, seedDelayHours } = CONSTANTS.srs.production;
        const { minMemoryStrength } = CONSTANTS.srs.formula;
        const { maxMemoryStrength } = CONSTANTS.srs.formula.mastery;

        const seeded = Math.min(
            Math.max(meaning.memoryStrength * seedStrengthRatio, minMemoryStrength),
            maxMemoryStrength
        );

        const base = current ?? newSRSEntry(meaning.difficulty);
        return {
            ...base,
            memoryStrength: seeded,
            difficulty: meaning.difficulty,
            dueDate: new Date(now.getTime() + seedDelayHours * 60 * 60 * 1000),
        };
    }

    /**
     * Credits one word's PRODUCTION entry for a correct/near answer the learner
     * produced INDIRECTLY - not on that word's own scheduled card, but as a
     * by-product of another card's cue: a grammar sentence's blank, or a
     * near-synonym typed on a DIFFERENT word's production card (issue #71 follow-up).
     * The direction is genuinely production (English meaning in, Japanese out), so
     * it feeds the production entry; the credit is discounted (strengthRatio) and
     * the log is tagged `reinforcement` so the calibration replay does not count it
     * as a scheduled production review. Latency is neutralised, since the host
     * card's single timing cannot be attributed to this word.
     *
     * A word whose production entry is not yet activated is seeded first
     * (seedProductionEntry) so it joins the rotation at its designed baseline. The
     * caller pre-filters to correct/minor_error results.
     *
     * Shared by GrammarSRSService.applyVocabReinforcement (batch, over a grammar
     * sentence's blanks) and the production synonym credit in useQuizOrchestration
     * (single word, the synonym actually typed) so the two cannot diverge.
     */
    static applyProductionReinforcement(
        vocab: VocabProgress,
        result: AnswerResult,
        now: Date,
        meaningQuizEnabled: boolean,
        productionQuizEnabled: boolean,
        growthLevel: number = 1.0,
        frequencyModifier: number = 1.0,
        strengthRatio: number = CONSTANTS.srs.production.reinforcementStrengthRatio
    ): VocabProgress {
        const neutralLatency = CONSTANTS.srs.quizProperties.production.expectedLatency;
        const seeded: VocabProgress = isProductionActivated(vocab.production)
            ? vocab
            : { ...vocab, production: this.seedProductionEntry(vocab.production, vocab.meaning, now) };

        // correctAnswer is unused because forcedResult (result) is supplied.
        const { updated } = this.applyAnswer(
            seeded, 'production', 'base', '', '',
            neutralLatency, now, result, growthLevel, frequencyModifier,
            meaningQuizEnabled, productionQuizEnabled, strengthRatio
        );

        // Tag the log this credit wrote, so the calibration's replay of the review
        // logs does not count it as a production review.
        const history = updated.production?.history ?? [];
        if (!updated.production || history.length === 0) return updated;
        return {
            ...updated,
            production: {
                ...updated.production,
                history: [...history.slice(0, -1), { ...history[history.length - 1], source: 'reinforcement' as const }],
            },
        };
    }

    /* =======================
       CORE ALGORITHM (FORMULA)
       ======================= */

    /**
     * Public so other SRS-driven activities (e.g. GrammarSRSService, which has a
     * single entry per item rather than reading/meaning) can reuse the same
     * formula instead of re-deriving it.
     */
    static calculateNextState(
        entry: SRSEntry,
        result: AnswerResult,
        latencyMs: number,
        now: Date,
        expectedLatency: number, // [NEW] dynamic expected latency parameter
        // Calibration level of this quiz type (services/calibration.ts): multiplies
        // a SUCCESSFUL answer's strength gain. It used to multiply the interval.
        growthLevel: number = 1.0,
        frequencyModifier: number = 1.0,
        // [NEW] Scales the memory-strength delta (the resultFactor * L * D gain).
        // Default 1.0 leaves vocab behaviour untouched; the Grammar activity uses
        // it to modulate a successful grammar answer's gain by how many of the
        // sentence's vocab blanks were also right (see gradeGrammarAnswers).
        strengthDeltaModifier: number = 1.0
    ): { newEntry: SRSEntry; interval: number } {

        // 1. Calculate Multipliers
        // Latency Multiplier L = clamp(expectedLatency / latency, 0.5, 1.5)
        const latencyRatio = expectedLatency / latencyMs;
        const L = Math.min(Math.max(latencyRatio, F.latency.min), F.latency.max);

        // Difficulty Multiplier D = 0.6 + 0.8 * difficulty
        const D = F.difficulty.base + F.difficulty.slope * entry.difficulty;

        // Result Factor
        const resultFactor = F.resultFactors[result];

        // 2. Calculate Gain (Delta). The calibration level scales gains only: a
        // learner ahead of the model grows strength faster, while a miss costs what
        // it always did.
        const isSuccess = result === 'correct' || result === 'minor_error';
        const delta = resultFactor * L * D * strengthDeltaModifier * (isSuccess ? growthLevel : 1);

        // 3. Update Memory Strength
        // S_new = max(S_min, S_old * (1 + Delta)) -- BUT only strictly enforce floor on failure recovery
        // Enforce safety floor to prevent infinite 0-multiplier loops (e.g. from data corruption or old mastery=0 migrations)
        const rawNewStrength = entry.memoryStrength * (1 + delta);
        const newStrength = Math.max(F.minMemoryStrength, rawNewStrength);

        // 4. Calculate Interval: t = S * lnTarget * frequency preference. The
        // calibration acts on strength (above), never here, so the interval always
        // reads straight off the strength the rings and mastery show.
        let newInterval = newStrength * F.lnTarget * frequencyModifier;

        // 5. Apply Post-processing Overrides
        if (result === 'wrong') {
            // Logic adjusted to match test dataset (Case 6 vs Case 4 consistency)
            // The dataset implies straight multiplication by 0.3, then global clamping.
            // BUT strict spec requires hard floor for wrong answers:
            // "interval = Math.max(0.5, interval * 0.3);"
            newInterval = Math.max(
                F.minIntervalAfterWrong,
                newInterval * F.postProcessIntervalMultipliers.wrong
            );
        } else if (result === 'minor_error') {
            newInterval = newInterval * F.postProcessIntervalMultipliers.minor_error;
        }

        // Strategy A: If successful, ensure at least 1 day interval (no same-day harassment)
        if (result === 'correct' || result === 'minor_error') {
            newInterval = Math.max(newInterval, F.minIntervalAfterSuccess);
        }

        // 6. Clamp Interval
        newInterval = Math.min(Math.max(newInterval, F.minInterval), F.maxInterval);

        // 7. Update Difficulty (Auto-adjustment)
        // optional but recommended in spec
        let newDifficulty = entry.difficulty;
        if (result === 'wrong') {
            newDifficulty -= 0.02;
        } else if (result === 'correct' && latencyMs < expectedLatency) {
            newDifficulty += 0.01;
        }
        newDifficulty = Math.min(Math.max(newDifficulty, 0), 1); // Clamp 0-1

        // 8. Due Date
        const dueDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

        // History Log
        const historyLog: ReviewLog = {
            date: now.getTime(),
            result,
            interval: newInterval,
            latency: latencyMs
        };

        return {
            newEntry: {
                ...entry,
                memoryStrength: newStrength,
                interval: newInterval,
                difficulty: newDifficulty,
                lastReviewedAt: now,
                dueDate: dueDate,
                history: [...entry.history, historyLog].slice(-20)
            },
            interval: newInterval
        };
    }

    /* =======================
       VOCAB AVAILABILITY
       ======================= */

    static async hasMoreLearnableVocabulary(
        progress: LearnableScope,
        settings: LearningOrderSettings
    ): Promise<boolean> {
        const count = await this.countLearnableVocabulary(
            progress,
            settings,
            1
        );

        return count > 0;
    }

    static async countLearnableVocabulary(
        progress: LearnableScope,
        settings: LearningOrderSettings,
        limit = Infinity
    ): Promise<number> {
        let count = 0;

        switch (settings.preferredLearningOrder) {
            case 'kklc': {
                if (progress.kanjiKnowledge.method !== 'kklc') return 0;

                const index = await VocabularyService.loadKKLCIndex();
                if (!index) return 0;

                for (let step = 1; step <= progress.kanjiKnowledge.step; step++) {
                    const ids = index[step] ?? [];
                    for (const id of ids) {
                        if (!progress.learningQueue.find(vocab => vocab.vocabId === id)) {
                            count++;
                            if (count >= limit) return count;
                        }
                    }
                }
                break;
            }

            case 'jlpt': {
                const index = await VocabularyService.loadJlptIndex();
                if (!index) return 0;

                // Kanji-filtered by default, like every other order (see findCandidatesJLPT) -
                // only skipped when the user opts into ignoreKnownKanjiRequirement.
                const ignoreKnownKanji = !!settings.ignoreKnownKanjiRequirement;
                const queuedIds = new Set(progress.learningQueue.map(v => v.vocabId));
                count = countJlptCandidates(
                    JLPT_LEVELS,
                    level => index[level] ?? [],
                    entry => !queuedIds.has(entry.id) && (
                        ignoreKnownKanji || entry.containedKanji.every(k => progress.kanjiKnowledge.kanjiSet.has(k))
                    ),
                    limit
                );
                if (count >= limit) return count;
                break;
            }

            case 'kanji_coverage':
            case 'frequency': {
                const index = await VocabularyService.loadFrequencyIndex();
                if (!index) return 0;

                const ignoreKnownKanji = !!settings.ignoreKnownKanjiRequirement;
                const includesUsuallyKana = orderIncludesUsuallyKana(settings.preferredLearningOrder);

                for (const entry of index) {
                    if (entry.usuallyKana && !includesUsuallyKana) continue;
                    if (progress.learningQueue.find(vocab => vocab.vocabId === entry.id)) continue;

                    const allKanjiKnown = ignoreKnownKanji || entry.containedKanji.every(k =>
                        progress.kanjiKnowledge.kanjiSet.has(k)
                    );

                    if (!allKanjiKnown) continue;

                    count++;
                    if (count >= limit) return count;
                }
                break;
            }
        }

        // The JLPT lists cover ~6.4k of 35k+ words, so they run dry. Once they do,
        // fall back to the frequency order rather than stranding the user on the
        // "exhausted" screen. Only when the JLPT pool is fully drained (count 0),
        // so the two pools - which overlap heavily - are never summed.
        if (settings.preferredLearningOrder === 'jlpt' && count === 0) {
            return this.countLearnableVocabulary(
                progress,
                { ...settings, preferredLearningOrder: 'frequency' },
                limit
            );
        }

        return count;
    }

    /* =======================
       QUEUE REFILL
       ======================= */


    /**
     * Finds the next batch of vocabulary IDs eligible for learning.
     * Does NOT create VocabProgress objects or modify the queue.
     */
    static async getNextCandidates(
        currentQueue: readonly Pick<VocabProgress, 'vocabId'>[],
        kanjiKnowledge: KanjiKnowledge,
        settings: LearningOrderSettings,
        maxToFind: number,
        ignoredIds: Set<string> = new Set(),
        // How many words learned in kana may still be offered (usuallyKanaBudget).
        // Only the frequency and JLPT orders offer them at all.
        usuallyKanaBudgetLeft: number = Number.POSITIVE_INFINITY
    ): Promise<string[]> {
        if (maxToFind <= 0) return [];

        const activeIds = new Set(currentQueue.map(v => v.vocabId));
        // Also exclude ignoredIds
        for (const id of ignoredIds) activeIds.add(id);

        const ignoreKnownKanji = !!settings.ignoreKnownKanjiRequirement;

        switch (settings.preferredLearningOrder) {
            case "kklc":
                if (kanjiKnowledge.method !== "kklc") {
                    throw new Error(
                        "Cannot use KKLC vocabulary without KKLC kanji knowledge"
                    );
                }
                return this.findCandidatesKKLC(activeIds, kanjiKnowledge.step, maxToFind);

            case "kanji_coverage":
                return this.findCandidatesKanjiCoverage(activeIds, kanjiKnowledge, maxToFind, settings.kanjiCoverageTarget || 1, ignoreKnownKanji);

            case "frequency": {
                const pacer = usuallyKanaPacer(usuallyKanaBudgetLeft);
                const found = await this.findCandidatesFrequency(activeIds, kanjiKnowledge, maxToFind, ignoreKnownKanji, pacer);
                return found.length > 0 ? found : pacer.deferred(maxToFind);
            }

            case "jlpt": {
                const pacer = usuallyKanaPacer(usuallyKanaBudgetLeft);
                const found = await this.findCandidatesJLPT(activeIds, kanjiKnowledge, maxToFind, ignoreKnownKanji, pacer);
                return found.length > 0 ? found : pacer.deferred(maxToFind);
            }
        }
    }

    /**
     * Creates a new VocabProgress object for a given vocab.
     * Use this when the user explicitly accepts a new vocabulary item.
     *
     * @param vocab The vocabulary to learn: its id, and whether it is learned in kana
     * @param difficultyOffset Optional difficulty adjustment based on user performance
     */
    static createVocabProgress(vocab: Pick<Vocabulary, 'id' | 'usuallyKana'>, difficultyOffset = 0): VocabProgress {
        // Strategy D + Dynamic: InitialDifficulty (0.5) + Offset
        const baseDiff = CONSTANTS.srs.formula.initialDifficulty;
        const finalDiff = Math.min(Math.max(baseDiff + difficultyOffset, 0.1), 1.0);

        return {
            vocabId: vocab.id,
            stage: 'learning',
            introductionAt: null,
            nextReviewAt: null,
            lastReviewedAt: null,
            totalReviews: 0,
            consecutiveFailures: 0,
            reading: newSRSEntry(finalDiff),
            meaning: newSRSEntry(finalDiff),
            production: newSRSEntry(finalDiff),
            usuallyKana: vocab.usuallyKana === true,
        };
    }

    /* =======================
       INTERNAL FILLERS
       ======================= */

    private static async findCandidatesKKLC(
        activeIds: Set<string>,
        kklcKanjiStep: number,
        maxToFind: number
    ): Promise<string[]> {
        const index = await VocabularyService.loadKKLCIndex();
        if (!index) return [];

        const candidates: string[] = [];

        for (let step = 1; step <= kklcKanjiStep; step++) {
            const ids = index[step] ?? [];

            for (const id of ids) {
                if (candidates.length >= maxToFind) return candidates;
                if (!activeIds.has(id)) {
                    candidates.push(id);
                }
            }
        }
        return candidates;
    }

    private static async findCandidatesFrequency(
        activeIds: Set<string>,
        kanjiKnowledge: KanjiKnowledge,
        maxToFind: number,
        ignoreKnownKanji: boolean = false,
        pacer: Pick<UsuallyKanaPacer, 'admit'> = usuallyKanaPacer(Number.POSITIVE_INFINITY)
    ): Promise<string[]> {
        const index = await VocabularyService.loadFrequencyIndex();
        if (!index) return [];

        const candidates: string[] = [];

        for (const entry of index) {
            if (candidates.length >= maxToFind) break;
            if (activeIds.has(entry.id)) continue;

            const allKanjiKnown = ignoreKnownKanji || entry.containedKanji.every(k =>
                kanjiKnowledge.kanjiSet.has(k)
            );

            if (allKanjiKnown && pacer.admit(entry)) {
                candidates.push(entry.id);
            }
        }

        return candidates;
    }

    /**
     * JLPT order: walk N5 -> N1, frequency-ordered within each level.
     *
     * Kanji-filtered by default, same as every other order - only skipped when
     * `settings.ignoreKnownKanjiRequirement` is on. The mode's defining feature is
     * following the official level lists exactly (a user studying for a specific
     * JLPT sitting covers that level's vocabulary as published); enforcing known
     * kanji by default makes that combine with the app's kanji-aware learning goal
     * instead of overriding it, while the opt-in toggle still allows the old
     * unconditional behavior for anyone who wants to cover a level's list exactly
     * regardless of kanji already studied.
     */
    private static async findCandidatesJLPT(
        activeIds: Set<string>,
        kanjiKnowledge: KanjiKnowledge,
        maxToFind: number,
        ignoreKnownKanji: boolean = false,
        pacer: Pick<UsuallyKanaPacer, 'admit'> = usuallyKanaPacer(Number.POSITIVE_INFINITY)
    ): Promise<string[]> {
        const index = await VocabularyService.loadJlptIndex();
        if (!index) return [];

        const candidates = collectJlptCandidates(
            JLPT_LEVELS,
            level => index[level] ?? [],
            entry => entry.id,
            entry => !activeIds.has(entry.id) && (
                ignoreKnownKanji || entry.containedKanji.every(k => kanjiKnowledge.kanjiSet.has(k))
            ) && pacer.admit(entry),
            maxToFind
        );

        // JLPT lists exhausted (~6.4k words) - keep the user learning by falling
        // back to the frequency order for anything beyond N1.
        if (candidates.length < maxToFind) {
            const filler = await this.findCandidatesFrequency(
                new Set([...activeIds, ...candidates]),
                kanjiKnowledge,
                maxToFind - candidates.length,
                ignoreKnownKanji,
                pacer
            );
            candidates.push(...filler);
        }

        return candidates;
    }

    private static async findCandidatesKanjiCoverage(
        activeIds: Set<string>,
        kanjiKnowledge: KanjiKnowledge,
        maxToFind: number,
        targetCoverage: number,
        ignoreKnownKanji: boolean = false
    ): Promise<string[]> {
        const index = await VocabularyService.loadFrequencyIndex();
        if (!index) return [];

        const candidates: string[] = [];

        // 1. Calculate how many times each kanji is covered in the active vocabulary
        const coveredKanjiCount = new Map<string, number>();
        for (const k of kanjiKnowledge.kanjiSet) {
            coveredKanjiCount.set(k, 0);
        }

        // We need a fast lookup for kanji by vocab ID
        const idToKanji = new Map<string, string[]>();
        for (const entry of index) {
            idToKanji.set(entry.id, entry.containedKanji);
        }

        for (const id of activeIds) {
            const kanjis = idToKanji.get(id) || [];
            for (const k of kanjis) {
                if (coveredKanjiCount.has(k)) {
                    coveredKanjiCount.set(k, coveredKanjiCount.get(k)! + 1);
                }
            }
        }

        // 2. Identify kanji that haven't met the target coverage yet
        const uncoveredKanji = new Set<string>();
        for (const [k, count] of coveredKanjiCount.entries()) {
            if (count < targetCoverage) {
                uncoveredKanji.add(k);
            }
        }

        // 3. Pre-filter words that are learnable and not already active
        const learnableUnusedWords = [];
        for (let rank = 0; rank < index.length; rank++) {
            const entry = index[rank];
            if (activeIds.has(entry.id)) continue;
            // A kanji-driven order: words learned in kana have no place in it (orderIncludesUsuallyKana).
            if (entry.usuallyKana) continue;

            const allKanjiKnown = ignoreKnownKanji || entry.containedKanji.every((k) => kanjiKnowledge.kanjiSet.has(k));
            if (allKanjiKnown) {
                learnableUnusedWords.push({ entry, rank });
            }
        }

        const KANJI_COVERAGE_RANK_VALUE = 2500;

        // 4. Find words that maximize a blended score of kanji coverage vs frequency penalty
        while (candidates.length < maxToFind && uncoveredKanji.size > 0) {
            let bestEntry = null;
            let maxScore = -Infinity;

            for (const { entry, rank } of learnableUnusedWords) {
                if (candidates.includes(entry.id)) continue;

                let coverage = 0;
                for (const k of entry.containedKanji) {
                    if (uncoveredKanji.has(k)) coverage++;
                }

                if (coverage > 0) {
                    const score = coverage * KANJI_COVERAGE_RANK_VALUE - rank;
                    if (score > maxScore) {
                        maxScore = score;
                        bestEntry = entry;
                    }
                }
            }

            if (!bestEntry) break;

            candidates.push(bestEntry.id);
            // Re-evaluate coverage for the remaining capacity
            for (const k of bestEntry.containedKanji) {
                if (uncoveredKanji.has(k)) {
                    const newCount = (coveredKanjiCount.get(k) || 0) + 1;
                    coveredKanjiCount.set(k, newCount);
                    if (newCount >= targetCoverage) {
                        uncoveredKanji.delete(k);
                    }
                }
            }
        }

        // 5. Fallback: Filling remaining slots by pure frequency
        if (candidates.length < maxToFind) {
            for (const { entry } of learnableUnusedWords) {
                if (candidates.length >= maxToFind) break;
                if (!candidates.includes(entry.id)) {
                    candidates.push(entry.id);
                }
            }
        }

        return candidates;
    }

    /* =======================
       HELPERS
       ======================= */

    static applyVocabIntroChoice(
        progress: VocabProgress,
        choice: 'learn' | 'skip',
        settings?: Pick<UserSettings, 'enableMeaningQuiz' | 'enableProductionQuiz'>
    ): VocabProgress {
        const updated: VocabProgress = {
            ...progress,
            introductionAt: new Date(),
        };

        if (choice === 'skip') {
            // User feedback: Skip means "Fully Mastered"
            const maxS = CONSTANTS.srs.formula.mastery.maxMemoryStrength;
            const maxIntervalDays = CONSTANTS.srs.formula.maxInterval;

            updated.reading.memoryStrength = maxS;
            updated.reading.interval = maxIntervalDays;
            updated.reading.dueDate = null; // No review scheduled (effectively)
            updated.reading.lastReviewedAt = new Date();

            updated.meaning.memoryStrength = maxS;
            updated.meaning.interval = maxIntervalDays;
            updated.meaning.dueDate = null; // [BUGFIX] Ensure it is cleared so chart ignores it

            // Production must be mastered here too. Skip is how a user says "I already
            // know this word", and it is the one path that writes 'graduated' directly.
            // Leaving production un-mastered would make isVocabFullyMastered false for
            // every word ever skipped, resurrecting the whole skipped pile as production
            // reviews the moment this quiz type shipped.
            updated.production = {
                ...(updated.production ?? newSRSEntry(updated.reading.difficulty)),
                memoryStrength: maxS,
                interval: maxIntervalDays,
                dueDate: null,
                lastReviewedAt: new Date(),
            };

            updated.nextReviewAt = null; // No review calculation needed
            updated.stage = 'graduated';
        } else {
            // CHOICE LEARNING:
            // Set initial due date to NOW for reading.
            // Stagger meaning by 12 hours so it isn't asked immediately after reading in the same session.
            // Production sits one step further out again: it is the hardest direction,
            // and asking it before the word has been recalled even once is just a guess.
            const now = new Date();
            updated.nextReviewAt = now;
            updated.reading.dueDate = now;
            updated.meaning.dueDate = new Date(now.getTime() + 12 * 60 * 60 * 1000);
            updated.production = {
                ...(updated.production ?? newSRSEntry(updated.reading.difficulty)),
                dueDate: new Date(now.getTime() + CONSTANTS.srs.production.seedDelayHours * 60 * 60 * 1000),
            };

            // A word learned in kana has no reading quiz: its first review is the
            // first direction that applies, due now in reading's place.
            // With meaning and production both off no direction applies at all, so
            // the word has nothing to learn and graduates as it is added.
            const first = introQuizType(updated, settings);
            if (first !== 'reading') {
                updated.reading.dueDate = null;
                if (first === 'meaning') updated.meaning.dueDate = now;
                if (first === 'production') updated.production = { ...updated.production, dueDate: now };
                if (first === null) {
                    updated.nextReviewAt = null;
                    updated.stage = 'graduated';
                }
            }
        }

        return updated;
    }

    // Per-quiz-type calibration (the old single "adaptive" level) lives in
    // services/calibration.ts.
}
