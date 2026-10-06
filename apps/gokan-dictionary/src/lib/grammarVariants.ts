// Pure builder behind a point page's "Other forms" section (issue #58): resolving a point's
// realization variant group (grammar/index/variant-groups.json) into the sibling rows to
// display, excluding the point itself. Kept out of the .svelte component for the same
// unit-testability reason as the other grammar*.ts helpers.

import type { GrammarPoint, GrammarVariantGroupIndex } from '@gokan/dataset-schema';

export interface VariantSibling {
    id: string;
    title: string;
    /** e.g. 'canonical', 'contraction', 'politeness', 'particle', 'particle+politeness'. */
    relation: string;
    formalityLevel?: NonNullable<GrammarPoint['formalityLevel']>;
    jlptLevel: number;
}

/**
 * Every OTHER realization of `point`'s rule - the canonical is looked up under
 * `point.variantOf ?? point.id`, since the canonical itself is the group's own key. Returns []
 * when the point has no variant group at all, which the caller reads as "render nothing".
 *
 * `jlptLevel` is resolved from `pointsById` rather than carried on the variant-group entry
 * itself (which only has id/relation/formalityLevel/title) - a sibling missing from `pointsById`
 * is dropped defensively rather than shown with a fabricated level.
 */
export function buildVariantSiblings(
    point: GrammarPoint,
    variantGroups: GrammarVariantGroupIndex,
    pointsById: Map<string, GrammarPoint>,
): VariantSibling[] {
    const group = variantGroups[point.variantOf ?? point.id];
    if (!group) return [];

    return group
        .filter(member => member.id !== point.id)
        .map((member): VariantSibling | null => {
            const full = pointsById.get(member.id);
            if (!full) return null;
            return {
                id: member.id,
                title: member.title,
                relation: member.relation,
                formalityLevel: member.formalityLevel,
                jlptLevel: full.jlptLevel,
            };
        })
        .filter((sibling): sibling is VariantSibling => sibling !== null);
}
