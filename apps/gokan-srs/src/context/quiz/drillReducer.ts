// src/context/quiz/drillReducer.ts
//
// The contrast drill's run (issue #249): started with its cards, ended when its page
// closes. Answering its cards is the shared exercise turn (host `drill`); the turn's
// Continue moves to the next card (exerciseReducer.ts). Nothing here touches progress.
import type { QuizState } from './quizReducer';
import type { Drill, DrillRun } from './drillSelectors';
import { newTurn, withTurn } from './exerciseReducer';

export interface DrillQuizState {
    /** The drill on screen, or null. Never stored. */
    drill: DrillRun | null;
}

export const initialDrillState: DrillQuizState = { drill: null };

export type DrillQuizAction =
    | { type: 'DRILL_START'; drill: Drill }
    | { type: 'DRILL_END' };

export function isDrillAction(action: { type: string }): action is DrillQuizAction {
    return action.type.startsWith('DRILL_');
}

export function drillReducer(state: QuizState, action: DrillQuizAction): QuizState {
    switch (action.type) {
        case 'DRILL_START': {
            const [first] = action.drill.cards;
            return { ...withTurn(state, 'drill', first ? newTurn(first.exercise) : null), drill: { drill: action.drill, index: 0, picks: [] } };
        }
        case 'DRILL_END':
            return { ...withTurn(state, 'drill', null), drill: null };
    }
}
