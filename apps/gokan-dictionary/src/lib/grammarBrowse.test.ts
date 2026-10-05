import { describe, it, expect } from 'vitest';
import { filterRows, groupRows, toBrowseRow, type BrowseRow } from './grammarBrowse';
import type { GrammarPoint } from '@gokan/dataset-schema';

function row(overrides: Partial<BrowseRow> & { id: string }): BrowseRow {
    return {
        title: '～けど',
        jlptLevel: 5,
        formation: 'Verb + けど',
        shortExplanation: 'Expresses contrast.',
        ...overrides,
    };
}

const KEDO = row({ id: 'n5-008', familyId: 'contradiction', familyName: 'Contradiction (But / However)' });
const SHIKASHI = row({
    id: 'n3-033',
    title: 'しかし',
    jlptLevel: 3,
    kind: 'construction',
    familyId: 'contradiction',
    familyName: 'Contradiction (But / However)',
    formalityLevel: 'formal',
});
const TAI = row({ id: 'n5-020', title: '～たい', jlptLevel: 5, kind: 'inflection', shortExplanation: 'Want to do.' });

const ROWS = [KEDO, SHIKASHI, TAI];

describe('filterRows', () => {
    const base = { query: '', levels: [], kinds: [], familiedOnly: false };

    it('returns everything with no filters applied', () => {
        expect(filterRows(ROWS, base)).toHaveLength(3);
    });

    it('finds a whole family by its name, not just by point titles', () => {
        // The reason search covers familyName: no individual point contains the word
        // "contradiction", but that is what a learner looking for でも/しかし/けれど types.
        const found = filterRows(ROWS, { ...base, query: 'contradiction' });
        expect(found.map(r => r.id).sort()).toEqual(['n3-033', 'n5-008']);
    });

    it('matches title, explanation, and formation case-insensitively', () => {
        expect(filterRows(ROWS, { ...base, query: 'WANT TO' }).map(r => r.id)).toEqual(['n5-020']);
        expect(filterRows(ROWS, { ...base, query: 'しかし' }).map(r => r.id)).toEqual(['n3-033']);
    });

    it('filters by JLPT level', () => {
        expect(filterRows(ROWS, { ...base, levels: [5] }).map(r => r.id).sort()).toEqual(['n5-008', 'n5-020']);
    });

    it('filters by kind, excluding points that carry none', () => {
        expect(filterRows(ROWS, { ...base, kinds: ['inflection'] }).map(r => r.id)).toEqual(['n5-020']);
    });

    it('can restrict to points that belong to a family', () => {
        expect(filterRows(ROWS, { ...base, familiedOnly: true }).map(r => r.id).sort())
            .toEqual(['n3-033', 'n5-008']);
    });

    it('combines filters conjunctively', () => {
        expect(filterRows(ROWS, { ...base, levels: [5], familiedOnly: true }).map(r => r.id)).toEqual(['n5-008']);
    });
});

describe('groupRows', () => {
    it('groups by level, walking N5 to N1 and dropping empty levels', () => {
        const groups = groupRows(ROWS, 'level');
        expect(groups.map(g => g.title)).toEqual(['JLPT N5', 'JLPT N3']);
        expect(groups[0].rows.map(r => r.id).sort()).toEqual(['n5-008', 'n5-020']);
    });

    it('groups by family, largest first, with standalone points last', () => {
        const groups = groupRows(ROWS, 'family');
        expect(groups[0].title).toBe('Contradiction (But / However)');
        expect(groups[0].rows).toHaveLength(2);
        expect(groups[groups.length - 1].key).toBe('__unfamilied');
    });

    it('orders a family easiest-first, so the N5 member leads', () => {
        expect(groupRows(ROWS, 'family')[0].rows.map(r => r.jlptLevel)).toEqual([5, 3]);
    });

    it('shows the same total in both modes', () => {
        const total = (mode: 'level' | 'family') =>
            groupRows(ROWS, mode).reduce((sum, g) => sum + g.rows.length, 0);
        expect(total('level')).toBe(total('family'));
        expect(total('level')).toBe(ROWS.length);
    });
});

describe('toBrowseRow', () => {
    it('flattens the nested family field the rows filter and group on', () => {
        const point = {
            id: 'n5-008',
            title: '～けど',
            jlptLevel: 5,
            shortExplanation: 'Contrast.',
            longExplanation: 'Longer.',
            formation: 'Verb + けど',
            examples: [],
            family: { id: 'contradiction', name: 'Contradiction', relatedPoints: ['n3-033'] },
        } satisfies GrammarPoint;

        expect(toBrowseRow(point)).toMatchObject({
            id: 'n5-008',
            familyId: 'contradiction',
            familyName: 'Contradiction',
        });
    });
});
