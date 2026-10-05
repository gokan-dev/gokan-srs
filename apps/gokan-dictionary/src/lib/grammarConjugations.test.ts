import { describe, it, expect } from 'vitest';
import { groupConjugationsByForm } from './grammarConjugations';
import type { GrammarConjugationIndex, GrammarPoint } from '@gokan/dataset-schema';

function makePoint(overrides: Partial<GrammarPoint> = {}): GrammarPoint {
    return {
        id: 'n1-178',
        title: '～が Verb られる',
        jlptLevel: 1,
        shortExplanation: 's',
        longExplanation: 'l',
        formation: 'f',
        examples: [],
        kind: 'inflection',
        ...overrides,
    };
}

const ITEM = { vocabId: '1', lemma: '言う', lemmaReading: 'いう', target: '言える', targetReading: 'いえる', wordClass: 'godan' as const };

describe('groupConjugationsByForm', () => {
    it('groups points under their form, sorted alphabetically by label', () => {
        const conjugations: GrammarConjugationIndex = {
            'n1-178': { form: 'potential', formLabel: 'potential (can do)', items: [ITEM, ITEM] },
            'n5-200': { form: 'te', formLabel: 'te-form', items: [ITEM] },
        };
        const pointsById = new Map<string, GrammarPoint>([
            ['n1-178', makePoint({ id: 'n1-178', jlptLevel: 1 })],
            ['n5-200', makePoint({ id: 'n5-200', title: 'te-form', jlptLevel: 5 })],
        ]);

        const groups = groupConjugationsByForm(conjugations, pointsById);

        expect(groups.map(g => g.form)).toEqual(['potential', 'te']);
        expect(groups[0].points).toEqual([{ id: 'n1-178', title: '～が Verb られる', jlptLevel: 1, itemCount: 2 }]);
    });

    it('collects more than one point under the same form, easiest first', () => {
        const conjugations: GrammarConjugationIndex = {
            'n1-a': { form: 'i-adj-adverbial', formLabel: 'i-adjective adverbial form', items: [ITEM] },
            'n5-b': { form: 'i-adj-adverbial', formLabel: 'i-adjective adverbial form', items: [ITEM, ITEM] },
        };
        const pointsById = new Map<string, GrammarPoint>([
            ['n1-a', makePoint({ id: 'n1-a', jlptLevel: 1 })],
            ['n5-b', makePoint({ id: 'n5-b', jlptLevel: 5 })],
        ]);

        const groups = groupConjugationsByForm(conjugations, pointsById);

        expect(groups).toHaveLength(1);
        expect(groups[0].points.map(p => p.id)).toEqual(['n5-b', 'n1-a']);
    });

    it('drops a point id with no matching GrammarPoint', () => {
        const conjugations: GrammarConjugationIndex = {
            'stale-id': { form: 'te', formLabel: 'te-form', items: [ITEM] },
        };
        expect(groupConjugationsByForm(conjugations, new Map())).toEqual([]);
    });

    it('returns [] for an empty index', () => {
        expect(groupConjugationsByForm({}, new Map())).toEqual([]);
    });
});
