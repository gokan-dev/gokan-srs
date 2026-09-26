import type { VocabProgress } from "./vocabulary.model";
import type { GrammarProgress } from "./grammar.model";

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

    /** Adaptive SRS Stats */
    adaptive: AdaptiveStats;
}

export interface AdaptiveStats {
    /** 
     * Global interval modifier (default 1.0).
     * < 1.0: Easymode (shorter intervals)
     * > 1.0: Hardmode (longer intervals)
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
    /** Mastery threshold at which meaning quizzes switch to sentence/context mode */
    meaningContextThreshold?: MeaningContextThreshold;
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
    ignoreKnownKanjiRequirement: false,
    kanjiCountStep: 10,
};

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
    }
}