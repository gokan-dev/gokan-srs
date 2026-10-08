import type { QuizState, VocabHistoryItem } from './quizReducer';
import type { GrammarHistoryItem } from './grammarReducer';
import type { Exercise, ExerciseGrade } from '../../services/exercise/types';
import { applyEffects } from '../../services/exercise/effects';
import type { Effect } from '../../services/exercise/effects';
import { addToGains } from './sessionGains';

/** The two activities that serve exercises; each has at most one exercise on screen. */
export type ExerciseHost = 'vocab' | 'grammar';

export interface ExerciseFeedback {
    grade: ExerciseGrade;
    /** What Continue writes to the learner's progress (services/exercise/effects.ts). */
    effects: Effect[];
}

/**
 * One exercise being answered: the same state for every card of every activity,
 * so typing, hints, feedback and Continue behave identically everywhere.
 */
export interface ExerciseTurn {
    exercise: Exercise;
    /** One per slot. */
    answers: string[];
    /** One per slot: 0 none, 1 gloss shown, 2 answer revealed into `answers` (graded a near miss). */
    hintLevels: number[];
    feedback: ExerciseFeedback | null;
    /** True while an answer is being checked asynchronously (the AI meaning check). */
    isEvaluating: boolean;
}

export interface ExerciseTurnsState {
    turns: Record<ExerciseHost, ExerciseTurn | null>;
}

export const initialExerciseTurns: ExerciseTurnsState = { turns: { vocab: null, grammar: null } };

export function newTurn(exercise: Exercise): ExerciseTurn {
    return { exercise, answers: exercise.slots.map(() => ''), hintLevels: exercise.slots.map(() => 0), feedback: null, isEvaluating: false };
}

/** The same exercise, ready to be answered again (a retry served straight back is not reloaded). */
export function clearedTurn(turn: ExerciseTurn): ExerciseTurn {
    return newTurn(turn.exercise);
}

export function withTurn(state: QuizState, host: ExerciseHost, turn: ExerciseTurn | null): QuizState {
    return { ...state, turns: host === 'vocab' ? { ...state.turns, vocab: turn } : { ...state.turns, grammar: turn } };
}

export type ExerciseAction =
    | { type: 'EXERCISE_SET_ANSWER'; host: ExerciseHost; index: number; value: string }
    /** One hint level more, or straight to the answer with `full` (a card whose only hint is the answer). */
    | { type: 'EXERCISE_REVEAL_HINT'; host: ExerciseHost; index: number; full?: boolean }
    | { type: 'EXERCISE_EVALUATING'; host: ExerciseHost }
    | { type: 'EXERCISE_SUBMITTED'; host: ExerciseHost; feedback: ExerciseFeedback }
    /** Writes the answer's effects to the CURRENT progress, so a Drive reconcile landing between submit and Continue is kept. `now` comes from the caller. */
    | { type: 'EXERCISE_CONTINUE'; host: ExerciseHost; effects: Effect[]; now: Date };

/** Every exercise action is prefixed EXERCISE_, so quizReducer can delegate without knowing their shapes. */
export function isExerciseAction(action: { type: string }): action is ExerciseAction {
    return action.type.startsWith('EXERCISE_');
}

export function exerciseReducer(state: QuizState, action: ExerciseAction): QuizState {
    const turn = state.turns[action.host];

    switch (action.type) {
        case 'EXERCISE_SET_ANSWER': {
            if (!turn) return state;
            const answers = [...turn.answers];
            answers[action.index] = action.value;
            return withTurn(state, action.host, { ...turn, answers });
        }

        case 'EXERCISE_REVEAL_HINT': {
            if (!turn) return state;
            const hintLevels = [...turn.hintLevels];
            const next = action.full ? 2 : Math.min(2, (hintLevels[action.index] ?? 0) + 1);
            hintLevels[action.index] = next;
            // Revealing writes the answer into the input rather than the card
            // substituting it at render time: what the input shows and what state
            // holds must agree, or Submit stays disabled on a card that looks
            // answered. Grading is unaffected (a revealed slot is a near miss
            // whatever it holds).
            const reveal = turn.exercise.slots[action.index]?.reveal;
            if (next < 2 || !reveal) return withTurn(state, action.host, { ...turn, hintLevels });
            const answers = [...turn.answers];
            answers[action.index] = reveal;
            return withTurn(state, action.host, { ...turn, hintLevels, answers });
        }

        case 'EXERCISE_EVALUATING':
            return turn ? withTurn(state, action.host, { ...turn, isEvaluating: true }) : state;

        case 'EXERCISE_SUBMITTED':
            return turn ? withTurn(state, action.host, { ...turn, feedback: action.feedback, isEvaluating: false }) : state;

        case 'EXERCISE_CONTINUE': {
            if (!state.progress) return state;
            const { progress, record } = applyEffects(state.progress, action.effects, { now: action.now, settings: state.settings });
            const next = { ...withTurn(state, action.host, turn && clearedTurn(turn)), progress };
            if (!record) return next;

            const credit = record.vocabDelta > 0 ? { vocabDelta: record.vocabDelta, vocabBreakdown: record.vocabBreakdown } : {};
            switch (record.item.kind) {
                case 'vocab': {
                    const entry: VocabHistoryItem = { vocabId: record.item.vocabId, writtenForm: record.label, result: record.result, delta: record.delta, ...credit };
                    return {
                        ...next,
                        sessionHistory: [entry, ...state.sessionHistory].slice(0, 50),
                        sessionGains: addToGains(state.sessionGains, record.delta, record.vocabDelta),
                        introCandidates: state.introCandidates.filter(c => c.id !== entry.vocabId),
                    };
                }
                case 'grammar': {
                    const entry: GrammarHistoryItem = { grammarId: record.item.grammarId, title: record.label, result: record.result, delta: record.delta, ...credit };
                    return {
                        ...next,
                        grammarSessionHistory: [entry, ...state.grammarSessionHistory].slice(0, 50),
                        grammarSessionGains: addToGains(state.grammarSessionGains, record.delta, record.vocabDelta),
                    };
                }
            }
        }
    }
}
