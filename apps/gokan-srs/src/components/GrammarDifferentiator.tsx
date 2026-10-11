import type { GrammarPoint } from "@gokan/dataset-schema";
import { GrammarService } from "../services/grammar.service";
import { useAsyncData } from "../hooks/useAsyncData";

/** Casual -> literary. The register ladder's rungs, in order. */
const FORMALITY_ORDER: NonNullable<GrammarPoint['formalityLevel']>[] = [
    'casual', 'neutral', 'polite', 'formal', 'very-formal-literary',
];

const FORMALITY_LABEL: Record<NonNullable<GrammarPoint['formalityLevel']>, string> = {
    'casual': 'Casual',
    'neutral': 'Neutral',
    'polite': 'Polite',
    'formal': 'Formal',
    'very-formal-literary': 'Literary',
};

interface Props {
    point: GrammarPoint;
    /** Ids the learner has already been introduced to, so siblings can be marked as known. */
    knownIds: Set<string>;
    /**
     * As prose in a page section rather than a boxed note, without the usage note
     * (the grammar page already shows it under "When to use").
     */
    inline?: boolean;
}

/**
 * Teaches what separates a point from its near-synonym family siblings, at the
 * moment the point is introduced.
 *
 * This exists because grouping near-synonyms together is only an improvement if
 * the learner is told what separates them. Four ways to say "but", introduced
 * back to back with nothing said about the difference, collapse into one fuzzy
 * concept that the SRS then reinforces. Proximity without a differentiator is
 * worse than scattering.
 *
 * What to show is driven by the dataset's `family.axis`, because the three cases
 * need genuinely different copy - a formality ladder, a single restriction, or
 * "stop looking for a difference, there isn't one". Renders nothing for the ~half
 * of points that have no family.
 */
export function GrammarDifferentiator({ point, knownIds, inline = false }: Props) {
    const family = point.family;
    const siblingIds = family?.relatedPoints ?? [];

    const siblings: GrammarPoint[] = useAsyncData(siblingIds.join(','), () => GrammarService.loadGrammarPoints(siblingIds)).data ?? [];

    if (!family || siblingIds.length === 0) return null;

    const axis = family.axis;

    // The register ladder: this point plus every sibling, ordered casual ->
    // literary. Sorting by formality rather than by level is the entire point -
    // だが (N2) sits between けれど and しかし because that is where it belongs
    // in the ladder, not three levels away.
    const ladder = [point, ...siblings]
        .filter(p => p.formalityLevel)
        .sort((a, b) =>
            FORMALITY_ORDER.indexOf(a.formalityLevel!) - FORMALITY_ORDER.indexOf(b.formalityLevel!)
            || a.id.localeCompare(b.id)
        );

    const heading = axis === 'variant'
        ? `${family.name}: interchangeable forms`
        : axis === 'register'
            ? `${family.name}: same meaning, different register`
            : family.name;

    const lede = axis === 'variant'
        ? 'These are stylistic variants with no real difference in meaning or register. Learn to recognise them; you only ever need to produce one.'
        : axis === 'register'
            ? 'Every form below means the same thing. What changes is who you can say it to, and that is the whole lesson here.'
            : point.usageNote && !inline
                ? 'This one carries a restriction its siblings do not:'
                : null;

    const showsUsageNote = !inline && !!point.usageNote;
    // Inline, a constraint family with no lede has nothing to say beyond the list.
    if (inline && !lede && axis !== 'register' && axis !== 'variant') return null;

    return (
        <div className={inline ? '' : 'rounded-md border border-divider bg-feedback-background px-4 py-3'}>
            {!inline && (
                <p className="type-label mb-2">
                    {heading}
                </p>
            )}

            {lede && (
                <p className="text-primary font-serif text-sm leading-relaxed mb-3">
                    {lede}
                </p>
            )}

            {axis === 'constraint' && showsUsageNote && (
                <p className="text-primary font-serif text-sm leading-relaxed mb-3">
                    {point.usageNote}
                </p>
            )}

            {axis === 'register' && ladder.length > 1 && (
                <ul className="space-y-1.5">
                    {ladder.map(p => {
                        const isThis = p.id === point.id;
                        const isKnown = !isThis && knownIds.has(p.id);
                        return (
                            <li key={p.id} className="flex items-baseline gap-2 text-sm">
                                <span className="type-meta w-16 shrink-0">
                                    {FORMALITY_LABEL[p.formalityLevel!]}
                                </span>
                                <span className={isThis
                                    ? "font-mincho text-primary font-semibold"
                                    : "font-mincho text-primary"}>
                                    {p.title}
                                </span>
                                {isThis && (
                                    <span className="font-sans text-xs text-accent">this one</span>
                                )}
                                {isKnown && (
                                    <span className="type-meta">already learned</span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {axis === 'variant' && (
                <p className="font-mincho text-primary text-sm leading-relaxed">
                    {[point, ...siblings].map(p => p.title).join('　/　')}
                </p>
            )}

            {/* No axis classified yet: the usage note is still the best thing to
                show, and is what the quiz card already uses. */}
            {!axis && showsUsageNote && (
                <p className="text-primary font-serif text-sm leading-relaxed">
                    {point.usageNote}
                </p>
            )}
        </div>
    );
}
