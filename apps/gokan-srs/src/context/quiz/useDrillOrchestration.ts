import { useMemo } from 'react';
import type { Dispatch } from 'react';
import { DEFAULT_SETTINGS } from '../../models/user.model';
import type { QuizAction, QuizState } from './quizReducer';
import type { Drill } from './drillSelectors';
import { useExerciseTurn } from './useExerciseTurn';

export interface DrillActions {
    /** Puts a built drill on screen, its first card ready. */
    startDrill: (drill: Drill) => void;
    /** Clears it: its page closed. */
    endDrill: () => void;
}

/**
 * The contrast drill's side of the provider (issue #249): its cards are answered
 * through the one exercise turn, like every card, and its Continue writes nothing
 * because a drill's exercise has no effects (effects.ts).
 */
export function useDrillOrchestration(state: QuizState, dispatch: Dispatch<QuizAction>) {
    const { api: drillExercise } = useExerciseTurn({
        host: 'drill',
        turn: state.turns.drill,
        dispatch,
        active: state.drill !== null,
        loading: false,
        romajiInput: state.settings?.romajiInput ?? DEFAULT_SETTINGS.romajiInput,
    });
    const drillActions = useMemo<DrillActions>(() => ({
        startDrill: drill => dispatch({ type: 'DRILL_START', drill }),
        endDrill: () => dispatch({ type: 'DRILL_END' }),
    }), [dispatch]);
    return { drillExercise, drillActions };
}
