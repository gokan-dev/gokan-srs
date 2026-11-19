import { describe, expect, it } from 'vitest';
import { detailTabSet, GRAMMAR_TABS, KANJI_TABS } from './detailTabs.utils';

const set = detailTabSet(['main', 'more', 'mine'], { main: '', more: '#more', mine: '#mine' }, 'test.tab');

describe('detailTabSet', () => {
    it('gives every tab but the first a hash, and reads it back', () => {
        expect(set.tabs.map(set.hashOf)).toEqual(['', '#more', '#mine']);
        expect(set.tabs.map(tab => set.tabOfHash(set.hashOf(tab)))).toEqual([null, 'more', 'mine']);
        expect(set.tabOfHash('#main')).toBeNull();
        expect(set.tabOfHash('#other')).toBeNull();
    });

    it("opens the hash's tab, else the remembered one, else the first", () => {
        expect(set.initial('#mine', 'more', set.tabs)).toBe('mine');
        expect(set.initial('', 'more', set.tabs)).toBe('more');
        expect(set.initial('', 'something else', set.tabs)).toBe('main');
        expect(set.initial('', undefined, set.tabs)).toBe('main');
    });

    it('falls back past a tab the subject does not have', () => {
        expect(set.initial('#mine', 'more', ['main', 'more'])).toBe('more');
        expect(set.initial('#mine', 'mine', ['main', 'more'])).toBe('main');
    });
});

describe('the kanji and grammar pages', () => {
    it('open on their essentials, each tab but it hashed', () => {
        expect(KANJI_TABS.first).toBe('kanji');
        expect(KANJI_TABS.tabs.map(KANJI_TABS.hashOf)).toEqual(['', '#words', '#study']);
        expect(GRAMMAR_TABS.first).toBe('point');
        expect(GRAMMAR_TABS.tabs.map(GRAMMAR_TABS.hashOf)).toEqual(['', '#examples', '#related', '#study']);
    });

    it('remember their tabs apart from each other and from a word page', () => {
        expect(new Set([KANJI_TABS.storageKey, GRAMMAR_TABS.storageKey, 'gokan.wordPage.tab']).size).toBe(3);
    });
});
