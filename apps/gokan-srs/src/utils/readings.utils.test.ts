import { describe, it, expect } from 'vitest';
import { READING_SEPARATOR, readingList } from './readings.utils';

describe('readingList', () => {
    it('lists the primary reading first, then the alternatives in order', () => {
        const reading = { primary: 'いちにち', alternatives: ['いちじつ', 'ひとひ'] };
        expect(readingList(reading)).toEqual(['いちにち', 'いちじつ', 'ひとひ']);
    });

    it('is the primary alone when there are no alternatives', () => {
        expect(readingList({ primary: 'に', alternatives: [] })).toEqual(['に']);
    });
});

describe('READING_SEPARATOR', () => {
    it('is a comma and a space', () => {
        expect(['に', 'ふた'].join(READING_SEPARATOR)).toBe('に, ふた');
    });
});
