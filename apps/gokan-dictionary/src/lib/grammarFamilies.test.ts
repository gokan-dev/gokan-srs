import { describe, it, expect } from 'vitest';
import { buildFamilyPages } from './grammarFamilies';
import type { GrammarContrastIndex, GrammarPoint } from '../models/grammar.model';

function makePoint(overrides: Partial<GrammarPoint> = {}): GrammarPoint {
    return {
        id: 'n5-073',
        title: 'から',
        jlptLevel: 5,
        shortExplanation: 's',
        longExplanation: 'l',
        formation: 'f',
        examples: [],
        ...overrides,
    };
}

describe('buildFamilyPages', () => {
    it('groups points by family id and sorts members easiest (highest JLPT number) first', () => {
        const points = [
            makePoint({ id: 'n4-110', title: 'ので', jlptLevel: 4, family: { id: 'causality', name: 'Causality', relatedPoints: ['n5-073'] } }),
            makePoint({ id: 'n5-073', title: 'から', jlptLevel: 5, family: { id: 'causality', name: 'Causality', relatedPoints: ['n4-110'] } }),
        ];

        const pages = buildFamilyPages(points, {});

        expect(pages).toHaveLength(1);
        expect(pages[0].id).toBe('causality');
        expect(pages[0].name).toBe('Causality');
        expect(pages[0].members.map(m => m.id)).toEqual(['n5-073', 'n4-110']);
    });

    it('leaves unfamilied points out of every page', () => {
        const points = [makePoint({ family: undefined })];
        expect(buildFamilyPages(points, {})).toEqual([]);
    });

    it('resolves a lesson case\'s focus/vs ids to summaries', () => {
        const points = [
            makePoint({ id: 'n5-073', title: 'から', jlptLevel: 5, family: { id: 'causality', name: 'Causality', relatedPoints: ['n4-110'] } }),
            makePoint({ id: 'n4-110', title: 'ので', jlptLevel: 4, family: { id: 'causality', name: 'Causality', relatedPoints: ['n5-073'] } }),
        ];
        const contrasts: GrammarContrastIndex = {
            causality: {
                name: 'Causality',
                lessons: [{
                    id: 'reason-core',
                    title: 'から / ので',
                    points: ['n5-073', 'n4-110'],
                    cases: [{ focus: 'n4-110', vs: ['n5-073'], situation: 'apologising', guidance: 'use ので' }],
                }],
            },
        };

        const pages = buildFamilyPages(points, contrasts);

        expect(pages[0].lessons).toHaveLength(1);
        expect(pages[0].lessons[0].cases).toEqual([{
            focus: { id: 'n4-110', title: 'ので', jlptLevel: 4 },
            vs: [{ id: 'n5-073', title: 'から', jlptLevel: 5 }],
            situation: 'apologising',
            guidance: 'use ので',
        }]);
    });

    it('drops a case whose focus id does not resolve, without failing the whole page', () => {
        const points = [makePoint({ id: 'n5-073', family: { id: 'causality', name: 'Causality', relatedPoints: [] } })];
        const contrasts: GrammarContrastIndex = {
            causality: {
                name: 'Causality',
                lessons: [{
                    id: 'l1', title: 't', points: ['n5-073'],
                    cases: [{ focus: 'stale-id', vs: ['n5-073'], situation: 's', guidance: 'g' }],
                }],
            },
        };

        expect(buildFamilyPages(points, contrasts)[0].lessons[0].cases).toEqual([]);
    });

    it('resolves interchangeable member ids, defaulting to [] when absent', () => {
        const points = [
            makePoint({ id: 'n1-002', family: { id: 'regardless', name: 'Regardless', relatedPoints: ['n1-004'] } }),
            makePoint({ id: 'n1-004', family: { id: 'regardless', name: 'Regardless', relatedPoints: ['n1-002'] } }),
        ];

        expect(buildFamilyPages(points, {})[0].interchangeable).toEqual([]);

        const contrasts: GrammarContrastIndex = {
            regardless: { name: 'Regardless', lessons: [], interchangeable: ['n1-002', 'n1-004'] },
        };
        const withInterchangeable = buildFamilyPages(points, contrasts)[0];
        expect(withInterchangeable.lessons).toEqual([]);
        expect(withInterchangeable.interchangeable.map(m => m.id)).toEqual(['n1-002', 'n1-004']);
    });

    it('sorts families by member count, largest first', () => {
        const points = [
            makePoint({ id: 'a1', family: { id: 'small', name: 'Small', relatedPoints: [] } }),
            makePoint({ id: 'b1', family: { id: 'big', name: 'Big', relatedPoints: ['b2', 'b3'] } }),
            makePoint({ id: 'b2', family: { id: 'big', name: 'Big', relatedPoints: ['b1', 'b3'] } }),
            makePoint({ id: 'b3', family: { id: 'big', name: 'Big', relatedPoints: ['b1', 'b2'] } }),
        ];

        expect(buildFamilyPages(points, {}).map(p => p.id)).toEqual(['big', 'small']);
    });
});
