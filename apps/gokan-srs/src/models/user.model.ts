import type { VocabProgress } from "./vocabulary.model";
import type { GrammarProgress } from "./grammar.model";
import type { WatchedEpisode } from "./media.model";

export interface UserProgress {
    kanjiKnowledge: KanjiKnowledge;

    /**
     * All vocab ever introduced to the user.
     * Includes:
     * - learning vocab
     * - review vocab
     * - mastered vocab (mastery === 100)
     */
    learningQueue: VocabProgress[];

    /** All grammar points ever introduced to the user, independent of learningQueue. */
    grammarQueue: GrammarProgress[];

    /**
     * Ids of grammar chapters whose end-of-chapter review step has already been
     * shown (or, for a chapter with no anchored contrast lessons, silently
     * acknowledged as complete). Purely additive like grammarQueue - a chapter
     * is added here once every one of its teachable points has been introduced,
     * so the step doesn't re-fire on a later session. See GrammarChapter and
     * GrammarSRSService.getCurrentChapter: the CURRENT chapter is always
     * derived from the teaching order, never stored, but "has this chapter's
     * step already been shown" has to be remembered somewhere, or it would
     * re-fire forever.
     */
    completedChapters: string[];

    /**
     * The listening library's per-episode marks, keyed `${mediaId}:${episodeNumber}`
     * (see episodeKey). Optional and deliberately not defaulted: progress that never
     * used the library carries no field, so adding it changed nothing for anyone.
     * Merged per episode, newest mark wins (mergeWatchedEpisodes).
     */
    watchedEpisodes?: Record<string, WatchedEpisode>;

    /**
     * Vocab ids whose compiled data no longer exists in the dataset (e.g. a word
     * the dataset build dropped), discovered when a load returns not-found. A
     * tombstone set: the entry is removed from learningQueue and recorded here so
     * it is never served again, AND stays excluded if it respawns - a Drive merge
     * unions learningQueue and would otherwise re-add a word another device still
     * carries. Merged as a union (mergeProgress) and re-applied to learningQueue
     * on every load (migrateUserProgress) and after every merge, so the invariant
     * "learningQueue contains no retired id" always holds. Optional and not in
     * DEFAULT_PROGRESS, additive like watchedEpisodes - progress that never hit a
     * retired word carries no field. See VocabNotFoundError / RETIRE_VOCAB.
     */
    retiredVocabIds?: string[];

    /**
     * Counters for progress
     * - learned: queue items (not just intro'd)
     * - graduated: longer interval items
     */
    stats: {
        /** Number of new vocab introduced today */
        newLearnedToday: number;

        /** Total vocab that reached mastery === 100 */
        totalLearned: number;

        totalReviews: number;
    };

    /** Allow user to bypass daily new vocab limit */
    dailyOverride: boolean;

    /** Data format version for migration tracking */
    _formatVersion?: number;

    /**
     * @deprecated Superseded by `calibration`. Its level used to stretch every
     * interval; the calibration now grows memory strength instead (see
     * services/calibration.ts). Kept, untouched, only so a tab still running an
     * older build does not choke on its absence.
     */
    adaptive: AdaptiveStats;

    /**
     * Per-quiz-type SRS calibration: each quiz type adapts its strength growth to
     * its OWN recent win rate. Optional on the type because progress saved before
     * it existed has none; hydration fills in the default.
     */
    calibration?: Calibration;
}

/** Every quiz type that runs through the SRS formula, vocab and grammar alike. */
export type CalibratedQuizType = 'reading' | 'meaning' | 'production' | 'grammar';

export const CALIBRATED_QUIZ_TYPES: readonly CalibratedQuizType[] = ['reading', 'meaning', 'production', 'grammar'];

export type Calibration = Record<CalibratedQuizType, AdaptiveStats>;

export interface AdaptiveStats {
    /**
     * Strength growth multiplier (default 1.0) applied to a successful answer's
     * gain. Rises while this quiz type's recent win rate is above target, falls
     * while below. (For the deprecated `adaptive` field it was an interval
     * multiplier instead.)
     */
    level: number;

    /**
     * Rolling history of recent review results.
     * true = correct/minor_error (retention success)
     * false = wrong/pass (retention failure)
     */
    history: boolean[];
}

export type KanjiLearningMethod = 'kklc' | 'rtk' | 'jlpt' | 'custom';

export interface KanjiKnowledge {
    method: KanjiLearningMethod;
    step: number;          // e.g. KKLC step reached
    kanjiSet: Set<string>; // actual kanji characters
}

export type LearningOrder =
    | 'kanji_coverage'
    | 'frequency'
    | 'kklc'
    | 'jlpt';

export type MeaningContextThreshold = 'early' | 'normal' | 'late';

export interface UserSettings {
    preferredLearningOrder: LearningOrder;
    kanjiCoverageTarget?: number;
    enableMeaningQuiz: boolean;
    /** Production quiz (English meaning prompt, Japanese reading answer). Defaults to true when absent. */
    enableProductionQuiz?: boolean;
    learningFrequency: 'high' | 'medium' | 'low';
    geminiApiKey?: string;
    enableGeminiContext?: boolean;
    alwaysUseAiForMeaningContext?: boolean;
    /**
     * @deprecated Superseded by `meaningContextThresholdPoints`. Kept, untouched,
     * so a tab on an older build (or a Drive-synced settings payload written by
     * one) still has a value to fall back to - see
     * `srs.utils.ts`'s `meaningContextThresholdOf`.
     */
    meaningContextThreshold?: MeaningContextThreshold;
    /**
     * The meaning-ring value (0-200, in steps of 10) at which meaning quizzes
     * switch from the bare word to sentence/context mode. 0 = context from the
     * first meaning review on; 200 = only once the word is mastered (mastered
     * words are retired, so effectively never). Resolved via
     * `meaningContextThresholdOf`, which falls back to the legacy
     * `meaningContextThreshold` enum, then 50, when unset.
     */
    meaningContextThresholdPoints?: number;
    /**
     * When true, drops the "all contained kanji must already be known" filter for
     * the `frequency`/`kanji_coverage`/`jlpt` orders. `jlpt` is kanji-filtered by
     * default like every other order; this is the opt-in escape hatch for
     * following the official level lists exactly regardless of known kanji. Has
     * no effect on `kklc` (gated by step, not by kanji set). Default false
     * (kanji-aware filtering stays on for every order).
     */
    ignoreKnownKanjiRequirement?: boolean;
    /**
     * Increment used by the known-kanji count stepper on the profile page (the
     * "+7 / -7" buttons). Purely a UI preference, but it lives here rather than
     * in localStorage so it follows the user across devices like every other
     * setting. Default `CONSTANTS.setup.defaultKanjiCountStep`.
     */
    kanjiCountStep?: number;
    /**
     * The listening library's genre filter: the categories the learner wants to
     * see, e.g. ["Comedy", "Slice of Life"]. Empty or absent shows every title.
     */
    listeningGenres?: string[];
}

export const DEFAULT_SETTINGS: UserSettings = {
    preferredLearningOrder: 'frequency',
    kanjiCoverageTarget: 1,
    enableMeaningQuiz: true,
    enableProductionQuiz: true,
    learningFrequency: 'medium',
    enableGeminiContext: false,
    alwaysUseAiForMeaningContext: true,
    meaningContextThreshold: 'normal',
    // meaningContextThresholdPoints is deliberately NOT defaulted here. Stored
    // and Drive settings load as { ...DEFAULT_SETTINGS, ...stored }, so a default
    // would give every existing user points = 50, which wins over their legacy
    // preset (early 30 / late 70) and silently moves it. Unset, it falls back to
    // that preset, then to 50 (meaningContextThresholdOf).
    ignoreKnownKanjiRequirement: false,
    kanjiCountStep: 10,
};

/** Every quiz type at level 1 with an empty window: where calibration starts. */
export const defaultCalibration = (): Calibration => ({
    reading: { level: 1.0, history: [] },
    meaning: { level: 1.0, history: [] },
    production: { level: 1.0, history: [] },
    grammar: { level: 1.0, history: [] },
});

export const DEFAULT_PROGRESS: Omit<UserProgress, 'kanjiKnowledge'> = {
    stats: {
        newLearnedToday: 0,
        totalLearned: 0,
        totalReviews: 0,
    },
    learningQueue: [],
    grammarQueue: [],
    completedChapters: [],
    dailyOverride: false,
    adaptive: {
        level: 1.0,
        history: []
    },
    calibration: defaultCalibration(),
};