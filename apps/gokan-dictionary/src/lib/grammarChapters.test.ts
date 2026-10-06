import { describe, it, expect } from 'vitest';
import { buildChapterLocatorIndex, buildChapterIndexRows } from './grammarChapters';
import type { GrammarPoint, GrammarTeachingOrder } from '@gokan/dataset-schema';

function makeOrder(): GrammarTeachingOrder {
    return {
        order: ['n5-a', 'n5-b', 'n5-c'],
        chapters: [
            { id: 'n5-c01', title: 'C1', summary: 's1', jlptLevel: 5, points: ['n5-a', 'n5-b'] },
            { id: 'n5-c02', title: 'C2', summary: 's2', jlptLevel: 5, points: ['n5-c'] },
        ],
    };
}

describe('buildChapterLocatorIndex', () => {
    it('resolves each point to its chapter, 1-based chapter number, and position', () => {
        const index = buildChapterLocatorIndex(makeOrder());

        expect(index.get('n5-a')).toEqual({
            chapterId: 'n5-c01',
            chapterTitle: 'C1',
            chapterNumber: 1,
            positionInChapter: 1,
            totalInChapter: 2,
        });
        expect(index.get('n5-b')).toEqual({
            chapterId: 'n5-c01',
            chapterTitle: 'C1',
            chapterNumber: 1,
            positionInChapter: 2,
            totalInChapter: 2,
        });
        expect(index.get('n5-c')).toEqual({
            chapterId: 'n5-c02',
            chapterTitle: 'C2',
            chapterNumber: 2,
            positionInChapter: 1,
            totalInChapter: 1,
        });
    });

    it('leaves a point outside every chapter unresolved', () => {
        const index = buildChapterLocatorIndex(makeOrder());
        expect(index.has('n5-not-taught')).toBe(false);
    });

    it('returns an empty index for an order with no chapters', () => {
        const index = buildChapterLocatorIndex({ order: [], chapters: [] });
        expect(index.size).toBe(0);
    });
});

function makePoint(id: string, title: string, jlptLevel: number): GrammarPoint {
    return { id, title, jlptLevel, shortExplanation: 's', longExplanation: 'l', formation: 'f', examples: [] };
}

describe('buildChapterIndexRows', () => {
    it('resolves each chapter\'s points to summaries, with a 1-based chapterNumber', () => {
        const order = makeOrder();
        const pointsById = new Map([
            ['n5-a', makePoint('n5-a', 'A', 5)],
            ['n5-b', makePoint('n5-b', 'B', 5)],
            ['n5-c', makePoint('n5-c', 'C', 5)],
        ]);

        const rows = buildChapterIndexRows(order, pointsById);

        expect(rows).toEqual([
            { id: 'n5-c01', title: 'C1', summary: 's1', jlptLevel: 5, chapterNumber: 1, points: [{ id: 'n5-a', title: 'A', jlptLevel: 5 }, { id: 'n5-b', title: 'B', jlptLevel: 5 }] },
            { id: 'n5-c02', title: 'C2', summary: 's2', jlptLevel: 5, chapterNumber: 2, points: [{ id: 'n5-c', title: 'C', jlptLevel: 5 }] },
        ]);
    });

    it('drops a point id with no matching GrammarPoint rather than rendering it blank', () => {
        const order = makeOrder();
        const pointsById = new Map([['n5-a', makePoint('n5-a', 'A', 5)]]);

        const rows = buildChapterIndexRows(order, pointsById);

        expect(rows[0].points).toEqual([{ id: 'n5-a', title: 'A', jlptLevel: 5 }]);
    });
});
