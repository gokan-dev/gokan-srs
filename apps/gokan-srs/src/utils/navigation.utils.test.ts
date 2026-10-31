import { describe, it, expect } from 'vitest';
import { GRAMMAR, KANJI, MORE_DESTINATIONS, STUDY, VOCABULARY, WHATS_NEW, isDestinationActive, isMoreActive, isSessionPath, synonymsPath, vocabPath, wordReviewPath } from './navigation.utils';

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

    it("lists What's new, so a phone reaches it and More is active on it", () => {
        expect(MORE_DESTINATIONS).toContain(WHATS_NEW);
        expect(isMoreActive('/whats-new')).toBe(true);
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

describe('vocabPath', () => {
    it('opens Dict with no hash, another tab by its hash', () => {
        expect(vocabPath('1224020')).toBe('/vocab/1224020');
        expect(vocabPath('1224020', 'kanji')).toBe('/vocab/1224020#kanji');
    });
});

describe('wordReviewPath', () => {
    it("names the word in the quiz's review parameter", () => {
        expect(wordReviewPath('1224020')).toBe('/quiz?review=1224020');
    });
});
