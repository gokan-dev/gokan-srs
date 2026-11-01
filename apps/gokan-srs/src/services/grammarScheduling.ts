import type { GrammarProgress } from "../models/grammar.model";
import type { PacingSettings } from "./calibration";
import { effectiveDueDate, isEntryMastered } from "./scheduling";

/**
 * Grammar's equivalent of scheduling.ts - single source of truth for "when is
 * this grammar point due" and "is it mastered". Much simpler than vocab's
 * version since a GrammarProgress has exactly one SRSEntry (no reading/meaning
 * split to reconcile).
 */

export function isGrammarFullyMastered(progress: Pick<GrammarProgress, 'entry'>): boolean {
    return isEntryMastered(progress.entry);
}

/** When a grammar point is next due, under the current review pacing (see effectiveDueDate). */
export function grammarNextReviewAt(
    progress: Pick<GrammarProgress, 'entry'>,
    settings: Partial<PacingSettings> | null | undefined
): Date | null {
    return isGrammarFullyMastered(progress) ? null : effectiveDueDate(progress.entry, settings);
}

/** True if the given grammar point has a review due now (never true for graduated items). */
export function isGrammarDue(
    progress: Pick<GrammarProgress, 'entry' | 'stage'>,
    now: Date,
    settings: Partial<PacingSettings> | null | undefined
): boolean {
    if (progress.stage === 'graduated') return false;
    const due = grammarNextReviewAt(progress, settings);
    return due !== null && due <= now;
}

/**
 * Grammar's equivalent of srs.utils.ts's clearStaleNeedsRetry (issue #36): a
 * wrong answer sets `needsRetry` AND pushes `entry.dueDate` forward by the
 * wrong-answer penalty interval; if the session ends before the user retries,
 * by the next session both the stale retry flag and the now-elapsed due date
 * can be true at once. GrammarSRSService.applyAnswer's retry branch (which
 * `needsRetry` takes priority into) never advances dueDate, so answering it
 * once as a "retry" leaves the point immediately due again as a "fresh"
 * review - a second encounter for what the user experiences as one point.
 *
 * Called once, at session start, only for points whose regular review is ALSO
 * due right now - a fresh scheduled review already re-tests the exact recall
 * the stale retry existed to correct. Deliberately does NOT touch a
 * same-session retry (a wrong answer's dueDate is pushed well past "now", so
 * it can't also read as due until long after the session that set it ended) -
 * only ever called from the session-start effect, never mid-session.
 */
export function clearStaleGrammarNeedsRetry(
    queue: GrammarProgress[],
    now: Date,
    settings?: Partial<PacingSettings> | null
): GrammarProgress[] {
    let changed = false;

    const next = queue.map(g => {
        if (!g.needsRetry || !isGrammarDue(g, now, settings)) return g;
        changed = true;
        return { ...g, needsRetry: false };
    });

    return changed ? next : queue;
}
