// Row shape and pure filter/group logic behind the grammar browser (GrammarBrowser.svelte).
//
// Kept out of the component so the behaviour that decides what a reader actually sees is unit
// testable without mounting anything, matching how the rest of this app splits pure logic from
// rendering. The component holds only state and markup.
//
// The compiled dataset ships its own grammar/index/browse.json, but that snapshot carries no
// family fields (the ones this page groups by), so rows are built here from the point files
// prerender already loads plus index/families.json.

import type { GrammarBrowseRow, GrammarPoint } from '@gokan/dataset-schema';

export type GrammarKind = NonNullable<GrammarPoint['kind']>;
export type GroupMode = 'level' | 'family';

/**
 * A grammar point reduced to what a browse row displays and filters on: a subset of the
 * dataset's own browse row, so the two can never disagree on a field's type. `kind` is
 * optional because the dictionary derives rows from points, where it is optional.
 */
export type BrowseRow = Pick<
    GrammarBrowseRow,
    'id' | 'title' | 'romaji' | 'jlptLevel' | 'formation' | 'shortExplanation' | 'usageNote' | 'formalityLevel' | 'familyId' | 'familyName'
> & { kind?: GrammarKind };

export interface BrowseGroup {
    key: string;
    title: string;
    subtitle: string;
    rows: BrowseRow[];
}

export const JLPT_LEVELS = [5, 4, 3, 2, 1];

export const KIND_LABEL: Record<GrammarKind, string> = {
    construction: 'Construction',
    inflection: 'Inflection',
    lexical: 'Lexical',
};

export const FORMALITY_LABEL: Record<string, string> = {
    casual: 'Casual',
    neutral: 'Neutral',
    polite: 'Polite',
    formal: 'Formal',
    'very-formal-literary': 'Literary',
};

export function toBrowseRow(point: GrammarPoint): BrowseRow {
    return {
        id: point.id,
        title: point.title,
        romaji: point.romaji,
        jlptLevel: point.jlptLevel,
        kind: point.kind,
        formation: point.formation,
        shortExplanation: point.shortExplanation,
        usageNote: point.usageNote,
        formalityLevel: point.formalityLevel,
        familyId: point.family?.id,
        familyName: point.family?.name,
    };
}

export interface FilterOptions {
    query: string;
    levels: number[];
    kinds: GrammarKind[];
    /** Restrict to points that belong to a near-synonym family. */
    familiedOnly: boolean;
}

/**
 * Search covers every field a reader can see on the card, plus the family name, so looking for
 * "contradiction" finds the whole けれど/しかし/でも cluster even though no individual point's
 * title contains that word. This is the main thing that makes 755 points navigable at all.
 */
export function filterRows(rows: BrowseRow[], options: FilterOptions): BrowseRow[] {
    const query = options.query.trim().toLowerCase();
    const levels = new Set(options.levels);
    const kinds = new Set(options.kinds);

    return rows.filter(row => {
        if (levels.size > 0 && !levels.has(row.jlptLevel)) return false;
        if (kinds.size > 0 && (!row.kind || !kinds.has(row.kind))) return false;
        if (options.familiedOnly && !row.familyId) return false;
        if (!query) return true;

        return (
            row.title.toLowerCase().includes(query)
            || (row.romaji ?? '').toLowerCase().includes(query)
            || row.shortExplanation.toLowerCase().includes(query)
            || row.formation.toLowerCase().includes(query)
            || (row.usageNote ?? '').toLowerCase().includes(query)
            || (row.familyName ?? '').toLowerCase().includes(query)
            || row.id.includes(query)
        );
    });
}

/**
 * Grouping order is meaningful, not incidental: by level the headings walk N5 to N1 so the page
 * reads as a syllabus, and by family the largest clusters come first because those are the ones
 * a learner most needs disambiguated. Points with no family are collected into one trailing
 * group rather than dropped, so the two modes always show the same total.
 */
export function groupRows(rows: BrowseRow[], mode: GroupMode): BrowseGroup[] {
    if (mode === 'level') {
        return JLPT_LEVELS
            .map(level => ({
                key: `n${level}`,
                title: `JLPT N${level}`,
                subtitle: 'dataset order',
                rows: rows.filter(row => row.jlptLevel === level),
            }))
            .filter(group => group.rows.length > 0);
    }

    const byFamily = new Map<string, BrowseRow[]>();
    const unfamilied: BrowseRow[] = [];
    for (const row of rows) {
        if (!row.familyId) {
            unfamilied.push(row);
            continue;
        }
        const existing = byFamily.get(row.familyId);
        if (existing) existing.push(row);
        else byFamily.set(row.familyId, [row]);
    }

    const groups: BrowseGroup[] = [...byFamily.entries()]
        .map(([familyId, familyRows]) => ({
            key: familyId,
            title: familyRows[0].familyName ?? familyId,
            subtitle: `${familyRows.length} related point${familyRows.length === 1 ? '' : 's'}`,
            // Easiest first inside a family: the N5 member is the one to learn before its
            // more formal or more restricted siblings.
            rows: [...familyRows].sort((a, b) => b.jlptLevel - a.jlptLevel || a.id.localeCompare(b.id)),
        }))
        .sort((a, b) => b.rows.length - a.rows.length || a.title.localeCompare(b.title));

    if (unfamilied.length > 0) {
        groups.push({
            key: '__unfamilied',
            title: 'Standalone points',
            subtitle: `${unfamilied.length} with no close synonym`,
            rows: unfamilied,
        });
    }

    return groups;
}
