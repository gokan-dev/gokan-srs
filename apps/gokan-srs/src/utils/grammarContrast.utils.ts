import type { GrammarContrastForFocus, GrammarInterchangeableForPoint } from "../models/grammar.model";

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

/**
 * The same deferral rule applied to an interchangeable-members note: telling a
 * learner "this is interchangeable with nine others" is only useful once they
 * have actually met one of the others. Before that it is a fact about points
 * they have never seen.
 *
 * Returns the known siblings, so the caller can render nothing when the list is
 * empty rather than a note with nothing to compare against.
 */
export function selectKnownInterchangeableSiblings(
    entry: GrammarInterchangeableForPoint | undefined,
    knownIds: Set<string>,
): string[] {
    if (!entry) return [];
    return entry.siblings.filter(id => knownIds.has(id));
}
