import { describe, it, expect } from 'vitest';
import { GRAMMAR, KANJI, STUDY, VOCABULARY, isDestinationActive, isMoreActive, isSessionPath, synonymsPath } from './navigation.utils';

describe('isDestinationActive', () => {
    it('marks Study on the hub only', () => {
        expect(isDestinationActive('/', STUDY)).toBe(true);
        expect(isDestinationActive('/vocab', STUDY)).toBe(false);
        expect(isDestinationActive('/stats', STUDY)).toBe(false);
    });

    it('treats a word page as part of Vocabulary and a kanji page as part of Kanji', () => {
        expect(isDestinationActive('/vocab', VOCABULARY)).toBe(true);
        expect(isDestinationActive('/vocab/1263400', VOCABULARY)).toBe(true);
        expect(isDestinationActive('/kanji/%E5%AD%A6', KANJI)).toBe(true);
        expect(isDestinationActive('/kanjix', KANJI)).toBe(false);
    });

    it('covers every grammar page except the grammar session', () => {
        for (const path of ['/grammar/chapters', '/grammar/browse', '/grammar/family/x', '/grammar/n5-001']) {
            expect(isDestinationActive(path, GRAMMAR)).toBe(true);
        }
        expect(isDestinationActive('/grammar', GRAMMAR)).toBe(false);
    });
});

describe('isMoreActive', () => {
    it('is active on the pages the More sheet lists', () => {
        expect(isMoreActive('/listening/abc')).toBe(true);
        expect(isMoreActive('/settings')).toBe(true);
        expect(isMoreActive('/about')).toBe(true);
        expect(isMoreActive('/kanji')).toBe(true);
        expect(isMoreActive('/stats')).toBe(false);
    });
});

describe('isSessionPath', () => {
    it('recognises the two session pages only', () => {
        expect(isSessionPath('/quiz')).toBe(true);
        expect(isSessionPath('/grammar')).toBe(true);
        expect(isSessionPath('/grammar/chapters')).toBe(false);
        expect(isSessionPath('/')).toBe(false);
    });
});

describe('synonymsPath', () => {
    it("is the word's page, at its Synonyms card, inside Vocabulary", () => {
        expect(synonymsPath('1224020')).toBe('/vocab/1224020#synonyms');
        expect(isDestinationActive('/vocab/1224020', VOCABULARY)).toBe(true);
    });
});
