import { useEffect, useRef } from 'react';
import type { DependencyList } from 'react';

interface UseQuizFocusManagementOptions {
    /** True once an answer has been submitted and feedback is being shown for the current question. */
    feedbackShown: boolean;
    /**
     * Skip moving focus to Continue - used when the current feedback is about to
     * auto-advance on its own (a correct reading answer, a fully-correct grammar
     * answer), so focus isn't yanked onto a button about to disappear.
     */
    skipContinueFocus?: boolean;
    /** Delay (ms) before focusing Continue once feedback shows - lets a reveal animation finish first. Defaults to 0. */
    continueFocusDelay?: number;
}

/**
 * Single owner of "what should be focused and when" for a quiz card, shared
 * by every card shell (SingleAnswerCard, SentenceClozeCard, StudyCard):
 * focus the first input on a fresh question (or when feedback clears for a
 * retry), and focus the Continue button once feedback is showing and
 * continuing doesn't require re-typing - so the keyboard-only flow (Enter to
 * submit, Enter again to continue) works on both activities.
 *
 * `deps` drives re-running the effect exactly like a normal useEffect
 * dependency array - pass whatever identifies "a new question or a change in
 * feedback" for the calling card (e.g. `[currentVocab?.id, feedback]`).
 */
export function useQuizFocusManagement(
    { feedbackShown, skipContinueFocus = false, continueFocusDelay = 0 }: UseQuizFocusManagementOptions,
    deps: DependencyList
) {
    const firstInputRef = useRef<HTMLInputElement | null>(null);
    const continueRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!feedbackShown) {
            const timer = setTimeout(() => firstInputRef.current?.focus(), 0);
            return () => clearTimeout(timer);
        }

        if (skipContinueFocus) return;

        const timer = setTimeout(() => continueRef.current?.focus(), continueFocusDelay);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller supplies what identifies a new question as deps
    }, deps);

    return { firstInputRef, continueRef };
}
