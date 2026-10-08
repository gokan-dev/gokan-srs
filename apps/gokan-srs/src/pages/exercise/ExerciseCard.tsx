import type { Vocabulary } from "@gokan/dataset-schema";
import { useQuiz } from "../../context/useQuiz";
import type { ExerciseTurnApi } from "../../context/quiz/useExerciseTurn";
import type { SlotGrade } from "../../services/exercise/types";
import { CONSTANTS } from "../../commons/constants";
import { SingleAnswerCard } from "../../components/quiz/SingleAnswerCard";
import { SentenceClozeCard } from "../../components/quiz/SentenceClozeCard";
import { StudyCard } from "../../components/quiz/StudyCard";
import { formatReadingList } from "../quiz/quizFormatting";
import { MeaningPrompt, ProductionClozeHeader, ProductionPrompt, ReadingPrompt } from "../quiz/VocabPrompts";
import { ConjugationAnswer, ConjugationPrompt, GrammarCardHeader, SentenceCue } from "../grammar/GrammarPrompts";

/** Reading and production from a gloss both take the word's reading, in kana: a near miss shows what it was close to, a miss every reading. */
const kanaAnswer = (vocab: Vocabulary) => ({
    inputLabel: 'Reading (hiragana)',
    inputPlaceholder: CONSTANTS.quiz.hiraganaAnswerPlaceholder,
    correctAnswer: (grade: SlotGrade | null) => (
        <span className="text-2xl">
            {grade?.result === 'minor_error' ? grade.shown : formatReadingList(vocab.reading)}
        </span>
    ),
});

interface ExerciseCardProps {
    api: ExerciseTurnApi;
    /** Opens a word's page; the session pauses there instead of ending. */
    onVocabClick: (vocabId: string) => void;
}

/**
 * The one place a card is chosen for an exercise. Every exercise is answered
 * through one of three shells (SingleAnswerCard, SentenceClozeCard, StudyCard);
 * its kind only picks the shell and the prompt. The switch names every kind, so
 * a new one fails to compile until it has a card here.
 */
export function ExerciseCard({ api, onVocabClick }: ExerciseCardProps) {
    const { state, currentProgress, currentGrammarProgress } = useQuiz();
    const exercise = api.turn?.exercise;
    if (!exercise) return null;

    const answered = !!api.turn?.feedback;
    const vocab = state.currentVocab;
    const point = state.currentGrammarPoint;
    const grammarStrength = currentGrammarProgress?.entry.memoryStrength ?? 0;

    switch (exercise.kind) {
        case 'reading':
            if (!vocab) return null;
            return (
                <SingleAnswerCard
                    api={api}
                    kind="reading"
                    {...kanaAnswer(vocab)}
                    onVocabClick={onVocabClick}
                >
                    <ReadingPrompt vocab={vocab} answered={answered} memoryStrength={currentProgress?.reading.memoryStrength ?? 0} onOpenWord={() => onVocabClick(vocab.id)} />
                </SingleAnswerCard>
            );

        case 'meaning':
            if (!vocab) return null;
            return (
                <SingleAnswerCard
                    api={api}
                    kind="meaning"
                    inputLabel="Meaning (English)"
                    inputPlaceholder="Type the meaning..."
                    correctAnswer={grade => grade?.shown || 'No meaning found'}
                    onVocabClick={onVocabClick}
                >
                    <MeaningPrompt
                        vocab={vocab}
                        answered={answered}
                        memoryStrength={currentProgress?.meaning.memoryStrength ?? 0}
                        onOpenWord={() => onVocabClick(vocab.id)}
                        sentence={exercise.sentence}
                        contextRequested={exercise.contextRequested}
                        onVocabClick={onVocabClick}
                    />
                </SingleAnswerCard>
            );

        case 'production':
            if (!vocab) return null;
            return (
                <SingleAnswerCard
                    api={api}
                    kind="production"
                    {...kanaAnswer(vocab)}
                    onVocabClick={onVocabClick}
                >
                    <ProductionPrompt vocab={vocab} answered={answered} memoryStrength={currentProgress?.production?.memoryStrength ?? 0} onOpenWord={() => onVocabClick(vocab.id)} />
                </SingleAnswerCard>
            );

        case 'production-cloze':
            if (!vocab) return null;
            return (
                <SentenceClozeCard
                    api={api}
                    sentence={exercise.sentence}
                    header={<ProductionClozeHeader vocab={vocab} sentence={exercise.cloze.sentence} memoryStrength={currentProgress?.production?.memoryStrength ?? 0} />}
                    onVocabClick={onVocabClick}
                />
            );

        case 'grammar-cloze':
            if (!point) return null;
            return (
                <SentenceClozeCard
                    api={api}
                    sentence={exercise.sentence}
                    header={(
                        <>
                            <GrammarCardHeader
                                point={point}
                                memoryStrength={grammarStrength}
                                answered={answered}
                                // The register of the realization shown: the only thing
                                // telling どこにも from どこへも on the card.
                                formalityLevel={exercise.realization?.formalityLevel ?? point.formalityLevel}
                                realization={exercise.realization}
                            />
                            <SentenceCue instruction="Translate into Japanese" english={exercise.sentence.sentence.en[0]?.text ?? ''} />
                        </>
                    )}
                    feedbackExtra={point.usageNote && (
                        <p className="text-xs font-gothic text-secondary italic mt-2">{point.usageNote}</p>
                    )}
                    onVocabClick={onVocabClick}
                />
            );

        case 'conjugation':
            if (!point) return null;
            return (
                <SingleAnswerCard
                    api={api}
                    kind="conjugation"
                    inputLabel={`${exercise.prompt.formLabel} of ${exercise.prompt.lemma}`}
                    inputPlaceholder="Type the form..."
                    correctAnswer={() => <ConjugationAnswer prompt={exercise.prompt} size={answered ? 'lg' : 'sm'} />}
                    revealable
                    onVocabClick={onVocabClick}
                >
                    <GrammarCardHeader point={point} memoryStrength={grammarStrength} answered={answered} />
                    <ConjugationPrompt prompt={exercise.prompt} />
                </SingleAnswerCard>
            );

        case 'study':
            if (!point) return null;
            return (
                <StudyCard
                    api={api}
                    sentence={exercise.sentence}
                    header={(
                        <>
                            {/* The study view has no answer to spoil. */}
                            <GrammarCardHeader point={point} memoryStrength={grammarStrength} answered>
                                {point.usageNote && (
                                    <p className="text-center text-xs text-secondary font-gothic italic mt-1 max-w-sm mx-auto">
                                        {point.usageNote}
                                    </p>
                                )}
                            </GrammarCardHeader>
                            <SentenceCue instruction="No quizzable words in this example - study it instead" english={exercise.sentence.en[0]?.text ?? ''} />
                        </>
                    )}
                    onVocabClick={onVocabClick}
                />
            );
    }
}
