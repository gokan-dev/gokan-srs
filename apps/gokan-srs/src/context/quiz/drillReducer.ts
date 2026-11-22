// src/context/quiz/drillReducer.ts
//
// The contrast drill's run (issue #249): started with its cards on its page, kept while
// the learner looks something up from it, ended once they go anywhere else. Answering
// its cards is the shared exercise turn (host `drill`); on its Continue, drillContinued
// moves to the next card. Nothing here touches progress.
import type { QuizState } from './quizReducer';
import type { Drill, DrillRun } from './drillSelectors';
import { pickOf } from './drillSelectors';
import { newTurn, withTurn } from './exerciseReducer';
import { drillRouteRole } from './sessionRoutes';

export interface DrillQuizState {
    /** The drill being answered, or null. Never stored. */
    drill: DrillRun | null;
}

export const initialDrillState: DrillQuizState = { drill: null };

export type DrillQuizAction =
    /** A drill built for its page (`path`) in `seed`'s order: its first card on screen. Replaces any other run. */
    | { type: 'DRILL_START'; path: string; seed: string; drill: Drill }
    /** The learner is on `pathname`: a run ends there unless it is the drill's page or a lookup (drillRouteRole). */
    | { type: 'DRILL_ROUTE'; pathname: string };

export function isDrillAction(action: { type: string }): action is DrillQuizAction {
    return action.type.startsWith('DRILL_');
}

export function drillReducer(state: QuizState, action: DrillQuizAction): QuizState {
    switch (action.type) {
        case 'DRILL_START': {
            const [first] = action.drill.cards;
            return {
                ...withTurn(state, 'drill', first ? newTurn(first) : null),
                drill: { path: action.path, seed: action.seed, drill: action.drill, index: 0, picks: [] },
            };
        }
        case 'DRILL_ROUTE':
            if (!state.drill || drillRouteRole(action.pathname, state.drill.path) !== 'leave') return state;
            return { ...withTurn(state, 'drill', null), drill: null };
    }
}

/**
 * After the exercise turn's Continue on a drill card (`next`, from `before`): the next
 * card comes up, and what was picked is kept for the summary. Nothing else.
 */
export function drillContinued(before: QuizState, next: QuizState): QuizState {
    const run = before.drill;
    const turn = before.turns.drill;
    const card = run?.drill.cards[run.index];
    if (!run || !card || !turn) return next;
    const index = run.index + 1;
    const following = run.drill.cards[index];
    return {
        ...withTurn(next, 'drill', following ? newTurn(following) : null),
        drill: { ...run, index, picks: [...run.picks, pickOf(card, turn.answers[0] ?? '', turn.feedback?.grade.overall === 'correct')] },
    };
}
