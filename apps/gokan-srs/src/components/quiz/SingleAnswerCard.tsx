import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRightLeft, BookOpenText, Languages, PenLine } from "lucide-react";
import type { ExerciseTurnApi } from "../../context/quiz/useExerciseTurn";
import type { SlotGrade } from "../../services/exercise/types";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { useQuizFocusManagement } from "../../hooks/useQuizFocusManagement";
import { CONSTANTS } from "../../commons/constants";
import { CardSection } from "../ui/CardSection";
import { Button } from "../ui/Button";
import { LookUpWords } from "../LookUpWords";
import { QuizCardFrame } from "./QuizCardFrame";
import { FeedbackNote } from "./FeedbackNote";
import { ContinueButton, SubmitButton } from "./QuizButtons";

/** The exercises asked with one typed answer. */
export type SingleAnswerKind = 'reading' | 'meaning' | 'production' | 'conjugation';

/**
 * Always-visible "which phase am I in" indicator. Reading and meaning quizzes
 * are visually similar enough (especially on a small phone screen, glanced at
 * quickly) that a switch between them can go unnoticed - leading to a reading
 * answer typed into a meaning quiz (or vice versa) purely out of autopilot.
 * Deliberately not colored per the design system's "minimize colors" rule;
 * the icon + label pairing carries the distinction instead of a hue.
 */
const KIND_LABELS: Record<SingleAnswerKind, { icon: typeof BookOpenText; label: string }> = {
    reading: { icon: BookOpenText, label: 'Reading' },
    meaning: { icon: Languages, label: 'Meaning' },
    production: { icon: PenLine, label: 'Production' },
    conjugation: { icon: ArrowRightLeft, label: 'Conjugation' },
};

const KindIndicator: React.FC<{ kind: SingleAnswerKind }> = ({ kind }) => {
    const { icon: Icon, label } = KIND_LABELS[kind];
    return (
        <div className="flex items-center justify-center gap-1.5 mb-3 text-secondary">
            <Icon size={13} strokeWidth={2} />
            <span className="text-[11px] font-gothic font-medium uppercase tracking-wider">
                {label}
            </span>
        </div>
    );
};

interface SingleAnswerCardProps {
    api: ExerciseTurnApi;
    kind: SingleAnswerKind;
    /** The prompt: what the learner answers from. */
    children: React.ReactNode;
    inputLabel: string;
    inputPlaceholder: string;
    /** The correct answer shown after a miss, and once a revealed hint shows it; the graded form by default. */
    correctAnswer?: (grade: SlotGrade | null) => React.ReactNode;
    /** Offers a Reveal button that shows the answer before submitting (graded a near miss). */
    revealable?: boolean;
    /** Opens a word's page: the tested word and the near-synonym typed instead, if any. */
    onVocabClick?: (vocabId: string) => void;
}

/**
 * The card for every exercise answered with one typed answer (reading, meaning,
 * production from a gloss, the conjugation drill): the prompt on top, the input,
 * submit and feedback below. The sentence clozes put their inputs inside the
 * sentence instead (SentenceClozeCard), with the same building blocks.
 */
export function SingleAnswerCard({
    api,
    kind,
    children,
    inputLabel,
    inputPlaceholder,
    correctAnswer,
    revealable = false,
    onVocabClick,
}: SingleAnswerCardProps) {
    const { isMobile } = useResponsive();
    const { turn } = api;
    const feedback = turn?.feedback ?? null;
    const grade = feedback?.grade ?? null;
    const slotGrade = grade?.slots[0] ?? null;
    const correct = grade?.overall === 'correct';
    const synonym = slotGrade?.synonym;
    const revealed = (turn?.hintLevels[0] ?? 0) >= 2;

    // The feedback whose correct answer has been revealed. Keyed by the feedback object,
    // so a new answer (or a new card) starts hidden without resetting state in an effect.
    const [revealedFor, setRevealedFor] = useState<object | null>(null);
    const [isInputFocused, setIsInputFocused] = useState(false);

    // Compact mode: reduce spacing when keyboard is active on mobile
    const isCompact = isMobile && isInputFocused && !feedback;

    // Reveals the correct answer a beat after an incorrect submission, giving
    // the shake animation a moment before the reveal appears. Focus (input on
    // a fresh question, Continue once feedback is showing) is a separate
    // concern owned by useQuizFocusManagement, shared with the sentence clozes.
    useEffect(() => {
        if (feedback && !correct) {
            const timer = setTimeout(() => setRevealedFor(feedback), CONSTANTS.quiz.incorrectAnswerRevealDelay);
            return () => clearTimeout(timer);
        }
    }, [feedback, correct]);
    const showCorrectAnswer = feedback !== null && revealedFor === feedback;

    const { firstInputRef: inputRef, continueRef } = useQuizFocusManagement(
        {
            feedbackShown: !!feedback,
            // An answer with nothing to read moves on by itself (useExerciseTurn): nothing to focus there.
            skipContinueFocus: !!grade?.autoAdvance,
            continueFocusDelay: feedback && !correct ? CONSTANTS.quiz.incorrectAnswerRevealDelay : 50,
        },
        [turn?.exercise, feedback]
    );

    if (!turn) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedback) api.submit();
        else if (api.showContinue) api.continueToNext();
    };

    const renderCorrectAnswer = () => (correctAnswer ? correctAnswer(slotGrade) : slotGrade?.shown);

    // The tested word and the near-synonym typed instead, to look either up.
    const testedWord = turn.exercise.slots[0]?.word;
    const lookUp = synonym && (
        <LookUpWords
            words={[
                ...(testedWord?.vocabId ? [{ vocabId: testedWord.vocabId, written: testedWord.headword }] : []),
                { vocabId: synonym.vocabId, written: synonym.written },
            ]}
            onVocabClick={onVocabClick}
        />
    );

    return (
        <QuizCardFrame onSubmit={handleSubmit}>
            {/* Shake Animation for Wrong Answer */}
            <AnimatePresence>
                {feedback && !correct && (
                    <motion.div
                        initial={{ x: 0 }}
                        animate={{ x: [-5, 5, -5, 5, 0] }}
                        transition={{ duration: 0.4 }}
                        className="absolute inset-0 pointer-events-none border-4 border-error/20 rounded-xl z-50"
                    />
                )}
            </AnimatePresence>

            {/* Top Section: the prompt */}
            <CardSection className={isCompact ? '!mb-3' : ''}>
                <KindIndicator kind={kind} />
                {children}
            </CardSection>

            {/* Bottom Section: Input & Feedback */}
            <CardSection className={isCompact ? '!mb-0' : ''}>
                <div className={isCompact ? 'space-y-2' : 'space-y-4'}>
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
                            value={turn.answers[0] ?? ''}
                            onChange={(e) => api.setAnswer(0, e.target.value)}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            className={`w-full border rounded-lg text-center transition-all duration-200
                                font-gothic bg-surface text-primary placeholder:text-input-placeholder caret-accent
                                focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10
                                ${isMobile ? 'px-3 py-2 text-lg placeholder:text-sm' : 'px-4 py-3 text-xl'}
                                ${feedback && !correct ? 'border-error' : 'border-divider'}
                            `}
                            placeholder={inputPlaceholder}
                            autoFocus
                            // Left enabled once revealed, so Enter still submits: a revealed
                            // answer grades as a near miss whatever the input holds.
                            disabled={!!feedback}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                        />
                    </div>

                    {/* The answer, revealed before submitting: the input already holds it. */}
                    {revealed && !feedback && (
                        <div className="text-center text-primary font-gothic">{renderCorrectAnswer()}</div>
                    )}

                    {/* A near-synonym that answers this card: correct, but the message
                        names the word that was actually being tested. */}
                    {feedback && correct && synonym && (
                        <FeedbackNote accentClass="border-l-accent">
                            <p className="text-secondary text-sm font-gothic">{grade.message}</p>
                            {lookUp}
                        </FeedbackNote>
                    )}

                    {/* Incorrect / Minor Answer Feedback */}
                    {feedback && !correct && (
                        <FeedbackNote accentClass={grade?.overall === 'minor_error' ? 'border-l-secondary' : 'border-l-error-accent'}>
                            <p className="uppercase tracking-wide text-label-neutral text-xs mb-2 font-gothic">
                                Correct answer
                            </p>

                            {/* A near-synonym collision names the word being tested even on a
                                confusable answer graded wrong, so the message shows whenever a
                                synonym was typed, not just on minor_error. */}
                            {(grade?.overall === 'minor_error' || synonym) && (
                                <p className="text-secondary text-sm mb-2 font-gothic">
                                    {grade?.message}
                                </p>
                            )}

                            {showCorrectAnswer && (
                                <div className="transition-all duration-200 ease-in-out">
                                    <div className="text-center text-xl mb-1 text-primary font-gothic">
                                        {renderCorrectAnswer()}
                                    </div>
                                </div>
                            )}
                            {lookUp}
                        </FeedbackNote>
                    )}

                    {/* Correct Answer Feedback. Not for a correct-via-synonym answer:
                        that already shows the synonym note above, which names the word
                        tested, and this generic box too would print the message twice. */}
                    {feedback && correct && !synonym && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="border rounded bg-surface border-accent p-4"
                        >
                            <div className="flex items-center justify-center gap-2">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <circle cx="10" cy="10" r="9" className="stroke-accent" strokeWidth="2" />
                                    <path d="M6 10L9 13L14 7" className="stroke-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <p className="text-center text-sm font-medium text-accent font-gothic">
                                    {grade.message}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {!feedback ? (
                        revealable ? (
                            <div className="flex gap-2 items-start">
                                <Button
                                    variant="secondary"
                                    type="button"
                                    className={isMobile ? 'h-10 mt-4' : 'h-12 mt-6'}
                                    onClick={() => api.revealHint(0, true)}
                                    disabled={revealed}
                                >
                                    {revealed ? 'Revealed' : 'Reveal'}
                                </Button>
                                <div className="flex-1">
                                    <SubmitButton canSubmit={api.canSubmit} evaluating={turn.isEvaluating} showEnterKey />
                                </div>
                            </div>
                        ) : (
                            <SubmitButton canSubmit={api.canSubmit} evaluating={turn.isEvaluating} showEnterKey />
                        )
                    ) : (
                        api.showContinue && <ContinueButton buttonRef={continueRef} showEnterKey />
                    )}
                </div>
            </CardSection>
        </QuizCardFrame>
    );
}
