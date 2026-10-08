import type { FormEvent } from "react";
import { ArrowDown } from "lucide-react";
import { useQuiz } from "../../context/useQuiz";
import { useQuizFocusManagement } from "../../hooks/useQuizFocusManagement";
import { CardSection } from "../../components/ui/CardSection";
import { Button } from "../../components/ui/Button";
import { JlptChip } from "../../components/JlptChip";
import { QuizCardFrame } from "../../components/quiz/QuizCardFrame";
import { QuizMasteryCorner } from "../../components/quiz/QuizMasteryCorner";
import { ContinueButton } from "../../components/quiz/QuizButtons";
import { PointLink } from "./PointLink";

const CLASS_LABELS: Record<string, string> = {
    'godan': 'godan (u-verb)',
    'ichidan': 'ichidan (ru-verb)',
    'irregular': 'irregular',
    'i-adjective': 'い-adjective',
    'na-adjective': 'な-adjective',
};

/**
 * The transformation drill, for `kind: 'inflection'` points - the ones whose
 * identity is a derivation rather than a fixed marker, so the sentence cloze in
 * GrammarQuizCard has nothing invariant to blank.
 *
 * Given a dictionary form and a target form, produce the conjugation. Both kanji
 * and kana are accepted, along with any alternative the dataset marked as
 * equally correct (書かされる for the causative-passive, the colloquial 食べれる
 * for the ichidan potential).
 *
 * Deliberately thin: the plan is a one-blank GrammarBlankPlan, so this card
 * shares `grammarAnswers`, the hint semantics, the shared grader and the
 * whole SRS path with the cloze card rather than duplicating any of it.
 */
export function GrammarConjugationCard() {
    const { state, grammarActions, currentGrammarProgress } = useQuiz();

    const point = state.currentGrammarPoint;
    const plan = state.currentGrammarBlankPlan;
    const feedback = state.grammarFeedback;

    const { firstInputRef, continueRef } = useQuizFocusManagement(
        {
            feedbackShown: !!feedback?.show,
            skipContinueFocus: !!feedback?.show && feedback.correct,
            continueFocusDelay: 50,
        },
        [point?.id, plan, feedback]
    );

    if (!point || !plan?.conjugation) return null;

    const { lemma, lemmaReading, formLabel, wordClass, target, targetReading, alternatives } = plan.conjugation;
    const revealed = (state.grammarHintLevels[0] ?? 0) >= 2;
    const answer = state.grammarAnswers[0] ?? '';

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (feedback?.show) return;
        grammarActions.submitGrammarAnswer();
    };

    return (
        <QuizCardFrame>
                <CardSection>
                    <QuizMasteryCorner memoryStrength={currentGrammarProgress?.entry.memoryStrength ?? 0} />
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <JlptChip level={point.jlptLevel} />
                        <PointLink pointId={point.id} revealed={!!feedback?.show} />
                    </div>
                    <p className="text-center text-xs text-tertiary font-gothic">
                        {CLASS_LABELS[wordClass] ?? wordClass}
                    </p>
                </CardSection>

                <CardSection>
                    {/* The dictionary form, then the form being asked for. */}
                    <div className="text-center">
                        <p className="text-3xl font-mincho text-primary leading-snug">{lemma}</p>
                        <p className="text-sm text-tertiary font-gothic mt-1">{lemmaReading}</p>
                    </div>

                    <div className="text-center my-4">
                        <ArrowDown className="inline-block w-5 h-5 text-tertiary" aria-hidden="true" />
                        <p className="uppercase tracking-wide text-label-neutral text-xs font-gothic mt-1">
                            {formLabel}
                        </p>
                    </div>

                    <form onSubmit={onSubmit}>
                        <input
                            ref={firstInputRef}
                            type="text"
                            value={answer}
                            onChange={e => grammarActions.setGrammarAnswer(0, e.target.value)}
                            disabled={!!feedback?.show}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            aria-label={`${formLabel} of ${lemma}`}
                            className="w-full text-center text-2xl font-gothic bg-transparent border-b-2 border-divider focus:border-accent outline-none py-2 text-primary disabled:opacity-70"
                        />
                    </form>

                    {revealed && !feedback?.show && (
                        <div className="text-center mt-3">
                            <AnswerWithReading written={target} reading={targetReading} size="sm" />
                        </div>
                    )}
                </CardSection>

                {feedback?.show && (
                    <CardSection>
                        <p className={`text-center font-gothic text-sm ${feedback.correct ? 'text-feedback-correct' : 'text-feedback-incorrect'}`}>
                            {feedback.message}
                        </p>
                        {!feedback.correct && (
                            <div className="text-center mt-3">
                                <AnswerWithReading written={target} reading={targetReading} size="lg" />
                                {alternatives && alternatives.length > 0 && (
                                    <p className="text-xs text-tertiary font-gothic mt-2">
                                        also accepted: {alternatives.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}
                    </CardSection>
                )}

                <CardSection>
                    {feedback?.show ? (
                        <ContinueButton buttonRef={continueRef} onClick={() => grammarActions.continueGrammarToNext()} flush />
                    ) : (
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                type="button"
                                onClick={() => grammarActions.revealGrammarHint(0)}
                                disabled={revealed}
                            >
                                {revealed ? 'Revealed' : 'Reveal'}
                            </Button>
                            <Button variant="primary" type="button" className="flex-1" onClick={onSubmit}>
                                Check
                            </Button>
                        </div>
                    )}
                </CardSection>
        </QuizCardFrame>
    );
}

/**
 * The correct answer with its reading above it as furigana.
 *
 * The reading is the whole point: this drill's answers are kanji-stemmed, so
 * showing only the written form hides a READING error entirely. A learner who
 * answered たくないです for 高くないです was shown 高くないです back and had no way
 * to see that the mistake was in たか, not in the inflection they were being
 * tested on.
 *
 * Falls back to the written form alone when the two are identical, which is the
 * case for any kana-only answer (するとく, 見たい's kana twin) - furigana that
 * repeats the line below it is just noise.
 */
function AnswerWithReading({ written, reading, size }: { written: string; reading: string; size: 'sm' | 'lg' }) {
    const main = size === 'lg' ? 'text-2xl' : 'text-base';
    const rt = size === 'lg' ? 'text-[0.45em]' : 'text-[0.5em]';

    if (!reading || reading === written) {
        return <p className={`${main} font-mincho text-primary`}>{written}</p>;
    }

    return (
        <p className={`${main} font-mincho text-primary leading-loose`}>
            <ruby>
                {written}
                <rt className={`${rt} font-gothic text-tertiary select-none tracking-wide`}>{reading}</rt>
            </ruby>
        </p>
    );
}
