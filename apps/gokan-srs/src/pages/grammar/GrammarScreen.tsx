import { Link } from "react-router-dom";
import { useQuiz } from "../../context/useQuiz";
import { ActivityStatusCard } from "../../components/ActivityStatusCard";
import { SessionProgress } from "../../components/SessionProgress";
import type { SessionHistoryEntry } from "../../components/SessionProgress";
import { GrammarIntroCard } from "./GrammarIntroCard";
import { GrammarQuizCard } from "./GrammarQuizCard";
import { GrammarConjugationCard } from "./GrammarConjugationCard";

/**
 * Route /grammar - the Grammar activity, alongside the vocab quiz on /quiz.
 * Mirrors VocabQuizScreen's exhaustive switch over session state, minus the
 * 'learn-kanji' case: grammar has no kanji-gated learning step (see
 * GrammarSessionState in grammarSelectors.ts).
 */
export function GrammarScreen() {
    const { state, grammarSessionState, grammarNextReviewAt, shouldShowGrammarIntro, grammarActions, grammarSessionStats } = useQuiz();

    switch (grammarSessionState) {
        case "waiting": {
            const minutes = Math.max(1, Math.ceil((grammarNextReviewAt!.getTime() - Date.now()) / 60000));
            return (
                <ActivityStatusCard title="You're done for now">
                    Your next grammar review will be available in{' '}
                    <strong>{minutes} minute{minutes > 1 ? 's' : ''}</strong>.
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
                    <SessionProgress stats={grammarSessionStats} history={history} waitingNoun="grammar points" />

                    <div className="flex-1 flex items-center justify-center py-6 w-full">
                        {/* An `inflection` point is served by the transformation
                            drill: its identity is a derivation, so there is no
                            invariant marker for the sentence cloze to blank. */}
                        {state.currentGrammarBlankPlan?.conjugation
                            ? <GrammarConjugationCard />
                            : <GrammarQuizCard />}
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
