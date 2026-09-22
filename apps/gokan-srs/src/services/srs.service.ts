// src/services/srs.service.ts
import type { ReviewLog, SRSEntry, VocabProgress, Vocabulary } from '../models/vocabulary.model';
import { CONSTANTS } from '../commons/constants';
import { VocabularyService } from './vocabulary.service';
import type { KanjiKnowledge, UserProgress, UserSettings } from '../models/user.model';
import { isVocabFullyMastered, vocabNextReviewAt, newSRSEntry, isProductionActivated } from './scheduling';
import type { QuizType } from '../utils/srs.utils';
import { JLPT_LEVELS } from '../models/index.model';
import { collectJlptCandidates, countJlptCandidates } from './jlptWalk';


export type AnswerResult = 'correct' | 'minor_error' | 'wrong' | 'pass';

const F = CONSTANTS.srs.formula;

export class SRSService {

    /* =======================
       ANSWER EVALUATION
       ======================= */

    /**
     * Checks user input against ALL acceptable readings.
     * Returns the best result found (Correct > Minor Error > Wrong).
     */
    static evaluateAnswer(
        userInput: string,
        readings: { primary: string; alternatives: string[] }
    ): { result: AnswerResult; matchedAnswer: string } {
        const allReadings = [readings.primary, ...readings.alternatives];
        let bestResult: AnswerResult = 'wrong';
        let bestMatch = readings.primary;

        for (const reading of allReadings) {
            const res = this.analyzeError(userInput, reading);

            if (res === 'pass') {
                return { result: 'pass', matchedAnswer: bestMatch };
            }

            if (res === 'correct') {
                return { result: 'correct', matchedAnswer: reading };
            }

            if (res === 'minor_error') {
                bestResult = 'minor_error';
                bestMatch = reading;
            }
        }

        return { result: bestResult, matchedAnswer: bestMatch };
    }

    /**
     * Checks user input against ALL acceptable meanings (glosses).
     * Returns the best result found.
     */
    static evaluateMeaning(
        userInput: string,
        meanings: string[]
    ): { result: AnswerResult; matchedAnswer: string } {
        let bestResult: AnswerResult = 'wrong';
        let bestMatch = meanings[0] || '';

        // Pre-normalize user input once for efficiency
        const normalizedUser = this.normalizeMeaning(userInput);

        if (normalizedUser === 'pass' || normalizedUser === '') {
            return { result: normalizedUser === 'pass' ? 'pass' : 'wrong', matchedAnswer: bestMatch };
        }

        for (const meaning of meanings) {
            // [FIX] pre-strip parentheses iteratively so that commas inside them (e.g. "go (to, from)") don't break splitting
            let cleanMeaning = meaning;
            let prev;
            do {
                prev = cleanMeaning;
                cleanMeaning = cleanMeaning.replace(/\s*\([^()]*\)\s*/g, " ");
            } while (cleanMeaning !== prev);

            // Split meaning by separators (comma, semicolon)
            // e.g. "answer; reply; solution"
            // [FIX] Split by comma only if not followed by a digit to avoid splitting numbers like 10,000
            const parts = cleanMeaning.split(/;\s*|,(?!\d)\s*/).map(p => p.trim()).filter(p => p.length > 0);

            for (const part of parts) {
                const normalizedExpected = this.normalizeMeaning(part);
                const res = this.compareMeaning(normalizedUser, normalizedExpected);

                if (res === 'correct') {
                    return { result: 'correct', matchedAnswer: part };
                }

                if (res === 'minor_error' && bestResult !== 'minor_error') {
                    bestResult = 'minor_error';
                    bestMatch = part;
                }
            }
        }

        return { result: bestResult, matchedAnswer: bestMatch };
    }

    /**
     * Checks a production answer (English prompt, Japanese reading answer)
     * against the FULL accept-list the way `computeBlankPlan` (`grammarSelectors.ts`)
     * already builds its own: the reading primary and alternatives, plus
     * `writtenForm.kanji` and its alternatives, plus any `mergedVocabs` readings
     * (issue #71 Part A). Previously this graded against `evaluateAnswer` on the
     * reading alone, so a correct kanji answer (必ず for かならず) graded `wrong`.
     *
     * Written forms are matched EXACTLY (after the same trim/whitespace
     * normalization `analyzeError` applies), never through `evaluateAnswer`'s
     * Levenshtein path: a distance-1 typo between two kana strings is a typo,
     * but between two kanji strings it is usually a completely different word,
     * so fuzzy matching is actively wrong there. Reading forms keep the existing
     * fuzzy behavior via `evaluateAnswer`, which also covers the literal "pass".
     *
     * Shared by both production quiz cards (gloss-prompt and the sentence-cloze
     * card from issue #72) - both set `quizType: 'production'`, so this is the
     * single grading path either one goes through.
     */
    static evaluateProductionAnswer(
        userInput: string,
        vocab: Pick<Vocabulary, 'reading' | 'writtenForm' | 'mergedVocabs'>
    ): { result: AnswerResult; matchedAnswer: string } {
        const normalize = (s: string) => s.trim().replace(/\s+/g, '');
        const normalizedInput = normalize(userInput);

        const writtenForms = [vocab.writtenForm.kanji, ...vocab.writtenForm.alternatives];
        for (const form of writtenForms) {
            if (normalizedInput === normalize(form)) {
                return { result: 'correct', matchedAnswer: form };
            }
        }

        const readingAlternatives = [
            ...vocab.reading.alternatives,
            ...(vocab.mergedVocabs?.map(m => m.originalPrimaryReading) ?? []),
        ];
        return this.evaluateAnswer(userInput, { primary: vocab.reading.primary, alternatives: readingAlternatives });
    }

    private static normalizeMeaning(text: string): string {
        // 1. Lowercase
        let s = text.toLowerCase().trim();

        // 2a. Remove content within parentheses (iteratively for nested parens)
        // This must be done BEFORE removing punctuation so we can identify the parentheses
        let prev;
        do {
            prev = s;
            s = s.replace(/\s*\([^()]*\)\s*/g, " ");
        } while (s !== prev);

        // 3. Remove punctuation
        s = s.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

        // 4. Remove stop words from START of string
        // "to eat" -> "eat"
        // "a cat" -> "cat"
        // "to be seen" -> "seen"
        s = s.replace(/^(to\s+be|to|be|a|an|the)\s+/g, "");

        // 5. Collapse spaces
        s = s.replace(/\s+/g, " ");

        return s.trim();
    }

    private static compareMeaning(user: string, expected: string): AnswerResult {
        if (user === expected) return 'correct';

        // Partial match check (e.g., 'pain' for 'painful' or vice-versa)
        if (user.length >= 3 && (expected.includes(user) || user.includes(expected))) {
            if (Math.abs(user.length - expected.length) <= 5) {
                return 'minor_error';
            }
        }

        // Fuzzy check
        const dist = this.levenshtein(user, expected);

        // Allow distance 1 for short words (len>=3), distance 2 for long (len>=6)
        // But strict for very short words (len < 3)
        let allowed = 0;
        if (expected.length >= 6) allowed = 2;
        else if (expected.length >= 3) allowed = 1;

        if (dist <= allowed) return 'minor_error';

        return 'wrong';
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
        intervalModifier: number = 1.0, // Adaptive modifier
        frequencyModifier: number = 1.0, // User preference modifier
        meaningQuizEnabled: boolean = true, // Whether meaning quizzes are active for this user
        productionQuizEnabled: boolean = true, // Whether production quizzes are active for this user
        // Scales the memory-strength gain, mirroring the parameter calculateNextState
        // already takes and GrammarSRSService.applyAnswer already forwards. Used to
        // credit an exercise that genuinely trains a direction, but under easier
        // conditions than that direction's own quiz (see applyVocabReinforcement).
        strengthDeltaModifier: number = 1.0
    ): { updated: VocabProgress; result: AnswerResult, interval: number } {
        const result = forcedResult ?? this.analyzeError(userAnswer, correctAnswer);

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

        const { newEntry, interval } = this.calculateNextState(currentEntry, result, latencyMs, now, expectedLatency, intervalModifier, frequencyModifier, strengthDeltaModifier);

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
            { reading: updatedReading, meaning: updatedMeaning, production: undefined },
            settingsSlice
        );
        if (productionQuizEnabled && quizType !== 'production' && !masteredBeforeProduction) {
            updatedProduction = this.seedProductionEntry(updatedProduction, updatedMeaning, now);
        }

        // Graduation and next-review-at are always DERIVED (never hand-synced) via
        // scheduling.ts, which also correctly excludes meaning entirely when the
        // user has meaning quizzes disabled - so a word can graduate on reading
        // mastery alone instead of being stuck forever waiting on an untested meaning entry.
        const candidateVocab = { reading: updatedReading, meaning: updatedMeaning, production: updatedProduction };
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
        intervalModifier: number = 1.0,
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

        // 2. Calculate Gain (Delta)
        const delta = resultFactor * L * D * strengthDeltaModifier;

        // 3. Update Memory Strength
        // S_new = max(S_min, S_old * (1 + Delta)) -- BUT only strictly enforce floor on failure recovery
        // Enforce safety floor to prevent infinite 0-multiplier loops (e.g. from data corruption or old mastery=0 migrations)
        const rawNewStrength = entry.memoryStrength * (1 + delta);
        const newStrength = Math.max(F.minMemoryStrength, rawNewStrength);

        // 4. Calculate Interval
        // t = S * 0.28768 * intervalModifier (Adaptive Scaling)
        // We apply the modifier to the INTERVAL, not the memory strength.
        // This effectively demands higher memory strength for the same interval if modifier > 1?
        // No, modifier > 1 means LONGER interval for same strength?
        // Wait, if user is too good, we want HARDER.
        // Harder = Longer Interval? Yes, push them further.
        // So modifier > 1.0 is correct for "Hard Mode".
        // t = S * C * Mod
        let newInterval = newStrength * F.lnTarget * intervalModifier * frequencyModifier;

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

    static analyzeError(user: string, expected: string): AnswerResult {
        const u = user.trim().replace(/\s+/g, '');
        const e = expected.trim().replace(/\s+/g, '');

        if (u === e) return 'correct';
        if (u === 'pass') return 'pass';

        // Minor error check
        // Rule: Levenshtein distance <= 1 AND length relative check
        // User Examples:
        // こたへ (subs) -> minor
        // こたぇ (subs) -> minor
        // こたええ (insert) -> minor
        // こーたえ (insert) -> minor
        // こえ (delete) -> wrong

        // This implies we allow substitutions and insertions (user >= expected), but NOT deletions (user < expected).
        // Or strictly: mora count check. For now, char length is a sufficient proxy for these examples.

        const dist = this.levenshtein(u, e);

        // Allow distance 1 IF it's not a pure deletion that shortens the word effectively below target
        // The user example 'こえ' (2 chars) vs 'こたえ' (3 chars) is WRONG.
        // 'こーたえ' (4 chars) vs 'こたえ' (3 chars) is MINOR.
        // So: dist <= 1 AND u.length >= e.length

        if (dist <= 1 && u.length >= e.length) {
            return 'minor_error';
        }

        return 'wrong';
    }



    /**
     * Standard Levenshtein Distance
     */
    private static levenshtein(a: string, b: string): number {
        const matrix = [];

        // 1. Initialize matrix
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        // 2. Fill matrix
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(
                            matrix[i][j - 1] + 1, // insertion
                            matrix[i - 1][j] + 1 // deletion
                        )
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }


    /* =======================
       VOCAB AVAILABILITY
       ======================= */

    static async hasMoreLearnableVocabulary(
        progress: UserProgress,
        settings: UserSettings
    ): Promise<boolean> {
        const count = await this.countLearnableVocabulary(
            progress,
            settings,
            1
        );

        return count > 0;
    }

    static async countLearnableVocabulary(
        progress: UserProgress,
        settings: UserSettings,
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

                for (const entry of index) {
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
        currentQueue: VocabProgress[],
        kanjiKnowledge: KanjiKnowledge,
        settings: UserSettings,
        maxToFind: number,
        ignoredIds: Set<string> = new Set()
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

            case "frequency":
                return this.findCandidatesFrequency(activeIds, kanjiKnowledge, maxToFind, ignoreKnownKanji);

            case "jlpt":
                return this.findCandidatesJLPT(activeIds, kanjiKnowledge, maxToFind, ignoreKnownKanji);
        }
    }

    /**
     * Creates a new VocabProgress object for a given vocab ID.
     * Use this when the user explicitly accepts a new vocabulary item.
     *
     * @param vocabId ID of the vocabulary to learn
     * @param difficultyOffset Optional difficulty adjustment based on user performance
     */
    static createVocabProgress(vocabId: string, difficultyOffset = 0): VocabProgress {
        // Strategy D + Dynamic: InitialDifficulty (0.5) + Offset
        const baseDiff = CONSTANTS.srs.formula.initialDifficulty;
        const finalDiff = Math.min(Math.max(baseDiff + difficultyOffset, 0.1), 1.0);

        return {
            vocabId,
            stage: 'learning',
            introductionAt: null,
            nextReviewAt: null,
            lastReviewedAt: null,
            totalReviews: 0,
            consecutiveFailures: 0,
            reading: newSRSEntry(finalDiff),
            meaning: newSRSEntry(finalDiff),
            production: newSRSEntry(finalDiff)
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
        ignoreKnownKanji: boolean = false
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

            if (allKanjiKnown) {
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
        ignoreKnownKanji: boolean = false
    ): Promise<string[]> {
        const index = await VocabularyService.loadJlptIndex();
        if (!index) return [];

        const candidates = collectJlptCandidates(
            JLPT_LEVELS,
            level => index[level] ?? [],
            entry => entry.id,
            entry => !activeIds.has(entry.id) && (
                ignoreKnownKanji || entry.containedKanji.every(k => kanjiKnowledge.kanjiSet.has(k))
            ),
            maxToFind
        );

        // JLPT lists exhausted (~6.4k words) - keep the user learning by falling
        // back to the frequency order for anything beyond N1.
        if (candidates.length < maxToFind) {
            const filler = await this.findCandidatesFrequency(
                new Set([...activeIds, ...candidates]),
                kanjiKnowledge,
                maxToFind - candidates.length,
                ignoreKnownKanji
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
        choice: 'learn' | 'skip'
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
        }

        return updated;
    }

    /**
     * Calculates user's recent win rate from the queue.
     * Uses the last 20 reviews of each item in the queue.
     */
    static calculateRecentWinRate(queue: VocabProgress[]): number {
        let totalReviews = 0;
        let successfulReviews = 0;

        for (const vocab of queue) {
            // Helper to count history
            const processHistory = (history: ReviewLog[]) => {
                for (const log of history) {
                    totalReviews++;
                    if (log.result === 'correct' || log.result === 'minor_error') {
                        successfulReviews++;
                    }
                }
            };

            processHistory(vocab.reading.history);
            // processHistory(vocab.meaning.history); // Uncomment if we track meaning
        }

        if (totalReviews === 0) return 0.75; // Default assumption

        return successfulReviews / totalReviews;
    }

    /* =======================
       ADAPTIVE SRS LOGIC
       ======================= */

    /**
     * Updates the user's global difficulty level based on review performance.
     * Should be called after every review.
     */
    static updateAdaptiveStats(
        currentStats: { level: number; history: boolean[] },
        result: AnswerResult
    ): { level: number; history: boolean[] } {
        const { historySize, increaseThreshold, decreaseThreshold, levelStep, minLevel, maxLevel } = CONSTANTS.srs.adaptive;

        // 1. Update History
        const isSuccess = result === 'correct' || result === 'minor_error';
        const newHistory = [...currentStats.history, isSuccess].slice(-historySize);

        // 2. Calculate Rolling Win Rate
        // Only calculate if we have enough history to be statistically meaningful?
        // Let's start adapting immediately but maybe damp it?
        // For now, simple average of what we have.
        const successCount = newHistory.filter(Boolean).length;
        const winRate = successCount / newHistory.length;

        // 3. Adjust Level
        let newLevel = currentStats.level;

        // Only adjust if history is at least 10 items to prevent wild swings at start
        if (newHistory.length >= 10) {
            if (winRate > increaseThreshold) {
                // Too easy -> Increase difficulty (Multiplier UP)
                newLevel = Math.min(newLevel + levelStep, maxLevel);
            } else if (winRate < decreaseThreshold) {
                // Too hard -> Decrease difficulty (Multiplier DOWN)
                newLevel = Math.max(newLevel - levelStep, minLevel);
            }
        }

        return {
            level: Number(newLevel.toFixed(2)), // Clean float
            history: newHistory
        };
    }

}
