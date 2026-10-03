import { useEffect } from 'react';
import { CONSTANTS } from '../../commons/constants';
import type { SessionRouteRole } from './sessionRoutes';

export type SessionTransition = 'start' | 'resume' | 'suspend' | 'end' | null;

/** The part of a session the lifecycle reads: whether it exists and whether it is paused. */
export interface LifecycleSession {
    /** Epoch ms at which the session was paused by a consult page, absent while it runs. */
    suspendedAt?: number;
}

export const SESSION_SUSPEND_TTL_MS = CONSTANTS.srs.sessionSuspendTtlMinutes * 60 * 1000;

/**
 * What the session should do now, given where the learner is. Pure, so the whole
 * table is testable without rendering:
 *
 * | route    | session                   | transition                    |
 * | -------- | ------------------------- | ----------------------------- |
 * | activity | none, work to do          | start                         |
 * | activity | running, no work left     | end                           |
 * | activity | paused, within the TTL    | resume                        |
 * | activity | paused, past the TTL      | end (a fresh one starts next) |
 * | consult  | running                   | suspend                       |
 * | leave    | running or paused         | end                           |
 *
 * Everything else is `null` (nothing to do). A consult page never starts a session.
 */
export function nextSessionTransition(
    role: SessionRouteRole,
    hasWork: boolean,
    session: LifecycleSession | null,
    now: number,
    ttlMs: number = SESSION_SUSPEND_TTL_MS
): SessionTransition {
    const suspended = session?.suspendedAt !== undefined;

    if (role === 'leave') return session ? 'end' : null;

    if (role === 'consult') return session && !suspended ? 'suspend' : null;

    // On the activity route.
    if (!session) return hasWork ? 'start' : null;
    if (suspended) return now - session.suspendedAt! > ttlMs ? 'end' : 'resume';
    return hasWork ? null : 'end';
}

interface UseSessionLifecycleOptions {
    /** Where the learner is, for this activity (see sessionRouteRole). */
    role: SessionRouteRole;
    /**
     * True when the activity has review/learn work. Computed by the caller (a
     * primitive, so it is a stable effect dependency).
     */
    hasWork: boolean;
    /** The activity's session, or null between sessions. */
    session: LifecycleSession | null;
    /**
     * Called with `now` when a session begins. The caller snapshots the committed
     * workload and dispatches its own activity-specific SESSION_START. Kept as a
     * callback so the reducer stays free of Date.now() and this hook stays
     * activity-agnostic.
     */
    onStart: (now: Date) => void;
    onEnd: () => void;
    onSuspend: (now: Date) => void;
    onResume: () => void;
}

/**
 * Shared session-lifecycle effect for both quiz activities. A session begins when
 * there is work to do and the activity's page is on screen. Visiting a consult page
 * (a word, kanji or grammar point's detail page) pauses it, and coming back within
 * the TTL resumes it exactly where it was. Going anywhere else ends it, as running
 * out of work does, and so does coming back after the TTL.
 *
 * Only the primitives drive the effect; the callbacks are intentionally excluded
 * from the deps (they are fresh closures each render, and re-running on every
 * render would re-fire the transitions).
 */
export function useSessionLifecycle({ role, hasWork, session, onStart, onEnd, onSuspend, onResume }: UseSessionLifecycleOptions) {
    const hasSession = !!session;
    const suspendedAt = session?.suspendedAt;

    useEffect(() => {
        const now = new Date();
        switch (nextSessionTransition(role, hasWork, session, now.getTime())) {
            case 'start': onStart(now); break;
            case 'end': onEnd(); break;
            case 'suspend': onSuspend(now); break;
            case 'resume': onResume(); break;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role, hasWork, hasSession, suspendedAt]);
}
