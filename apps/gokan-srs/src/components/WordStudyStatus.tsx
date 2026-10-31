import { useState } from "react";
import { useQuiz } from "../context/useQuiz";
import { hasSessionInProgress } from "../context/quiz/quizSelectors";
import { VocabularyService } from "../services/vocabulary.service";
import { vocabLearningStatus } from "../utils/learningStatus.utils";
import { Button } from "./ui/Button";
import { StatusDot } from "./StatusDot";

/**
 * A word's place in the learner's study, as a row's trailing slot: Learning or
 * Mastered for a word in the queue, a compact "Learn" button for one that is not.
 * Learn adds the word in place (the same intro choice the quiz's intro card
 * makes) and turns into "Added", so a list or the search can be used to capture
 * words without leaving it. Nothing before setup.
 *
 * `card` (a lookup card): the status always shown, New included, and "Learn this word" beside a
 * new word, except mid-session, where the session decides what comes next.
 */
export function WordStudyStatus({ vocabId, variant = 'row' }: { vocabId: string; variant?: 'row' | 'card' }) {
    const { state, actions } = useQuiz();
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);
    // Before setup (the header search on About) there is no queue to add to: Learn would do nothing.
    if (!state.progress) return null;
    const progress = state.progress.learningQueue.find(p => p.vocabId === vocabId);

    if (added && progress && variant === 'row') return <span className="type-meta">Added</span>;
    if (progress) return <StatusDot status={vocabLearningStatus(progress, state.settings ?? undefined)} />;
    if (variant === 'card' && hasSessionInProgress(state)) return <StatusDot status="new" />;

    const learn = () => {
        setAdding(true);
        VocabularyService.loadVocab(vocabId)
            .then(vocab => {
                actions.saveVocabIntroChoice(vocab, 'learn');
                setAdded(true);
            })
            .catch((err: unknown) => console.error('Failed to load the word to learn it', err))
            .finally(() => setAdding(false));
    };

    const button = (
        <Button
            variant="secondary"
            size="sm"
            disabled={adding}
            onClick={e => {
                // Inside a row that is itself a link or an option: adding is not opening.
                e.preventDefault();
                e.stopPropagation();
                learn();
            }}
        >
            {variant === 'card' ? 'Learn this word' : 'Learn'}
        </Button>
    );
    if (variant === 'row') return button;
    return (
        <span className="flex items-center gap-3">
            <StatusDot status="new" />
            {button}
        </span>
    );
}
