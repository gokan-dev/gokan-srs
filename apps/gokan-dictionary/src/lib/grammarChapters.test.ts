import { describe, it, expect } from 'vitest';
import { buildChapterLocatorIndex } from './grammarChapters';
import type { GrammarTeachingOrder } from '../models/grammar.model';

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
