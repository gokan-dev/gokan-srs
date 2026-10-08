import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuiz } from "../../context/useQuiz";
import { useQuizFocusManagement } from "../../hooks/useQuizFocusManagement";
import { CardSection } from "../../components/ui/CardSection";
import { Button } from "../../components/ui/Button";
import { JlptChip } from "../../components/JlptChip";
import { WordGlossTooltip } from "../../components/WordGlossTooltip";
import { QuizCardFrame } from "../../components/quiz/QuizCardFrame";
import { QuizMasteryCorner } from "../../components/quiz/QuizMasteryCorner";
import { ClozeBlank } from "../../components/quiz/ClozeBlank";
import { FeedbackNote } from "../../components/quiz/FeedbackNote";
import { ContinueButton, SubmitButton } from "../../components/quiz/QuizButtons";
import { blankBorderClass, resultAccentClass } from "../../components/quiz/quizStyles";
import { PointLink } from "./PointLink";

/**
 * Register hint shown while the question is still open. Deliberately the
 * STRUCTURED formalityLevel and not the free-text usageNote: the note names the
 * form on 37 of 379 points ("...ないです instead of ません. (どこへも variant.)"),
 * which handed the learner the answer. A label drawn from a fixed vocabulary
 * cannot leak it, while still disambiguating which register is being asked for -
 * which is what #42 needed the note for in the first place.
 */
const FORMALITY_HINT: Record<string, string> = {
    'casual': 'Casual',
    'neutral': 'Neutral',
    'polite': 'Polite',
    'formal': 'Formal',
    'very-formal-literary': 'Literary',
};

/**
 * The grammar quiz itself: an English prompt the user translates into
 * Japanese, with the sentence rendered as literal text interspersed with
 * discrete input blanks - one per word the user already knows from the vocab
 * activity (see computeBlankPlan in grammarSelectors.ts for the selection
 * rule). Words the user doesn't know yet stay pre-filled as plain text, so an
 * unfamiliar word never blocks practicing the grammar point itself (issue #17).
 * A plan with no blankable word at all (plan.readOnly) renders as pure study
 * material instead - see the early return below.
 */
export function GrammarQuizCard() {
    const { state, grammarActions, grammarComputed, currentGrammarProgress } = useQuiz();

    const point = state.currentGrammarPoint;
    const plan = state.currentGrammarBlankPlan;
    const feedback = state.grammarFeedback;

    const { firstInputRef, continueRef } = useQuizFocusManagement(
        {
            feedbackShown: !!feedback?.show,
            // A fully-correct answer auto-advances (owned by useGrammarOrchestration) - nothing to focus there.
            skipContinueFocus: !!feedback?.show && feedback.correct,
            continueFocusDelay: 50,
        },
        [point?.id, plan, feedback]
    );

    if (!point || !plan) return null;

    // The plan's own example, NOT point.examples[plan.exampleIndex]: for a variant
    // group the plan was computed against a rotated realization, and indexing the
    // canonical here applied one sentence's blank indices to a different sentence.
    const example = plan.example ?? point.examples[plan.exampleIndex];
    // The register hint must describe the realization actually shown - it is the
    // only thing distinguishing どこにも from どこへも on the card.
    const formalityLevel = plan.realization?.formalityLevel ?? point.formalityLevel;
    const memoryStrength = currentGrammarProgress?.entry.memoryStrength ?? 0;

    if (plan.readOnly) {
        return (
            <QuizCardFrame>
                <CardSection>
                    <QuizMasteryCorner memoryStrength={memoryStrength} />
                    <div className="mb-4">
                        <div className="flex items-center justify-center gap-2">
                            <JlptChip level={point.jlptLevel} />
                            {/* The study view has no answer to spoil. */}
                            <PointLink pointId={point.id} revealed />
                        </div>
                        {point.usageNote && (
                            <p className="text-center text-xs text-secondary font-gothic italic mt-1 max-w-sm mx-auto">
                                {point.usageNote}
                            </p>
                        )}
                    </div>

                    <p className="text-center text-sm text-secondary font-gothic mb-1">
                        No quizzable words in this example - study it instead
                    </p>
                    <p className="text-center text-lg text-primary font-serif mb-6">
                        {example.en}
                    </p>
                    <p className="text-center text-2xl font-gothic leading-loose text-primary">
                        {example.words.map((word, i) =>
                            word.vocabId != null ? (
                                <GlossedWord key={i} vocabId={word.vocabId} surface={word.surface} />
                            ) : (
                                <span key={i}>{word.surface}</span>
                            )
                        )}
                    </p>
                </CardSection>

                <CardSection>
                    <Button
                        variant="primary"
                        type="button"
                        className="w-full"
                        onClick={() => grammarActions.continueGrammarToNext()}
                    >
                        Continue
                    </Button>
                </CardSection>
            </QuizCardFrame>
        );
    }

    // One input per SPAN. A pattern spanning several tokens (どこ/に/も) is one
    // input covering the whole run, so the words it swallowed must not also be
    // printed as literal text beside it - hence the second set.
    const answerIndexByWordIndex = new Map<number, number>();
    const swallowedWordIndices = new Set<number>();
    plan.blankWordIndices.forEach((wordIndex, answerIndex) => answerIndexByWordIndex.set(wordIndex, answerIndex));
    plan.blankWordSpans.forEach(span => span.slice(1).forEach(i => swallowedWordIndices.add(i)));

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!feedback?.show) {
            grammarActions.submitGrammarAnswer();
        } else if (grammarComputed.canContinueGrammar) {
            grammarActions.continueGrammarToNext();
        }
    };

    return (
        <QuizCardFrame onSubmit={handleSubmit}>
            <CardSection>
                <QuizMasteryCorner memoryStrength={memoryStrength} />
                <div className="mb-4">
                    <div className="flex items-center justify-center gap-2">
                        <JlptChip level={point.jlptLevel} />
                        {formalityLevel && FORMALITY_HINT[formalityLevel] && (
                            <span className="text-xs font-gothic text-secondary border border-divider rounded px-2 py-0.5">
                                {FORMALITY_HINT[formalityLevel]}
                            </span>
                        )}
                        {plan.realization && plan.realization.total > 1 && (
                            <span
                                className="text-xs font-gothic text-tertiary"
                                title="This rule has several equivalent forms; one is drilled per review, and they share one mastery score."
                            >
                                form {plan.realization.index} of {plan.realization.total}
                            </span>
                        )}
                        <PointLink pointId={point.id} revealed={!!feedback?.show} />
                    </div>
                </div>

                <p className="text-center text-sm text-secondary font-gothic mb-1">
                    Translate into Japanese
                </p>
                <p className="text-center text-lg text-primary font-serif mb-8">
                    {example.en}
                </p>

                <div className="flex flex-wrap items-end justify-center gap-y-3 text-2xl font-gothic leading-loose text-primary">
                    {example.words.map((word, i) => {
                        if (swallowedWordIndices.has(i)) return null;
                        const answerIndex = answerIndexByWordIndex.get(i);

                        if (answerIndex === undefined) {
                            if (word.vocabId != null) {
                                return <GlossedWord key={i} vocabId={word.vocabId} surface={word.surface} />;
                            }
                            return <span key={i}>{word.surface}</span>;
                        }

                        const result = feedback?.perBlankResults[answerIndex];
                        const hintLevel = state.grammarHintLevels[answerIndex] ?? 0;

                        return (
                            <ClozeBlank
                                key={i}
                                // Straight from state: revealing a blank writes the accepted
                                // form into grammarAnswers (see GRAMMAR_REVEAL_HINT), so there is
                                // no render-time substitution that can disagree with the reducer.
                                value={state.grammarAnswers[answerIndex] ?? ''}
                                onChange={(value) => grammarActions.setGrammarAnswer(answerIndex, value)}
                                inputRef={answerIndex === 0 ? firstInputRef : undefined}
                                borderClass={blankBorderClass(result, { feedbackShown: !!feedback?.show, revealed: hintLevel >= 2 })}
                                feedbackShown={!!feedback?.show}
                                hintLevel={hintLevel}
                                onHint={() => grammarActions.revealGrammarHint(answerIndex)}
                                gloss={plan.slots[answerIndex]?.gloss ?? ''}
                                reveal={result !== 'correct' && (
                                    // The correct form, under the wrong one. Was text-xs
                                    // beneath a text-2xl answer, which sized the thing you
                                    // need to read at a third of the thing you got wrong.
                                    <span className="text-base text-feedback-correct font-gothic mt-1 whitespace-nowrap">
                                        {feedback?.matchedAnswers[answerIndex]}
                                    </span>
                                )}
                            />
                        );
                    })}
                </div>
            </CardSection>

            <CardSection>
                {feedback?.show && (
                    <FeedbackNote accentClass={resultAccentClass(feedback.type)} className="mb-4">
                        <p className="text-sm font-gothic text-primary">{feedback.message}</p>
                        {point.usageNote && (
                            <p className="text-xs font-gothic text-secondary italic mt-2">
                                {point.usageNote}
                            </p>
                        )}
                    </FeedbackNote>
                )}

                {!feedback?.show
                    ? <SubmitButton canSubmit={grammarComputed.canSubmitGrammar} flush />
                    : <ContinueButton buttonRef={continueRef} flush />}
            </CardSection>
        </QuizCardFrame>
    );
}

/**
 * A pre-filled word in the quiz sentence: the ones NOT blanked, which are
 * exactly the words computeBlankPlanFor judged the learner does not know yet.
 * Those are the words worth glossing, so the hover card lands precisely where
 * the learner is stuck without pulling them out of the review.
 *
 * Kept as a Link as well, so the existing click-through to the vocab page is
 * unchanged - the gloss is an addition, not a replacement.
 */
function GlossedWord({ vocabId, surface }: { vocabId: string; surface: string }) {
    return (
        <WordGlossTooltip vocabId={vocabId} fallbackTitle="Click to view details">
            <Link
                to={`/vocab/${vocabId}`}
                className="cursor-pointer text-primary border-b border-dashed border-tertiary/50 hover:text-accent hover:border-accent transition-colors"
            >
                {surface}
            </Link>
        </WordGlossTooltip>
    );
}
