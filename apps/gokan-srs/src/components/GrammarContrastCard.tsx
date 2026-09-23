import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { GrammarContrastForFocus } from "../models/grammar.model";
import { GrammarService } from "../services/grammar.service";
import { selectKnownInterchangeableSiblings, selectReadyContrasts } from "../utils/grammarContrast.utils";

interface Props {
    /** The point being introduced - its contrast lessons (where it is the `focus`) are the ones shown. */
    pointId: string;
    /** Grammar ids the learner has already been introduced to. A lesson only shows once every point it contrasts against is known. */
    knownIds: Set<string>;
    /** When false, the "Review the family" link is hidden (e.g. when already on that family's page). Defaults to true. */
    showFamilyLink?: boolean;
}

/**
 * The situational half of the near-synonym contrast system: given a concrete
 * situation, which family member to reach for and why the obvious alternative
 * does not fit (issue #62). から and ので both mean "because", but only ので fits
 * an apology - a contrastive fact that lives in neither point's own entry.
 *
 * Shown at the introduction of the lesson's `focus` point, but only once every
 * `vs` sibling it contrasts against is already known, so the contrast lands
 * between two real memories rather than teaching against an abstraction. The
 * data is authored per family in gokan-dataset (see its docs/SCHEMA.md); this
 * component renders nothing for a point that carries no ready lesson.
 *
 * A `variant`-axis point has no lesson and can never have one, so it gets the
 * opposite note instead: that there is nothing to tell apart here. Silence on
 * exactly those points is worse than a line of text, because a learner meeting
 * the fourth of ten near-identical forms with no comment concludes a
 * distinction exists and goes looking for one.
 */
export function GrammarContrastCard({ pointId, knownIds, showFamilyLink = true }: Props) {
    const [ready, setReady] = useState<GrammarContrastForFocus[]>([]);
    const [interchangeable, setInterchangeable] = useState<{ familyId: string; known: string[] } | null>(null);

    useEffect(() => {
        let cancelled = false;
        GrammarService.loadContrastsByFocus().then(byFocus => {
            if (cancelled) return;
            const forFocus = byFocus.get(pointId) ?? [];
            // Defer any lesson whose contrast sibling the learner has not met yet.
            setReady(selectReadyContrasts(forFocus, knownIds));
        });
        GrammarService.loadInterchangeableByPoint().then(byPoint => {
            if (cancelled) return;
            const entry = byPoint.get(pointId);
            const known = selectKnownInterchangeableSiblings(entry, knownIds);
            setInterchangeable(entry && known.length > 0 ? { familyId: entry.familyId, known } : null);
        });
        return () => { cancelled = true; };
        // knownIds is rebuilt each render; key on its size so a newly-known sibling re-runs the filter.
    }, [pointId, knownIds]);

    if (ready.length === 0 && !interchangeable) return null;

    // Every ready lesson belongs to the same family (a point has one family), so
    // the first is representative for the header link.
    const familyId = ready[0]?.familyId ?? interchangeable!.familyId;

    return (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
            <p className="uppercase tracking-wide text-label-neutral text-xs mb-2 font-gothic">
                {ready.length > 0 ? "Which one, and when" : "Interchangeable"}
            </p>

            <div className="space-y-3">
                {ready.map((c, i) => (
                    <div key={`${c.chunkId}-${i}`}>
                        <p className="text-tertiary font-gothic text-xs mb-1">{c.chunkLabel}</p>
                        <p className="text-primary font-serif text-sm leading-relaxed">
                            <span className="font-semibold">{c.unit.situation}</span>{" "}
                            {c.unit.guidance}
                        </p>
                    </div>
                ))}

                {interchangeable && (
                    <p className="text-primary font-serif text-sm leading-relaxed">
                        This is interchangeable with{" "}
                        {interchangeable.known.length === 1 ? "another form" : `${interchangeable.known.length} other forms`}{" "}
                        you already know. They say the same thing in the same register, so there is no
                        rule here to work out: recognise it and move on.
                    </p>
                )}
            </div>

            {showFamilyLink && (
                <div className="mt-3">
                    <Link
                        to={`/grammar/family/${familyId}`}
                        className="text-accent font-gothic text-xs hover:underline"
                    >
                        Review the whole family
                    </Link>
                </div>
            )}
        </div>
    );
}
