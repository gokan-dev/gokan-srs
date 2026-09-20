import type { GrammarContrastForFocus } from "../models/grammar.model";

/**
 * The deferral rule for situational contrast lessons (issue #62): a lesson is
 * only "ready" to show once every sibling it contrasts against is already
 * known, so the contrast lands between two real memories rather than teaching
 * against a point the learner has never met.
 *
 * Pure so the intro card and the family page share one definition of "ready"
 * and it can be tested without rendering anything.
 */
export function selectReadyContrasts(
    forFocus: GrammarContrastForFocus[],
    knownIds: Set<string>,
): GrammarContrastForFocus[] {
    return forFocus.filter(c => c.unit.vs.every(id => knownIds.has(id)));
}
