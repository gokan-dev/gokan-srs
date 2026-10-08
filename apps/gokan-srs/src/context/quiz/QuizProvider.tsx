import React, { useReducer } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_SETTINGS } from '../../models/user.model';
import type { VocabProgress } from '../../models/vocabulary.model';
import type { GrammarProgress } from '../../models/grammar.model';
import { StorageService } from '../../services/storage.service';
import type { SessionState } from '../../models/state.model';
import { QuizContext } from '../useQuiz';
import { initialState, quizReducer } from './quizReducer';
import type { QuizState } from './quizReducer';
import type { SessionStats, NextSessionPreview } from './quizSelectors';
import { useQuizOrchestration, type QuizActions } from './useQuizOrchestration';
import { useGrammarOrchestration } from './useGrammarOrchestration';
import type { GrammarActions, PendingGrammarChapterLesson } from './useGrammarOrchestration';
import type { ExerciseTurnApi } from './useExerciseTurn';
import type { ExerciseHost } from './exerciseReducer';
import type { GrammarSessionState, NextGrammarSessionPreview, GrammarSessionStats, HubChapterStatus } from './grammarSelectors';

export interface QuizContextValue {
    state: QuizState;
    sessionState: SessionState;
    nextReviewAt: Date | null;
    currentProgress: VocabProgress | null;
    /** True when the currently-loaded vocab hasn't been introduced yet and should show the intro card. */
    shouldShowIntro: boolean;
    isSetupComplete: boolean;
    /** Progress counter for the active study session (done/total, retries, waiting). */
    sessionStats: SessionStats;
    /** Preview of what the next study session will contain (review/new/retries), shown on the Main hub. */
    nextSessionPreview: NextSessionPreview;

    actions: QuizActions;
    /** The exercise on screen in each activity, and how to answer it (useExerciseTurn). */
    exercises: Record<ExerciseHost, ExerciseTurnApi>;

    /* ---------- Grammar activity (see useGrammarOrchestration.ts) ---------- */
    grammarSessionState: GrammarSessionState;
    grammarNextReviewAt: Date | null;
    currentGrammarProgress: GrammarProgress | null;
    shouldShowGrammarIntro: boolean;
    nextGrammarSessionPreview: NextGrammarSessionPreview;
    /** Progress counter for the active grammar study session (done/total, retries, waiting) - mirrors sessionStats. */
    grammarSessionStats: GrammarSessionStats;
    /** The hub's grammar chapter status (current/next/complete) plus that chapter's (or the whole curriculum's) three-way progress tally - null before it's loaded or when the teaching order failed to load. Always shown, independent of nextGrammarSessionPreview.new - see grammarSelectors.ts's describeHubChapter. */
    grammarHubChapter: HubChapterStatus | null;
    /** The end-of-chapter review step, when a chapter has just completed and has anchored contrast lessons - null otherwise. */
    pendingGrammarChapterLesson: PendingGrammarChapterLesson | null;
    grammarActions: GrammarActions;
}

export const QuizProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(quizReducer, {
        ...initialState,
        progress: StorageService.loadProgress(),
        settings: StorageService.loadSettings() ?? DEFAULT_SETTINGS,
    });

    const { actions, exercise, nextView, currentProgress, sessionStats, nextSessionPreview } = useQuizOrchestration(state, dispatch);
    const {
        grammarActions,
        grammarExercise,
        grammarNextView,
        currentGrammarProgress,
        nextGrammarSessionPreview,
        grammarSessionStats,
        grammarHubChapter,
        pendingGrammarChapterLesson,
    } = useGrammarOrchestration(state, dispatch);

    return (
        <QuizContext.Provider
            value={{
                state,
                sessionState: nextView.sessionState,
                nextReviewAt: nextView.nextReviewAt,
                currentProgress,
                shouldShowIntro: nextView.shouldShowIntro,
                isSetupComplete: !!state.progress,
                sessionStats,
                nextSessionPreview,
                actions,
                exercises: { vocab: exercise, grammar: grammarExercise },
                grammarSessionState: grammarNextView.sessionState,
                grammarNextReviewAt: grammarNextView.nextReviewAt,
                currentGrammarProgress,
                shouldShowGrammarIntro: grammarNextView.shouldShowIntro,
                nextGrammarSessionPreview,
                grammarSessionStats,
                grammarHubChapter,
                pendingGrammarChapterLesson,
                grammarActions,
            }}
        >
            {children}
        </QuizContext.Provider>
    );
};
