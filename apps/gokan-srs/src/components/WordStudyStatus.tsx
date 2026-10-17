import { useState } from "react";
import { useQuiz } from "../context/useQuiz";
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
 */
export function WordStudyStatus({ vocabId }: { vocabId: string }) {
    const { state, actions } = useQuiz();
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);
    // Before setup (the header search on About) there is no queue to add to: Learn would do nothing.
    if (!state.progress) return null;
    const progress = state.progress.learningQueue.find(p => p.vocabId === vocabId);

    if (added && progress) return <span className="type-meta">Added</span>;
    if (progress) return <StatusDot status={vocabLearningStatus(progress, state.settings ?? undefined)} />;

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

    return (
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
            Learn
        </Button>
    );
}
