import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuiz } from "../../context/useQuiz";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { useQuizFocusManagement } from "../../hooks/useQuizFocusManagement";
import { Card } from "../../components/ui/Card";
import { CardSection } from "../../components/ui/CardSection";
import { Button } from "../../components/ui/Button";
import { JlptChip } from "../../components/JlptChip";
import { MasteryRing } from "../../components/MasteryRing";
import { WordGlossTooltip } from "../../components/WordGlossTooltip";
import { blankWidthEm } from "../../utils/blankWidth";

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
    const { isMobile } = useResponsive();

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

    if (plan.readOnly) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                <Card size="lg" className={isMobile ? '!p-4' : ''}>
                    <CardSection>
                        <div className="flex justify-end mb-2">
                            <MasteryRing memoryStrength={currentGrammarProgress?.entry.memoryStrength ?? 0} size={40} />
                        </div>
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
                </Card>
            </motion.div>
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

    const feedbackBorderClass = feedback?.type === 'wrong'
        ? 'border-l-error-accent'
        : feedback?.type === 'minor_error' || feedback?.type === 'pass'
            ? 'border-l-secondary'
            : 'border-l-accent';

    return (
        <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
        >
            <Card size="lg" className={isMobile ? '!p-4' : ''}>
                <CardSection>
                    <div className="flex justify-end mb-2">
                        <MasteryRing memoryStrength={currentGrammarProgress?.entry.memoryStrength ?? 0} size={40} />
                    </div>
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
                            const revealed = hintLevel >= 2;
                            // Straight from state: revealing a blank now writes the
                            // accepted form into grammarAnswers (see GRAMMAR_REVEAL_HINT),
                            // so there is no longer a render-time substitution that can
                            // disagree with what the reducer holds.
                            const displayValue = state.grammarAnswers[answerIndex] ?? '';

                            const borderClass = !feedback?.show
                                ? revealed
                                    ? 'border-secondary'
                                    : 'border-divider focus:border-accent'
                                : result === 'wrong'
                                    ? 'border-error'
                                    : result === 'minor_error' || result === 'pass'
                                        ? 'border-secondary'
                                        : 'border-accent';

                            return (
                                <span key={i} className="inline-flex flex-col items-center mx-0.5">
                                    <span className="inline-flex items-center gap-1">
                                        <input
                                            ref={answerIndex === 0 ? firstInputRef : undefined}
                                            type="text"
                                            value={displayValue}
                                            onChange={(e) => grammarActions.setGrammarAnswer(answerIndex, e.target.value)}
                                            disabled={feedback?.show || revealed}
                                            autoComplete="off"
                                            autoCorrect="off"
                                            autoCapitalize="off"
                                            spellCheck="false"
                                            style={{ width: `${blankWidthEm(displayValue)}em` }}
                                            className={`border-b-2 bg-transparent text-center focus:outline-none transition-colors font-gothic caret-accent ${borderClass}`}
                                        />
                                        {!feedback?.show && !revealed && (
                                            <button
                                                type="button"
                                                onClick={() => grammarActions.revealGrammarHint(answerIndex)}
                                                className="text-xs text-secondary hover:text-primary transition-colors font-gothic w-4 h-4 rounded-full border border-divider flex items-center justify-center shrink-0"
                                                aria-label="Show hint"
                                            >
                                                ?
                                            </button>
                                        )}
                                    </span>
                                    {!feedback?.show && hintLevel === 1 && (
                                        <span className="text-xs text-secondary font-gothic mt-1">
                                            {plan.glosses[answerIndex] || 'No hint available'}
                                        </span>
                                    )}
                                    {feedback?.show && result !== 'correct' && (
                                        // The correct form, under the wrong one. Was text-xs
                                        // beneath a text-2xl answer, which sized the thing you
                                        // need to read at a third of the thing you got wrong.
                                        <span className="text-base text-feedback-correct font-gothic mt-1 whitespace-nowrap">
                                            {feedback.matchedAnswers[answerIndex]}
                                        </span>
                                    )}
                                </span>
                            );
                        })}
                    </div>
                </CardSection>

                <CardSection>
                    {feedback?.show && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className={`border rounded bg-feedback-background border-divider border-l-4 p-4 mb-4 ${feedbackBorderClass}`}
                        >
                            <p className="text-sm font-gothic text-primary">{feedback.message}</p>
                            {point.usageNote && (
                                <p className="text-xs font-gothic text-secondary italic mt-2">
                                    {point.usageNote}
                                </p>
                            )}
                        </motion.div>
                    )}

                    {!feedback?.show ? (
                        <button
                            type="submit"
                            disabled={!grammarComputed.canSubmitGrammar}
                            className={`w-full font-medium rounded-lg transition-all duration-200 font-serif flex items-center justify-center gap-2 h-12
                                ${grammarComputed.canSubmitGrammar
                                    ? 'bg-accent text-surface hover:bg-accent-hover shadow-md hover:shadow-lg'
                                    : 'bg-accent/50 text-surface/80 cursor-not-allowed'}`}
                        >
                            <span>Submit</span>
                        </button>
                    ) : (
                        <button
                            ref={continueRef}
                            type="submit"
                            className="w-full font-medium rounded-lg transition-colors font-serif bg-accent text-surface hover:bg-accent-hover shadow-md flex items-center justify-center gap-2 h-12"
                        >
                            <span>Continue</span>
                        </button>
                    )}
                </CardSection>
            </Card>
        </motion.form>
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

/**
 * The route to the grammar point's detail page, available only AFTER answering.
 *
 * Before answering it is a spoiler route: the detail page carries the point's
 * formation and every example sentence, which is the answer. The JLPT chip used
 * to be a link unconditionally, so it was reachable mid-question by anyone who
 * thought to click it.
 *
 * After answering the opposite is true - checking the point is exactly what a
 * learner wants to do with a form they just got wrong - so it becomes an
 * explicit labelled link rather than a chip you have to guess is clickable.
 */
function PointLink({ pointId, revealed }: { pointId: string; revealed: boolean }) {
    if (!revealed) return null;
    return (
        <Link
            to={`/grammar/${pointId}`}
            className="text-xs font-gothic text-accent hover:underline whitespace-nowrap"
        >
            View grammar point
        </Link>
    );
}
