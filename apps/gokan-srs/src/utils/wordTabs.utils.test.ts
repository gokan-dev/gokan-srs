import { describe, expect, it } from 'vitest';
import { initialWordTab, WORD_TABS, wordTabHash, wordTabOfHash, type WordTab } from './wordTabs.utils';

const all: readonly WordTab[] = WORD_TABS;

describe('wordTabHash', () => {
    it('gives every tab but Dict a hash', () => {
        expect(WORD_TABS.map(wordTabHash)).toEqual(['', '#sentences', '#synonyms', '#kanji', '#related', '#study']);
    });
});

describe('wordTabOfHash', () => {
    it('reads each tab hash back, and nothing else', () => {
        expect(WORD_TABS.map(tab => wordTabOfHash(wordTabHash(tab)))).toEqual([null, 'sentences', 'synonyms', 'kanji', 'related', 'study']);
        expect(wordTabOfHash('#dict')).toBeNull();
        expect(wordTabOfHash('#explore')).toBeNull();
    });
});

describe('initialWordTab', () => {
    it("opens the hash's tab first", () => {
        expect(initialWordTab('#synonyms', 'kanji', all)).toBe('synonyms');
    });

    it('opens the remembered tab without a hash', () => {
        expect(initialWordTab('', 'related', all)).toBe('related');
    });

    it('opens Dict with neither', () => {
        expect(initialWordTab('', undefined, all)).toBe('dict');
        expect(initialWordTab('', 'something else', all)).toBe('dict');
    });

    it("falls back past a tab the word does not have", () => {
        const noStudy: WordTab[] = ['dict', 'sentences', 'related'];
        expect(initialWordTab('#study', 'related', noStudy)).toBe('related');
        expect(initialWordTab('#study', 'kanji', noStudy)).toBe('dict');
        expect(initialWordTab('', 'synonyms', noStudy)).toBe('dict');
    });
});
