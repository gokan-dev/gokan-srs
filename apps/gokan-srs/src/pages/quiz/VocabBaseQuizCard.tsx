import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { BookOpenText, Languages, PenLine } from "lucide-react";
import type { QuizType } from "../../utils/srs.utils";
import { useQuiz } from "../../context/useQuiz";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { useQuizFocusManagement } from "../../hooks/useQuizFocusManagement";
import { CONSTANTS } from "../../commons/constants";
import { Card } from "../../components/ui/Card";
import { CardSection } from "../../components/ui/CardSection";

/**
 * Always-visible "which phase am I in" indicator. Reading and meaning quizzes
 * are visually similar enough (especially on a small phone screen, glanced at
 * quickly) that a switch between them can go unnoticed - leading to a reading
 * answer typed into a meaning quiz (or vice versa) purely out of autopilot.
 * Deliberately not colored per the design system's "minimize colors" rule;
 * the icon + label pairing carries the distinction instead of a hue.
 */
const QUIZ_TYPE_LABELS: Record<QuizType, { icon: typeof BookOpenText; label: string }> = {
    reading: { icon: BookOpenText, label: 'Reading' },
    meaning: { icon: Languages, label: 'Meaning' },
    production: { icon: PenLine, label: 'Production' },
};

const QuizTypeIndicator: React.FC<{ quizType: QuizType }> = ({ quizType }) => {
    const { icon: Icon, label } = QUIZ_TYPE_LABELS[quizType];
    return (
        <div className="flex items-center justify-center gap-1.5 mb-3 text-secondary-400">
            <Icon size={13} strokeWidth={2} />
            <span className="text-[11px] font-gothic font-medium uppercase tracking-wider">
                {label}
            </span>
        </div>
    );
};

interface VocabBaseQuizCardProps {
    children: React.ReactNode;
    inputLabel: string;
    inputPlaceholder: string;
    renderCorrectAnswer?: () => React.ReactNode;
    onInputFocus?: () => void;
    onInputBlur?: () => void;
}

/** Shared shell (input/submit/feedback) for vocab's two quiz cards (VocabQuizCard, VocabMeaningQuizCard). Vocab-only - GrammarQuizCard needs multiple discrete inputs and owns its own markup instead. */
export function VocabBaseQuizCard({
    children,
    inputLabel,
    inputPlaceholder,
    renderCorrectAnswer,
    onInputFocus,
    onInputBlur
}: VocabBaseQuizCardProps) {
    const { state, actions, computed } = useQuiz();
    const { isMobile } = useResponsive();

    // Local state for UI effects
    const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);

    // Get data from centralized state
    const { currentVocab, userAnswer, feedback } = state;

    // Compact mode: reduce spacing when keyboard is active on mobile
    const isCompact = isMobile && isInputFocused && !feedback?.show;

    // Reveals the correct answer a beat after an incorrect submission, giving
    // the shake animation a moment before the reveal appears. Focus (input on
    // a fresh question, Continue once feedback is showing) is a separate
    // concern owned by useQuizFocusManagement, shared with the grammar quiz.
    useEffect(() => {
        setShowCorrectAnswer(false);

        if (feedback?.show && !feedback.correct) {
            const timer = setTimeout(() => setShowCorrectAnswer(true), CONSTANTS.quiz.incorrectAnswerRevealDelay);
            return () => clearTimeout(timer);
        }
    }, [currentVocab?.id, feedback]);

    const { firstInputRef: inputRef, continueRef } = useQuizFocusManagement(
        {
            feedbackShown: !!feedback?.show,
            // A correct reading answer auto-advances (owned by useQuizOrchestration) - nothing to focus there.
            skipContinueFocus: !!feedback?.show && feedback.correct && state.currentQuizItem?.quizType !== 'meaning',
            continueFocusDelay: feedback?.show && !feedback.correct ? CONSTANTS.quiz.incorrectAnswerRevealDelay : 50,
        },
        [currentVocab?.id, feedback, state.currentQuizItem?.quizType]
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!feedback?.show) {
            actions.submitAnswer();
        } else if (computed.canContinue) {
            actions.continueToNext().then();
        }
    };

    const handleInputFocus = () => {
        setIsInputFocused(true);
        onInputFocus?.();
    };

    const handleInputBlur = () => {
        setIsInputFocused(false);
        onInputBlur?.();
    };

    if (!currentVocab) return null;

    return (
        <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
        >
            <Card size="lg" className={isMobile ? '!p-4' : ''}>
                {/* Shake Animation for Wrong Answer */}
                <AnimatePresence>
                    {feedback?.show && !feedback.correct && (
                        <motion.div
                            initial={{ x: 0 }}
                            animate={{ x: [-5, 5, -5, 5, 0] }}
                            transition={{ duration: 0.4 }}
                            className="absolute inset-0 pointer-events-none border-4 border-error/20 rounded-xl z-50"
                        />
                    )}
                </AnimatePresence>

                {/* Top Section: Content (Sentences, Kanji, etc.) */}
                <CardSection className={isCompact ? '!mb-3' : ''}>
                    {state.currentQuizItem && (
                        <QuizTypeIndicator quizType={state.currentQuizItem.quizType} />
                    )}
                    {children}
                </CardSection>

                {/* Bottom Section: Input & Feedback */}
                <CardSection className={isCompact ? '!mb-0' : ''}>
                    <div className={isCompact ? 'space-y-2' : 'space-y-4'}>
                        {/* Input Field */}
                        <div className="relative">
                            <label
                                htmlFor="answer"
                                className={`block mb-2 text-secondary font-gothic font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}
                            >
                                {inputLabel}
                            </label>
                            <input
                                ref={inputRef}
                                id="answer"
                                type="text"
                                value={userAnswer}
                                onChange={(e) => actions.setAnswer(e.target.value)}
                                onFocus={handleInputFocus}
                                onBlur={handleInputBlur}
                                className={`w-full border rounded-lg text-center transition-all duration-200 
                                    font-gothic bg-surface text-primary placeholder:text-input-placeholder caret-accent
                                    focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10
                                    ${isMobile ? 'px-3 py-2 text-lg placeholder:text-sm' : 'px-4 py-3 text-xl'}
                                    ${feedback?.show && !feedback.correct ? 'border-error' : 'border-divider'}
                                `}
                                placeholder={inputPlaceholder}
                                autoFocus
                                disabled={feedback?.show}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
                            />
                        </div>

                        {/* Incorrect / Minor Answer Feedback */}
                        {feedback?.show && !feedback.correct && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className={`border rounded bg-feedback-background border-divider border-l-4 p-4 ${feedback.type === 'minor_error' ? 'border-l-secondary' : 'border-l-error-accent'}`}
                            >
                                <p className="uppercase tracking-wide text-label-neutral text-xs mb-2 font-gothic">
                                    Correct answer
                                </p>

                                {/* A near-synonym collision (issue #71 Part B) names the word
                                    being tested even on a 'wrong'-typed confusable answer, so
                                    the message shows whenever synonymRelation is set, not just
                                    on minor_error. */}
                                {(feedback.type === 'minor_error' || feedback.synonymRelation) && (
                                    <p className="text-secondary text-sm mb-2 font-gothic">
                                        {feedback.message}
                                    </p>
                                )}

                                {showCorrectAnswer && (
                                    <div
                                        className="transition-all duration-200 ease-in-out"
                                        style={{
                                            opacity: showCorrectAnswer ? 1 : 0,
                                            transform: showCorrectAnswer
                                                ? 'translateY(0)'
                                                : 'translateY(-2px)',
                                        }}
                                    >
                                        <div className="text-center text-xl mb-1 text-primary font-gothic">
                                            {renderCorrectAnswer ? renderCorrectAnswer() : feedback.matchedAnswer}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Correct Answer Feedback */}
                        {feedback?.show && feedback.correct && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="border rounded bg-surface border-accent p-4"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <circle
                                            cx="10"
                                            cy="10"
                                            r="9"
                                            className="stroke-accent"
                                            strokeWidth="2"
                                        />
                                        <path
                                            d="M6 10L9 13L14 7"
                                            className="stroke-accent"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                    <p className="text-center text-sm font-medium text-accent font-gothic">
                                        {feedback.message}
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* Action Button */}
                        {!feedback?.show ? (
                            <div className="group">
                                <button
                                    type="submit"
                                    disabled={!computed.canSubmit || state.isEvaluatingAi}
                                    onMouseDown={(e) => e.preventDefault()}
                                    className={`w-full font-medium rounded-lg transition-all duration-200 font-serif flex items-center justify-center gap-2
                                        ${isMobile ? 'h-10 mt-4' : 'h-12 mt-6'}
                                        ${computed.canSubmit && !state.isEvaluatingAi
                                            ? 'bg-accent text-surface hover:bg-accent-hover shadow-md hover:shadow-lg translate-y-0 active:translate-y-[1px]'
                                            : 'bg-accent/50 text-surface/80 cursor-not-allowed'}`}
                                >
                                    {state.isEvaluatingAi ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Evaluating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Submit</span>
                                            {computed.canSubmit && <span className="text-xs opacity-70">⏎</span>}
                                        </>
                                    )}
                                </button>
                                {/* Only show hint on non-mobile when not ready */}
                                {(!computed.canSubmit && !isMobile && !state.isEvaluatingAi) && (
                                    <p className="text-center text-xs text-tertiary mt-2 h-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        Press Enter
                                    </p>
                                )}
                            </div>
                        ) : (
                            // Show Continue button if incorrect OR if it's a Meaning Quiz (which doesn't auto-advance)
                            (!feedback.correct || state.currentQuizItem?.quizType === 'meaning') && (
                                <button
                                    ref={continueRef}
                                    type="submit"
                                    className={`w-full font-medium rounded-lg transition-colors font-serif bg-accent text-surface hover:bg-accent-hover shadow-md flex items-center justify-center gap-2
                                        ${isMobile ? 'h-10 mt-4' : 'h-12 mt-6'}`}
                                >
                                    <span>Continue</span>
                                    <span className="text-xs opacity-70">⏎</span>
                                </button>
                            )
                        )}
                    </div>
                </CardSection>
            </Card>
        </motion.form>
    );
}
