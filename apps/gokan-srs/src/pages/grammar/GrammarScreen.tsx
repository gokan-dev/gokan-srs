import { Link } from "react-router-dom";
import { useQuiz } from "../../context/useQuiz";
import { ActivityStatusCard } from "../../components/ActivityStatusCard";
import { SessionProgress } from "../../components/SessionProgress";
import type { SessionHistoryEntry } from "../../components/SessionProgress";
import { GrammarIntroCard } from "./GrammarIntroCard";
import { ExerciseCard } from "../exercise/ExerciseCard";
import { GrammarChapterLessonCard } from "./GrammarChapterLessonCard";
import { useIntroducedGrammarIds } from "../../hooks/useIntroducedGrammarIds";
import { useNow } from "../../hooks/useNow";
import { formatMinutes, minutesUntil } from "../../utils/time.utils";

/**
 * Route /grammar - the Grammar activity, alongside the vocab quiz on /quiz.
 * Mirrors VocabQuizScreen's exhaustive switch over session state, minus the
 * 'learn-kanji' case: grammar has no kanji-gated learning step (see
 * GrammarSessionState in grammarSelectors.ts).
 */
interface GrammarScreenProps {
    onVocabClick: (vocabId: string) => void;
}

export function GrammarScreen({ onVocabClick }: GrammarScreenProps) {
    const {
        state,
        exercises,
        grammarSessionState,
        grammarNextReviewAt,
        shouldShowGrammarIntro,
        grammarActions,
        grammarSessionStats,
        pendingGrammarChapterLesson,
    } = useQuiz();

    const knownGrammarIds = useIntroducedGrammarIds();
    const now = useNow();

    switch (grammarSessionState) {
        case "waiting": {
            const minutes = grammarNextReviewAt ? minutesUntil(grammarNextReviewAt, now) : 1;
            return (
                <ActivityStatusCard title="You're done for now">
                    Your next grammar review will be available in{' '}
                    <strong>{formatMinutes(minutes)}</strong>.
                    <div className="mt-3">
                        <Link to="/grammar/browse" className="text-accent font-gothic text-sm hover:underline">
                            Browse all grammar points
                        </Link>
                    </div>
                </ActivityStatusCard>
            );
        }

        case "exhausted":
            return (
                <ActivityStatusCard title="All caught up">
                    Come back tomorrow.
                    <div className="mt-3">
                        <Link to="/grammar/browse" className="text-accent font-gothic text-sm hover:underline">
                            Browse all grammar points
                        </Link>
                    </div>
                </ActivityStatusCard>
            );

        case "review":
        case "learn": {
            // A finished chapter's review step takes priority over the loading
            // gate and the next intro/quiz card - it is a deliberate pause on a
            // now-complete set, not a card the queue serves.
            if (pendingGrammarChapterLesson) {
                return (
                    <GrammarChapterLessonCard
                        chapterTitle={pendingGrammarChapterLesson.chapterTitle}
                        focusPointIds={pendingGrammarChapterLesson.focusPointIds}
                        knownIds={knownGrammarIds}
                        onContinue={() => grammarActions.dismissGrammarChapterLesson(pendingGrammarChapterLesson.chapterId)}
                    />
                );
            }

            if (state.isLoadingGrammar || !state.currentGrammarPoint) {
                return (
                    <div className="flex items-center justify-center">
                        <div className="text-secondary">Loading grammar...</div>
                    </div>
                );
            }

            if (shouldShowGrammarIntro) {
                return (
                    <GrammarIntroCard
                        grammarPoint={state.currentGrammarPoint}
                        onLearn={() => grammarActions.saveGrammarIntroChoice(state.currentGrammarPoint!, 'learn')}
                        onSkip={() => grammarActions.saveGrammarIntroChoice(state.currentGrammarPoint!, 'skip')}
                    />
                );
            }

            const history: SessionHistoryEntry[] = state.grammarSessionHistory.map((item, index) => ({
                key: `${item.grammarId}-${index}`,
                href: `/grammar/${item.grammarId}`,
                label: item.title,
                result: item.result,
                delta: item.delta,
                vocabDelta: item.vocabDelta,
                vocabBreakdown: item.vocabBreakdown,
            }));

            return (
                <div className="flex flex-col flex-1 items-center">
                    <SessionProgress stats={grammarSessionStats} history={history} gains={state.grammarSessionGains} waitingNoun="grammar points" />

                    <div className="flex-1 flex items-center justify-center py-6 w-full">
                        <ExerciseCard api={exercises.grammar} onVocabClick={onVocabClick} />
                    </div>
                </div>
            );
        }

        default: {
            // Compile-time exhaustiveness check, mirroring VocabQuizScreen.
            const _exhaustive: never = grammarSessionState;
            return _exhaustive;
        }
    }
}
