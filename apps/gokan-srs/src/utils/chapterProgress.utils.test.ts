import { describe, expect, it } from 'vitest';
import { chapterProgressLabel, groupChaptersByLevel } from './chapterProgress.utils';

describe('chapterProgressLabel', () => {
    it('names mastered, learning and new in that order', () => {
        expect(chapterProgressLabel({ mastered: 1, learning: 2, total: 4 })).toBe('1 mastered · 2 learning · 1 new');
    });

    it('omits the parts that are zero', () => {
        expect(chapterProgressLabel({ mastered: 0, learning: 0, total: 4 })).toBe('4 new');
        expect(chapterProgressLabel({ mastered: 3, learning: 0, total: 3 })).toBe('3 mastered');
        expect(chapterProgressLabel({ mastered: 0, learning: 2, total: 3 })).toBe('2 learning · 1 new');
    });
});

describe('groupChaptersByLevel', () => {
    it('groups consecutive chapters of one level, keeping curriculum numbers', () => {
        const groups = groupChaptersByLevel([{ jlptLevel: 5 }, { jlptLevel: 5 }, { jlptLevel: 4 }, { jlptLevel: 5 }]);
        expect(groups.map(g => [g.level, g.chapters.map(c => c.number)])).toEqual([[5, [1, 2]], [4, [3]], [5, [4]]]);
    });
});
