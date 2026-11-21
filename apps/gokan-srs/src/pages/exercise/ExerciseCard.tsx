import { useEffect, useEffectEvent, useState } from "react";
import type { ClipOutcome, Vocabulary } from "@gokan/dataset-schema";
import { useQuiz } from "../../context/useQuiz";
import type { ExerciseTurnApi } from "../../context/quiz/useExerciseTurn";
import type { Exercise, SlotGrade } from "../../services/exercise/types";
import { useClip } from "../../hooks/useClip";
import { CONSTANTS } from "../../commons/constants";
import { SingleAnswerCard } from "../../components/quiz/SingleAnswerCard";
import { SentenceClozeCard } from "../../components/quiz/SentenceClozeCard";
import { StudyCard } from "../../components/quiz/StudyCard";
import { formatReadingList } from "../quiz/quizFormatting";
import { ListeningClozeHeader, MeaningPrompt, ProductionClozeHeader, ProductionPrompt, ReadingPrompt } from "../quiz/VocabPrompts";
import { ConjugationAnswer, ConjugationPrompt, DrillContrastNote, GrammarCardHeader, SentenceCue } from "../grammar/GrammarPrompts";
import { currentDrillCard } from "../../context/quiz/drillSelectors";

/**
 * Reading and production from a gloss both take the word's reading, in kana: a near miss shows what it was close to, a miss every reading.
 * `convertsRomaji` (ExerciseTurnApi.convertsRomaji) says whether romaji may be typed, which the placeholder names.
 */
const kanaAnswer = (vocab: Vocabulary, convertsRomaji: boolean) => ({
    inputLabel: 'Reading (hiragana)',
    inputPlaceholder: convertsRomaji ? CONSTANTS.quiz.romajiAnswerPlaceholder : CONSTANTS.quiz.hiraganaAnswerPlaceholder,
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
                    {...kanaAnswer(vocab, api.convertsRomaji(0))}
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
                    {...kanaAnswer(vocab, api.convertsRomaji(0))}
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

        case 'listening-cloze':
            if (!vocab) return null;
            return (
                <ListeningCloze
                    // A new card is a new clip, even on the same sentence (another word of it): it
                    // plays on show again, says "Play" again, and the fallback does not carry over.
                    key={`${vocab.id}:${exercise.sentence.sentence.id}`}
                    api={api}
                    vocab={vocab}
                    exercise={exercise}
                    memoryStrength={currentProgress?.reading.memoryStrength ?? 0}
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

        case 'grammar-choice': {
            // A drill's card names its own point (the drill's, not the session's) and moves no mastery.
            const drillCard = exercise.mode === 'drill' ? currentDrillCard(state.drill) : null;
            const shown = drillCard?.point ?? point;
            if (!shown) return null;
            const picked = drillCard?.options.find(o => o.text === api.turn?.answers[0]);
            const contrast = answered && picked ? drillCard?.cases[picked.pointId] : undefined;
            return (
                <SentenceClozeCard
                    api={api}
                    sentence={exercise.sentence}
                    header={(
                        <>
                            <GrammarCardHeader point={shown} memoryStrength={drillCard ? null : grammarStrength} answered={answered} />
                            {/* The translation would answer the card: it comes with the feedback. */}
                            <SentenceCue
                                instruction="Choose what fits the sentence"
                                english={answered ? exercise.sentence.sentence.en[0]?.text : undefined}
                            />
                        </>
                    )}
                    feedbackExtra={(contrast || shown.usageNote) && (
                        <>
                            {contrast && <DrillContrastNote contrast={contrast} />}
                            {shown.usageNote && <p className="text-xs font-gothic text-secondary italic mt-2">{shown.usageNote}</p>}
                        </>
                    )}
                    onVocabClick={onVocabClick}
                />
            );
        }

        case 'conjugation':
            if (!point) return null;
            return (
                <SingleAnswerCard
                    api={api}
                    kind="conjugation"
                    inputLabel={`${exercise.prompt.formLabel} of ${exercise.prompt.lemma}`}
                    inputPlaceholder={api.convertsRomaji(0) ? CONSTANTS.quiz.conjugationRomajiPlaceholder : CONSTANTS.quiz.conjugationPlaceholder}
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

interface ListeningClozeProps {
    api: ExerciseTurnApi;
    vocab: Vocabulary;
    exercise: Extract<Exercise, { kind: 'listening-cloze' }>;
    memoryStrength: number;
    onVocabClick: (vocabId: string) => void;
}

/**
 * The listening cloze on the sentence cloze card (issue #165): its sentence plays once on show,
 * replays on its control or the replay key, and, when it cannot be heard (the clip failed, or the
 * learner asked for the text, which stops it), shows its translation, so the card is answered as
 * the production cloze is rather than blocking the session; that answer credits nothing
 * (`turn.unheard`, effects.ts). A clip blocked from playing by itself (autoplay) is not a failure:
 * the control is there to press. A right answer shows the word as written, with its reading.
 */
function ListeningCloze({ api, vocab, exercise, memoryStrength, onVocabClick }: ListeningClozeProps) {
    const control = useClip(exercise.audio.clip);
    // `played` resolves when playback starts: the clip counts as heard once that play has ended
    // (played through, or stopped), so the control says "Play" for the whole first play.
    const [started, setStarted] = useState(false);
    const [heard, setHeard] = useState(false);
    if (started && !control.playing && !heard) setHeard(true);
    const unheard = api.turn?.unheard === true;
    const onOutcome = (outcome: ClipOutcome) => {
        if (outcome === 'played') setStarted(true);
        else if (outcome === 'failed') api.markUnheard();
    };

    const playOnShow = useEffectEvent(() => { void control.play().then(onOutcome); });
    useEffect(() => playOnShow(), []);

    return (
        <SentenceClozeCard
            api={api}
            sentence={exercise.sentence}
            header={(
                <ListeningClozeHeader
                    vocab={vocab}
                    sentence={exercise.cloze.sentence}
                    memoryStrength={memoryStrength}
                    control={control}
                    heard={heard}
                    answered={!!api.turn?.feedback}
                    unheard={unheard}
                    onUnheard={() => {
                        control.stop();
                        api.markUnheard();
                    }}
                    onOutcome={onOutcome}
                />
            )}
            onVocabClick={onVocabClick}
            onReplay={() => void control.play().then(onOutcome)}
            revealWhenRight
        />
    );
}
