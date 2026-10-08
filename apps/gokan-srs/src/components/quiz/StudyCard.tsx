import type { ReactNode } from "react";
import type { Sentence } from "@gokan/dataset-schema";
import type { ExerciseTurnApi } from "../../context/quiz/useExerciseTurn";
import { useQuizFocusManagement } from "../../hooks/useQuizFocusManagement";
import { CardSection } from "../ui/CardSection";
import { InteractiveSentence } from "../InteractiveSentence";
import { QuizCardFrame } from "./QuizCardFrame";
import { ContinueButton } from "./QuizButtons";

interface StudyCardProps {
    api: ExerciseTurnApi;
    sentence: Sentence;
    /** Everything above the sentence: mastery, chips, why there is nothing to answer. */
    header: ReactNode;
    onVocabClick?: (vocabId: string) => void;
}

/**
 * A card with nothing to answer: the sentence is shown to read, with furigana and
 * a gloss on every word, and Continue moves on (useExerciseTurn writes the effects
 * of an empty answer, which only push the item's review out).
 */
export function StudyCard({ api, sentence, header, onVocabClick }: StudyCardProps) {
    // Nothing to type, so Continue takes focus straight away and Enter moves on.
    const { continueRef } = useQuizFocusManagement({ feedbackShown: true, continueFocusDelay: 50 }, [api.turn?.exercise]);

    if (!api.turn) return null;

    return (
        <QuizCardFrame>
            <CardSection>
                {header}
                <p className="text-center text-2xl font-gothic leading-loose text-primary">
                    <InteractiveSentence sentence={sentence} onVocabClick={onVocabClick} showFurigana />
                </p>
            </CardSection>

            <CardSection>
                <ContinueButton buttonRef={continueRef} onClick={api.continueToNext} flush />
            </CardSection>
        </QuizCardFrame>
    );
}
