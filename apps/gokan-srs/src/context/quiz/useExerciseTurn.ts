import { useEffect, useEffectEvent, useRef } from 'react';
import type { Dispatch } from 'react';
import { finishRomajiInput } from '@gokan/dataset-schema';
import { CONSTANTS } from '../../commons/constants';
import { gradeExercise } from '../../services/exercise/grading';
import { effectsOf } from '../../services/exercise/effects';
import type { Exercise, ExerciseGrade, ExerciseKind } from '../../services/exercise/types';
import type { QuizAction } from './quizReducer';
import type { ExerciseHost, ExerciseTurn } from './exerciseReducer';

/** What a card needs to run its exercise: the same for every card of every activity. */
export interface ExerciseTurnApi {
    turn: ExerciseTurn | null;
    setAnswer: (index: number, value: string) => void;
    /** One hint level more; `full` reveals the answer straight away. */
    revealHint: (index: number, full?: boolean) => void;
    submit: () => void;
    continueToNext: () => void;
    canSubmit: boolean;
    /** Whether the answer at `index` converts romaji to kana as it is typed: a Japanese slot, with the setting on. */
    convertsRomaji: (index: number) => boolean;
    /** True when feedback is up and waits for the learner rather than moving on by itself. */
    showContinue: boolean;
}

/**
 * Whether the card can be submitted with an empty answer. In a sentence cloze and
 * the conjugation drill, an empty slot is an explicit "I do not know this one"
 * (graded `pass`), and requiring every blank filled once left a card with no way
 * forward. The single-answer vocab cards keep requiring an answer, so a stray
 * Enter does not grade a pass.
 */
function submitsEmpty(kind: ExerciseKind): boolean {
    switch (kind) {
        case 'grammar-cloze':
        case 'conjugation':
            return true;
        case 'reading':
        case 'meaning':
        case 'production':
        case 'production-cloze':
        case 'grammar-choice':
        case 'study':
            return false;
    }
}

/** Whether the answer at `index` converts romaji to kana: a Japanese slot, with "Type romaji as kana" on. The one place this is decided. */
export function slotConvertsRomaji(exercise: Exercise | undefined, index: number, romajiInput: boolean): boolean {
    const slot = exercise?.slots[index];
    // A picked answer is never typed, so there is nothing to convert.
    return romajiInput && slot?.script === 'japanese' && !slot.choices;
}

/**
 * The answers as graded: on a slot that converts romaji, all of it converted and a
 * final "n" read as ん ("hon" is ほん), whatever the field last showed. Enter submits
 * without leaving the field, and a phone keyboard may still hold its last word, so
 * this is the one place that settles an answer.
 */
export function submittedAnswers(exercise: Exercise, answers: string[], romajiInput: boolean): string[] {
    return answers.map((answer, i) => (slotConvertsRomaji(exercise, i, romajiInput) ? finishRomajiInput(answer) : answer));
}

interface UseExerciseTurnOptions {
    host: ExerciseHost;
    turn: ExerciseTurn | null;
    dispatch: Dispatch<QuizAction>;
    /** True while the activity's own page is on screen: a session paused on a consult page does not move on by itself. */
    active: boolean;
    /** True while the host is still loading the card. */
    loading: boolean;
    /** The "Type romaji as kana" setting. */
    romajiInput: boolean;
    /** An optional asynchronous second opinion on a grade (the AI meaning check). `onStart` shows the card is evaluating. */
    refine?: (exercise: Exercise, grade: ExerciseGrade, answers: string[], onStart: () => void) => Promise<ExerciseGrade>;
}

/**
 * The one submit / continue flow for every exercise: grade (services/exercise),
 * decide the effects at submit with the latency frozen there, write them on
 * Continue, and move on by itself after an answer with nothing to read.
 */
export function useExerciseTurn({ host, turn, dispatch, active, loading, romajiInput, refine }: UseExerciseTurnOptions) {
    const startTimeRef = useRef<number | null>(null);

    // The clock starts when an exercise is shown; a retry served straight back is
    // the same exercise and keeps its clock, as it always has.
    const exercise = turn?.exercise;
    useEffect(() => {
        if (exercise) startTimeRef.current = Date.now();
    }, [exercise]);

    const continueToNext = () => {
        if (!turn) return;
        // The study card asks nothing, so it is never submitted: its Continue writes
        // the effects of an empty answer, which only push the due date out.
        const effects = turn.feedback?.effects
            ?? (turn.exercise.kind === 'study' ? effectsOf(turn.exercise, gradeExercise(turn.exercise, [], []), { latencyMs: 0, hintLevels: [], answers: [] }) : null);
        if (!effects) return;
        dispatch({ type: 'EXERCISE_CONTINUE', host, effects, now: new Date() });
    };

    const submit = async () => {
        if (!turn || turn.feedback || turn.isEvaluating) return;
        // Frozen here, before any AI check and before the learner reads the answer:
        // time spent on the feedback must not count as a slow answer.
        const latencyMs = startTimeRef.current ? Date.now() - startTimeRef.current : 5000;
        const answers = submittedAnswers(turn.exercise, turn.answers, romajiInput);
        // The field shows the answer as graded (ほん, not ほn).
        answers.forEach((answer, index) => {
            if (answer !== turn.answers[index]) dispatch({ type: 'EXERCISE_SET_ANSWER', host, index, value: answer });
        });
        let grade = gradeExercise(turn.exercise, answers, turn.hintLevels);
        if (refine) grade = await refine(turn.exercise, grade, answers, () => dispatch({ type: 'EXERCISE_EVALUATING', host }));
        const effects = effectsOf(turn.exercise, grade, { latencyMs, hintLevels: turn.hintLevels, answers });
        dispatch({ type: 'EXERCISE_SUBMITTED', host, feedback: { grade, effects } });
    };

    const advance = useEffectEvent(continueToNext);
    const feedback = turn?.feedback;
    useEffect(() => {
        if (!active || !feedback?.grade.autoAdvance) return;
        const timer = setTimeout(advance, CONSTANTS.quiz.correctAnswerAutoAdvanceDelay);
        return () => clearTimeout(timer);
    }, [feedback, active]);

    const api: ExerciseTurnApi = {
        turn,
        setAnswer: (index, value) => dispatch({ type: 'EXERCISE_SET_ANSWER', host, index, value }),
        revealHint: (index, full) => dispatch({ type: 'EXERCISE_REVEAL_HINT', host, index, ...(full ? { full } : {}) }),
        submit: () => void submit(),
        continueToNext,
        canSubmit: !!turn && !turn.feedback && !turn.isEvaluating && !loading
            && turn.exercise.slots.length > 0
            && (submitsEmpty(turn.exercise.kind) || turn.answers.some(a => a.trim().length > 0)),
        convertsRomaji: index => slotConvertsRomaji(turn?.exercise, index, romajiInput),
        showContinue: !!turn?.feedback && !turn.feedback.grade.autoAdvance,
    };

    /** A card left unanswered must not be scored on the time spent away (a consult page paused the session). */
    const restartClock = () => {
        if (!turn?.feedback && startTimeRef.current !== null) startTimeRef.current = Date.now();
    };

    return { api, restartClock };
}
