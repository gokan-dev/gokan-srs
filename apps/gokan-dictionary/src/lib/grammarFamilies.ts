// Pure builder behind the family pages (issue #58): grouping points by `family.id` and
// resolving each family's authored contrast lessons/cases (grammar/index/contrasts.json) into a
// display-ready shape, with every id already resolved to a title so the page component stays
// pure presentation. Kept out of prerender.ts and the .svelte component for the same
// unit-testability reason as grammarChapters.ts/grammarBrowse.ts.

import type { GrammarContrastIndex, GrammarPoint } from '@gokan/dataset-schema';
import type { GrammarSummary } from './types';

export interface FamilyLessonCase {
    focus: GrammarSummary;
    vs: GrammarSummary[];
    situation: string;
    guidance: string;
}

export interface FamilyLesson {
    id: string;
    title: string;
    cases: FamilyLessonCase[];
}

export interface FamilyPageData {
    id: string;
    name: string;
    /** Every point carrying this family id, easiest (highest JLPT number) first. */
    members: GrammarSummary[];
    /** Authored "when to use each" lessons, [] when this family has none. */
    lessons: FamilyLesson[];
    /** The family's variant-axis members (genuinely interchangeable, no lesson possible), [] when none. */
    interchangeable: GrammarSummary[];
}

function toSummary(point: GrammarPoint): GrammarSummary {
    return { id: point.id, title: point.title, jlptLevel: point.jlptLevel };
}

/** Resolves a list of point ids to summaries via `pointsById`, dropping any that don't resolve. */
function resolveSummaries(ids: string[], pointsById: Map<string, GrammarPoint>): GrammarSummary[] {
    return ids
        .map(id => pointsById.get(id))
        .filter((point): point is GrammarPoint => Boolean(point))
        .map(toSummary);
}

/**
 * One page per distinct `family.id` among `points`. `contrasts` is keyed by that same family id
 * (the dataset build guarantees this), so a family with no entry there simply gets `lessons: []`
 * and `interchangeable: []` - a member listing with nothing to compare yet, not a missing page.
 *
 * A contrast case's `focus`/`vs` ids are guaranteed by the dataset build to be members of the
 * family that claims them, so `resolveSummaries` dropping an unresolvable id is a defensive
 * fallback, not an expected path - a case left with no resolvable focus is dropped entirely
 * rather than rendered with a blank name.
 */
export function buildFamilyPages(points: GrammarPoint[], contrasts: GrammarContrastIndex): FamilyPageData[] {
    const pointsById = new Map(points.map(point => [point.id, point]));

    const byFamily = new Map<string, GrammarPoint[]>();
    for (const point of points) {
        if (!point.family) continue;
        const list = byFamily.get(point.family.id);
        if (list) list.push(point);
        else byFamily.set(point.family.id, [point]);
    }

    const pages: FamilyPageData[] = [];
    for (const [familyId, members] of byFamily) {
        const contrastEntry = contrasts[familyId];

        const lessons: FamilyLesson[] = (contrastEntry?.lessons ?? []).map(lesson => ({
            id: lesson.id,
            title: lesson.title,
            cases: lesson.cases
                .map(case_ => {
                    const focus = pointsById.get(case_.focus);
                    if (!focus) return null;
                    return {
                        focus: toSummary(focus),
                        vs: resolveSummaries(case_.vs, pointsById),
                        situation: case_.situation,
                        guidance: case_.guidance,
                    };
                })
                .filter((c): c is FamilyLessonCase => c !== null),
        }));

        pages.push({
            id: familyId,
            name: members[0].family!.name,
            members: [...members]
                .sort((a, b) => b.jlptLevel - a.jlptLevel || a.id.localeCompare(b.id))
                .map(toSummary),
            lessons,
            interchangeable: resolveSummaries(contrastEntry?.interchangeable ?? [], pointsById),
        });
    }

    return pages.sort((a, b) => b.members.length - a.members.length || a.name.localeCompare(b.name));
}
