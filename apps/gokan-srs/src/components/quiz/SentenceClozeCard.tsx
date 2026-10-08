import type { FormEvent, ReactNode } from "react";
import type { ExerciseTurnApi } from "../../context/quiz/useExerciseTurn";
import type { ExerciseTurn } from "../../context/quiz/exerciseReducer";
import type { AnswerSlot } from "../../services/exercise/types";
import { splitAtBlanks } from "../../utils/clozeSentence.utils";
import type { ClozeSentence } from "../../utils/clozeSentence.utils";
import { useQuizFocusManagement } from "../../hooks/useQuizFocusManagement";
import { CardSection } from "../ui/CardSection";
import { InteractiveSentence } from "../InteractiveSentence";
import { LookUpWords } from "../LookUpWords";
import { QuizCardFrame } from "./QuizCardFrame";
import { ClozeBlank } from "./ClozeBlank";
import { FeedbackNote } from "./FeedbackNote";
import { ContinueButton, SubmitButton } from "./QuizButtons";
import { blankBorderClass, resultAccentClass } from "./quizStyles";

interface SentenceClozeCardProps {
    api: ExerciseTurnApi;
    sentence: ClozeSentence;
    /** Everything above the sentence: mastery, chips, the English cue. */
    header: ReactNode;
    /** Shown in the feedback note under the message, e.g. the grammar point's usage note. */
    feedbackExtra?: ReactNode;
    /** Opens a word's page; the session pauses there instead of ending. */
    onVocabClick?: (vocabId: string) => void;
}

/**
 * The card for every sentence cloze (the vocab production cloze, the grammar
 * cloze): an English cue, then the sentence with one inline input per slot. The
 * text between the blanks renders through InteractiveSentence like every other
 * sentence in the app: a gloss on hover, a click to the word's page, furigana once
 * answered. A missed blank reveals the right form beside it, linked to its word.
 */
export function SentenceClozeCard({ api, sentence, header, feedbackExtra, onVocabClick }: SentenceClozeCardProps) {
    const { turn } = api;
    const feedback = turn?.feedback ?? null;

    const { firstInputRef, continueRef } = useQuizFocusManagement(
        {
            feedbackShown: !!feedback,
            // An answer with nothing to read moves on by itself (useExerciseTurn): nothing to focus there.
            skipContinueFocus: !!feedback?.grade.autoAdvance,
            continueFocusDelay: 50,
        },
        [turn?.exercise, feedback]
    );

    if (!turn) return null;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!feedback) api.submit();
        else if (api.showContinue) api.continueToNext();
    };

    return (
        <QuizCardFrame onSubmit={handleSubmit}>
            <CardSection>
                {header}

                <p className="text-center text-2xl font-gothic leading-loose text-primary">
                    {splitAtBlanks(sentence).map(part => {
                        if (part.kind === 'text') {
                            return <InteractiveSentence key={part.sentence.id} sentence={part.sentence} onVocabClick={onVocabClick} showFurigana={!!feedback} />;
                        }
                        const slot = turn.exercise.slots[part.index];
                        const grade = feedback?.grade.slots[part.index];
                        const hintLevel = turn.hintLevels[part.index] ?? 0;
                        return (
                            <ClozeBlank
                                key={`blank-${part.index}`}
                                // Straight from state: revealing a blank writes the answer into
                                // it (EXERCISE_REVEAL_HINT), so nothing is substituted at render.
                                value={turn.answers[part.index] ?? ''}
                                onChange={value => api.setAnswer(part.index, value)}
                                inputRef={part.index === 0 ? firstInputRef : undefined}
                                borderClass={blankBorderClass(grade?.result, { feedbackShown: !!feedback, revealed: hintLevel >= 2 })}
                                feedbackShown={!!feedback}
                                hintLevel={hintLevel}
                                onHint={() => api.revealHint(part.index)}
                                gloss={slot?.gloss ?? ''}
                                // On anything short of the word itself, strictly right.
                                reveal={slot && grade && (grade.result !== 'correct' || grade.synonym) && (
                                    <RevealedForm
                                        slot={slot}
                                        reading={slot.reveal === part.surface ? part.reading : undefined}
                                        onVocabClick={onVocabClick}
                                    />
                                )}
                            />
                        );
                    })}
                </p>
            </CardSection>

            <CardSection>
                {feedback && (
                    <FeedbackNote accentClass={resultAccentClass(feedback.grade.overall)} className="mb-4">
                        <p className="text-sm font-gothic text-primary">{feedback.grade.message}</p>
                        <LookUpWords words={synonymWords(turn)} onVocabClick={onVocabClick} />
                        {feedbackExtra}
                    </FeedbackNote>
                )}

                {!feedback
                    ? <SubmitButton canSubmit={api.canSubmit} evaluating={turn.isEvaluating} flush />
                    : api.showContinue && <ContinueButton buttonRef={continueRef} flush />}
            </CardSection>
        </QuizCardFrame>
    );
}

/** For each blank answered with a near-synonym: the tested word and the one typed, to look either up. */
function synonymWords(turn: ExerciseTurn): { vocabId: string; written: string }[] {
    return (turn.feedback?.grade.slots ?? []).flatMap((grade, i) => {
        const word = turn.exercise.slots[i]?.word;
        if (!grade.synonym) return [];
        return [
            ...(word?.vocabId ? [{ vocabId: word.vocabId, written: word.headword }] : []),
            { vocabId: grade.synonym.vocabId, written: grade.synonym.written },
        ];
    });
}

/**
 * The right form of a missed blank, right beside it, in the form the sentence uses
 * (食べたら / たべたら), which is what fits the blank. With its reading as furigana,
 * and a link to its word's page when it is a word.
 */
function RevealedForm({ slot, reading, onVocabClick }: { slot: AnswerSlot; reading?: string; onVocabClick?: (vocabId: string) => void }) {
    const form = reading && reading !== slot.reveal ? (
        <ruby className="ruby-text">
            {slot.reveal}
            <rt className="text-xs font-sans text-secondary not-italic">{reading}</rt>
        </ruby>
    ) : slot.reveal;

    const vocabId = slot.word?.vocabId;
    if (!vocabId || !onVocabClick) {
        return <span className="mt-1 text-feedback-correct whitespace-nowrap">{form}</span>;
    }
    return (
        <button
            type="button"
            onClick={() => onVocabClick(vocabId)}
            title={`Open the page for ${slot.word?.headword ?? slot.reveal}`}
            className="mt-1 rounded text-feedback-correct whitespace-nowrap underline decoration-dashed underline-offset-4 decoration-1 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
            {form}
        </button>
    );
}
