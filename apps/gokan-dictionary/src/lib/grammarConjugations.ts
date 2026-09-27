// Pure builder behind the conjugation reference index (issue #58): grouping the 40
// `kind: 'inflection'` points by their conjugation form. Kept out of prerender.ts and the
// .svelte component for the same unit-testability reason as the other grammar*.ts helpers.

import type { GrammarConjugationIndex, GrammarPoint } from '../models/grammar.model';

export interface ConjugationGroupPoint {
    id: string;
    title: string;
    jlptLevel: number;
    itemCount: number;
}

export interface ConjugationGroup {
    form: string;
    formLabel: string;
    points: ConjugationGroupPoint[];
}

/**
 * One group per distinct `form` value (usually one point per form, but a form can be taught by
 * more than one point - e.g. split by word class). A point id with no matching `GrammarPoint`
 * is dropped rather than rendered with a blank title.
 */
export function groupConjugationsByForm(
    conjugations: GrammarConjugationIndex,
    pointsById: Map<string, GrammarPoint>,
): ConjugationGroup[] {
    const byForm = new Map<string, ConjugationGroup>();

    for (const [pointId, entry] of Object.entries(conjugations)) {
        const point = pointsById.get(pointId);
        if (!point) continue;

        const group = byForm.get(entry.form) ?? { form: entry.form, formLabel: entry.formLabel, points: [] };
        group.points.push({ id: point.id, title: point.title, jlptLevel: point.jlptLevel, itemCount: entry.items.length });
        byForm.set(entry.form, group);
    }

    for (const group of byForm.values()) {
        group.points.sort((a, b) => b.jlptLevel - a.jlptLevel || a.id.localeCompare(b.id));
    }

    return [...byForm.values()].sort((a, b) => a.formLabel.localeCompare(b.formLabel));
}
