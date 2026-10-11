// Pure builder behind the conjugation reference (/grammar/conjugations/): the inflection points
// as one table per word type, a row per form with its pattern and one example. Kept out of
// prerender.ts and the page component for the same unit-testability reason as the other
// grammar*.ts helpers.

import type { ConjugationDrillItem, GrammarConjugationIndex, GrammarPoint } from '@gokan/dataset-schema';

export type ConjugationWordType = 'verb' | 'i-adjective' | 'na-adjective';

export const WORD_TYPE_LABEL: Record<ConjugationWordType, string> = {
    verb: 'Verbs',
    'i-adjective': 'い-adjectives',
    'na-adjective': 'な-adjectives',
};

export interface ConjugationRow {
    /** The point teaching the form, linked from its row. */
    id: string;
    formLabel: string;
    /** The point's title without a leading "Plain past:" label: "Verb た". */
    pattern: string;
    jlptLevel: number;
    example: Pick<ConjugationDrillItem, 'lemma' | 'target'> | null;
}

export interface ConjugationTable {
    wordType: ConjugationWordType;
    rows: ConjugationRow[];
}

const WORD_TYPES: ConjugationWordType[] = ['verb', 'i-adjective', 'na-adjective'];

function wordTypeOf(items: ConjugationDrillItem[]): ConjugationWordType {
    if (items.length > 0 && items.every(item => item.wordClass === 'i-adjective')) return 'i-adjective';
    if (items.length > 0 && items.every(item => item.wordClass === 'na-adjective')) return 'na-adjective';
    return 'verb';
}

/**
 * One table per word type that has a form, verbs first; rows easiest level first, then by
 * point id (the dataset numbers a level's paradigm in teaching order). A point id with no
 * matching `GrammarPoint` is dropped rather than rendered with a blank title.
 */
export function conjugationTables(conjugations: GrammarConjugationIndex, pointsById: Map<string, GrammarPoint>): ConjugationTable[] {
    const byType = new Map<ConjugationWordType, ConjugationRow[]>();
    for (const [pointId, entry] of Object.entries(conjugations)) {
        const point = pointsById.get(pointId);
        if (!point) continue;
        const wordType = wordTypeOf(entry.items);
        const rows = byType.get(wordType) ?? [];
        const first = entry.items[0];
        rows.push({
            id: point.id,
            formLabel: entry.formLabel,
            pattern: point.title.replace(/^[^:：]+[:：]\s*/, ''),
            jlptLevel: point.jlptLevel,
            example: first ? { lemma: first.lemma, target: first.target } : null,
        });
        byType.set(wordType, rows);
    }
    return WORD_TYPES
        .filter(wordType => byType.has(wordType))
        .map(wordType => ({
            wordType,
            rows: (byType.get(wordType) ?? []).sort((a, b) => b.jlptLevel - a.jlptLevel || a.id.localeCompare(b.id)),
        }));
}
