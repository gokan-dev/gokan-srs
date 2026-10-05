import { describe, expect, it } from 'vitest';
import { coverageOf, statusIndex } from './coverage.utils';

describe('coverageOf', () => {
    it('tallies mastered and learning items, counting every id in the total', () => {
        const status = (id: string) => (id === 'a' ? 'mastered' : id === 'b' ? 'learning' : undefined);
        expect(coverageOf(['a', 'b', 'c', 'd'], status)).toEqual({ mastered: 1, learning: 1, total: 4 });
    });

    it('reports an empty set as all zeros', () => {
        expect(coverageOf([], () => 'mastered')).toEqual({ mastered: 0, learning: 0, total: 0 });
    });
});

describe('statusIndex', () => {
    it('looks up each started item by id and leaves the rest undefined', () => {
        const items = [{ id: 'a', done: true }, { id: 'b', done: false }, { id: 'c', done: null }];
        const status = statusIndex(items, i => i.id, i => (i.done === null ? undefined : i.done ? 'mastered' : 'learning'));
        expect(status('a')).toBe('mastered');
        expect(status('b')).toBe('learning');
        expect(status('c')).toBeUndefined();
        expect(status('zzz')).toBeUndefined();
    });
});
