import { describe, expect, it } from 'vitest';
import { hasKanji, isKanaOnly, kanjiSkeleton } from './kanji.utils';

describe('kanji.utils', () => {
    it('detects kanji, including the iteration mark', () => {
        expect(hasKanji('食べる')).toBe(true);
        expect(hasKanji('々')).toBe(true);
        expect(hasKanji('たべる')).toBe(false);
    });

    it('keeps only the kanji of a form, in order', () => {
        expect(kanjiSkeleton('食べさせる')).toBe('食');
        expect(kanjiSkeleton('日々')).toBe('日々');
        expect(kanjiSkeleton('かな')).toBe('');
    });

    it('recognises a string made only of kana', () => {
        expect(isKanaOnly('たべる')).toBe(true);
        expect(isKanaOnly('テレビ')).toBe(true);
        expect(isKanaOnly('食べる')).toBe(false);
        expect(isKanaOnly('')).toBe(false);
    });
});
