import { describe, it, expect } from 'vitest';
import { buildVariantSiblings } from './grammarVariants';
import type { GrammarPoint, GrammarVariantGroupIndex } from '@gokan/dataset-schema';

function makePoint(overrides: Partial<GrammarPoint> = {}): GrammarPoint {
    return {
        id: 'n5-105',
        title: 'それでは',
        jlptLevel: 5,
        shortExplanation: 's',
        longExplanation: 'l',
        formation: 'f',
        examples: [],
        ...overrides,
    };
}

const GROUP: GrammarVariantGroupIndex = {
    'n5-105': [
        { id: 'n5-105', relation: 'canonical', formalityLevel: 'polite', title: 'それでは' },
        { id: 'n5-104', relation: 'politeness', formalityLevel: 'neutral', title: 'それじゃ' },
        { id: 'n5-106', relation: 'contraction', formalityLevel: 'casual', title: 'じゃ' },
    ],
};

const POINTS_BY_ID = new Map<string, GrammarPoint>([
    ['n5-105', makePoint({ id: 'n5-105', title: 'それでは', jlptLevel: 5 })],
    ['n5-104', makePoint({ id: 'n5-104', title: 'それじゃ', jlptLevel: 5 })],
    ['n5-106', makePoint({ id: 'n5-106', title: 'じゃ', jlptLevel: 4 })],
]);

describe('buildVariantSiblings', () => {
    it('from the canonical, lists every other realization with its own JLPT level', () => {
        const siblings = buildVariantSiblings(POINTS_BY_ID.get('n5-105')!, GROUP, POINTS_BY_ID);
        expect(siblings).toEqual([
            { id: 'n5-104', title: 'それじゃ', relation: 'politeness', formalityLevel: 'neutral', jlptLevel: 5 },
            { id: 'n5-106', title: 'じゃ', relation: 'contraction', formalityLevel: 'casual', jlptLevel: 4 },
        ]);
    });

    it('from a variant, resolves via variantOf and excludes itself, including the canonical', () => {
        const variantPoint = makePoint({ id: 'n5-104', title: 'それじゃ', variantOf: 'n5-105' });
        const siblings = buildVariantSiblings(variantPoint, GROUP, POINTS_BY_ID);
        expect(siblings.map(s => s.id)).toEqual(['n5-105', 'n5-106']);
        expect(siblings.find(s => s.id === 'n5-105')?.relation).toBe('canonical');
    });

    it('returns [] for a point with no variant group', () => {
        const lonePoint = makePoint({ id: 'n5-001', title: 'standalone' });
        expect(buildVariantSiblings(lonePoint, GROUP, POINTS_BY_ID)).toEqual([]);
    });

    it('drops a sibling id that is not in pointsById rather than throwing', () => {
        const sparseIndex = new Map(POINTS_BY_ID);
        sparseIndex.delete('n5-106');
        const siblings = buildVariantSiblings(POINTS_BY_ID.get('n5-105')!, GROUP, sparseIndex);
        expect(siblings.map(s => s.id)).toEqual(['n5-104']);
    });
});
