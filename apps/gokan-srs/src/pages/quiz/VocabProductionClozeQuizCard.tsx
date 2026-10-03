import type { FormEvent } from "react";
import { motion } from "framer-motion";
import { useQuiz } from "../../context/useQuiz";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { useQuizFocusManagement } from "../../hooks/useQuizFocusManagement";
import { Card } from "../../components/ui/Card";
import { CardSection } from "../../components/ui/CardSection";
import { MasteryRing } from "../../components/MasteryRing";
import { JlptChip } from "../../components/JlptChip";
import { blankWidthEm } from "../../utils/blankWidth";
import { splitClozeContext, emphasizeGloss, blankSurfaceOf } from "../../utils/productionCloze.utils";
import { getCoarsePosLabels } from "./quizFormatting";
import { InteractiveSentence } from "../../components/InteractiveSentence";
import { LookUpWords } from "../../components/LookUpWords";

/**
 * The vocab production CLOZE card (issue #72): one example sentence with the
 * target word blanked, prompted by the sentence's English translation, instead
 * of a bare gloss list. Served by the vocab queue exactly like
 * VocabProductionQuizCard - both set quizType 'production' and share its
 * grading/scheduling (see useQuizOrchestration's submitAnswer) - the only
 * difference is the cue. A sentence cue disambiguates near-synonyms a gloss
 * list cannot (必ず来る vs 常に忙しい), which is the whole reason this card exists.
 *
 * VocabQuizScreen renders this instead of VocabProductionQuizCard whenever
 * state.currentProductionCloze is set (a sentence with a usable match was
 * found for this word); otherwise the gloss card is the fallback - coverage is
 * inherently partial. See VocabProductionQuizCard's doc comment for why
 * showing surrounding Japanese here is a deliberate departure from its "nothing
 * Japanese before feedback" rule: the target word itself stays hidden until
 * feedback, same as there, it's only the REST of the sentence that's visible,
 * and that's the cue that makes the item well-posed.
 *
 * Reuses the grammar quiz's cloze machinery (issue #17/#32) rather than
 * reimplementing it: the inline input sized from its own live value
 * (blankWidthEm), the gloss-then-reveal hint control, useQuizFocusManagement,
 * and the feedback conventions (border colors, bg-feedback-background). Unlike
 * GrammarQuizCard there is exactly one blank here, so none of its span/pattern/
 * strengthDeltaModifier machinery applies - this is the single-blank case.
 *
 * The surrounding Japanese context renders through the shared InteractiveSentence
 * (clickable, gloss-on-hover words), the same as every other sentence in the app,
 * with only the blanked occurrence of the target word removed (splitClozeContext).
 * The English cue emphasizes which word the blank is asking for - the matching
 * gloss bolded in the sentence, or a small gloss label when the translation
 * carries no verbatim gloss (emphasizeGloss) - since the bare translation was too
 * ambiguous to tell which word to produce.
 *
 * On anything short of a strict `correct` (wrong, confusable, pass, or a genuine
 * reading typo graded minor_error), the blank reveals the actual written word via
 * a kanji+furigana ruby right beside the input, styled text-feedback-correct -
 * not just feedback.matchedAnswer's bare reading, which is all this card used to
 * surface. The input itself is left holding whatever the user typed, same as
 * GrammarQuizCard's per-blank reveal.
 */
export function VocabProductionClozeQuizCard({ onVocabClick }: { onVocabClick?: (vocabId: string) => void }) {
    const { state, actions, computed, currentProgress } = useQuiz();
    const { isMobile } = useResponsive();

    const { currentVocab, currentProductionCloze, userAnswer, feedback, productionHintLevel } = state;

    const { firstInputRef, continueRef } = useQuizFocusManagement(
        {
            feedbackShown: !!feedback?.show,
            // A correct answer auto-advances (owned by useQuizOrchestration) - nothing to focus there.
            skipContinueFocus: !!feedback?.show && feedback.correct && !feedback.synonymRelation,
            continueFocusDelay: 50,
        },
        [currentVocab?.id, feedback]
    );

    if (!currentVocab || !currentProductionCloze) return null;

    const { sentence } = currentProductionCloze;
    const { before, after } = splitClozeContext(currentProductionCloze);
    const blankSurface = blankSurfaceOf(currentProductionCloze);
    const revealed = productionHintLevel >= 2;
    const allGlosses = currentVocab.senses.flatMap(s => s.glosses);
    const gloss = allGlosses[0] ?? '';
    const posLabels = getCoarsePosLabels(currentVocab.senses);
    // Emphasize which English word the blank is asking for (issue: too hard to
    // tell from the cue alone) - bold the matching gloss in the sentence, or fall
    // back to a small gloss label when the translation carries no verbatim gloss.
    const cueEmphasis = emphasizeGloss(sentence.en[0]?.text ?? '', allGlosses);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!feedback?.show) {
            actions.submitAnswer();
        } else if (computed.canContinue) {
            actions.continueToNext().then();
        }
    };

    const inputBorderClass = !feedback?.show
        ? revealed ? 'border-secondary' : 'border-divider focus:border-accent'
        : feedback.type === 'wrong'
            ? 'border-error'
            : feedback.type === 'minor_error' || feedback.type === 'pass'
                ? 'border-secondary'
                : 'border-accent';

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
                        <MasteryRing memoryStrength={currentProgress?.production?.memoryStrength ?? 0} size={40} />
                    </div>

                    {/* JLPT level + the word type (verb / noun / adjective) being
                        produced - a coarse cue that helps pick the right word among
                        near-synonyms, without leaking the target itself (issue). */}
                    {(currentVocab.jlptLevel || posLabels.length > 0) && (
                        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                            {currentVocab.jlptLevel && <JlptChip level={currentVocab.jlptLevel} />}
                            {posLabels.map(label => (
                                <span
                                    key={label}
                                    className="px-2 py-0.5 text-xs rounded bg-accent/10 text-accent font-gothic font-medium dark:bg-accent/15"
                                >
                                    {label}
                                </span>
                            ))}
                        </div>
                    )}

                    <p className="text-center text-sm text-secondary font-gothic mb-1">
                        Fill in the blank
                        {!cueEmphasis.inline && cueEmphasis.labelGlosses.length > 0 && (
                            <span className="text-accent font-semibold"> · {cueEmphasis.labelGlosses.join(' / ')}</span>
                        )}
                    </p>
                    <p className="text-center text-lg text-primary font-serif mb-8">
                        {cueEmphasis.inline ? (
                            <>
                                {cueEmphasis.inline.before}
                                <span className="text-accent font-bold">{cueEmphasis.inline.match}</span>
                                {cueEmphasis.inline.after}
                            </>
                        ) : (
                            sentence.en[0]?.text
                        )}
                    </p>

                    <p className="text-center text-2xl font-gothic leading-loose text-primary">
                        <InteractiveSentence sentence={before} onVocabClick={onVocabClick} showFurigana={!!feedback?.show} />
                        <span className="inline-flex flex-col items-center mx-0.5 align-middle">
                            <span className="inline-flex items-center gap-1">
                                <input
                                    ref={firstInputRef}
                                    type="text"
                                    value={userAnswer}
                                    onChange={(e) => actions.setAnswer(e.target.value)}
                                    disabled={feedback?.show || revealed}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                    style={{ width: `${blankWidthEm(userAnswer)}em` }}
                                    className={`border-b-2 bg-transparent text-center focus:outline-none transition-colors font-gothic caret-accent ${inputBorderClass}`}
                                />
                                {!feedback?.show && !revealed && (
                                    <button
                                        type="button"
                                        onClick={() => actions.revealProductionHint()}
                                        className="text-xs text-secondary hover:text-primary transition-colors font-gothic w-4 h-4 rounded-full border border-divider flex items-center justify-center shrink-0"
                                        aria-label="Show hint"
                                    >
                                        ?
                                    </button>
                                )}
                            </span>
                            {!feedback?.show && productionHintLevel === 1 && (
                                <span className="text-xs text-secondary font-gothic mt-1 whitespace-nowrap">
                                    {gloss || 'No hint available'}
                                </span>
                            )}
                            {/* The correct word, revealed right at the blank on anything
                                short of a strict match - a wrong/confusable answer previously
                                left only feedback.matchedAnswer (a bare reading) shown once
                                below the whole sentence, never the written form that was
                                actually blanked. Mirrors GrammarQuizCard's per-blank reveal. */}
                            {feedback?.show && (!feedback.correct || feedback.synonymRelation) && (
                                // The form the sentence uses (食べたら / たべたら), not the
                                // dictionary form: that is what fits the blank.
                                // Opens the word's page; the session pauses there instead of ending.
                                <button
                                    type="button"
                                    onClick={() => onVocabClick?.(currentVocab.id)}
                                    disabled={!onVocabClick}
                                    title={`Open the page for ${currentVocab.writtenForm.kanji}`}
                                    className="mt-1 rounded text-feedback-correct underline decoration-dashed underline-offset-4 decoration-1 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:no-underline"
                                >
                                    <ruby className="ruby-text">
                                        {blankSurface}
                                        <rt className="text-xs font-sans text-secondary not-italic">
                                            {currentProductionCloze.blankReading ?? feedback.matchedAnswer}
                                        </rt>
                                    </ruby>
                                </button>
                            )}
                        </span>
                        <InteractiveSentence sentence={after} onVocabClick={onVocabClick} showFurigana={!!feedback?.show} />
                    </p>
                </CardSection>

                <CardSection>
                    {feedback?.show && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className={`border rounded bg-feedback-background border-divider border-l-4 p-4 mb-4 ${feedbackBorderClass}`}
                        >
                            <p className="text-sm font-gothic text-primary">{feedback.message}</p>
                            {feedback.synonymWord && (
                                <LookUpWords
                                    words={[
                                        { vocabId: currentVocab.id, written: currentVocab.writtenForm.kanji },
                                        feedback.synonymWord,
                                    ]}
                                    onVocabClick={onVocabClick}
                                />
                            )}
                        </motion.div>
                    )}

                    {!feedback?.show ? (
                        <button
                            type="submit"
                            disabled={!computed.canSubmit}
                            className={`w-full font-medium rounded-lg transition-all duration-200 font-serif flex items-center justify-center gap-2 h-12
                                ${computed.canSubmit
                                    ? 'bg-accent text-surface hover:bg-accent-hover shadow-md hover:shadow-lg'
                                    : 'bg-accent/50 text-surface/80 cursor-not-allowed'}`}
                        >
                            <span>Submit</span>
                        </button>
                    ) : (
                        computed.canContinue && (
                            <button
                                ref={continueRef}
                                type="submit"
                                className="w-full font-medium rounded-lg transition-colors font-serif bg-accent text-surface hover:bg-accent-hover shadow-md flex items-center justify-center gap-2 h-12"
                            >
                                <span>Continue</span>
                            </button>
                        )
                    )}
                </CardSection>
            </Card>
        </motion.form>
    );
}
