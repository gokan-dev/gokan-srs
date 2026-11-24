import { useEffect, useMemo } from 'react';
import type { Dispatch } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_SETTINGS } from '../../models/user.model';
import type { QuizAction, QuizState } from './quizReducer';
import type { Drill } from './drillSelectors';
import { useExerciseTurn } from './useExerciseTurn';

export interface DrillActions {
    /** Puts a drill built for its page (`path`, in `seed`'s order) on screen, its first card ready. */
    startDrill: (path: string, seed: string, drill: Drill) => void;
}

/**
 * The contrast drill's side of the provider (issue #249): its cards are answered
 * through the one exercise turn, like every card, and its Continue writes nothing
 * because a drill's exercise has no effects (effects.ts). Its run outlives its page
 * while the learner looks something up, so it is ended by where they go
 * (DRILL_ROUTE), not by the page unmounting.
 */
export function useDrillOrchestration(state: QuizState, dispatch: Dispatch<QuizAction>) {
    const { pathname } = useLocation();
    const running = state.drill !== null;
    useEffect(() => {
        if (running) dispatch({ type: 'DRILL_ROUTE', pathname });
    }, [pathname, running, dispatch]);

    const { api: drillExercise } = useExerciseTurn({
        host: 'drill',
        turn: state.turns.drill,
        dispatch,
        // Only on its page: a run kept during a lookup does not advance behind it.
        active: state.drill?.path === pathname,
        loading: false,
        romajiInput: state.settings?.romajiInput ?? DEFAULT_SETTINGS.romajiInput,
    });
    const drillActions = useMemo<DrillActions>(() => ({
        startDrill: (path, seed, drill) => dispatch({ type: 'DRILL_START', path, seed, drill }),
    }), [dispatch]);
    return { drillExercise, drillActions };
}
