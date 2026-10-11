import { describe, expect, it } from 'vitest';
import { classCodeOfRow, isCommonRow, readingOfRow } from './searchRow';
import type { SearchWordRow } from './types';

describe('search row flags', () => {
    const omou: SearchWordRow = ['1', '思う', 'おもう', 'to think', 5, 1 | (2 << 2)];
    const koko: SearchWordRow = ['2', 'ここ', '此処', 'here', 5, 2];

    it('reads the common flag and the class code', () => {
        expect(isCommonRow(omou)).toBe(true);
        expect(isCommonRow(koko)).toBe(false);
        expect(classCodeOfRow(omou)).toBe(2);
        expect(classCodeOfRow(koko)).toBe(0);
    });

    it('reads the headword as the reading of a word learned in kana', () => {
        expect(readingOfRow(omou)).toBe('おもう');
        expect(readingOfRow(koko)).toBe('ここ');
    });
});
