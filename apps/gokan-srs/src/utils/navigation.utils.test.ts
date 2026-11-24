import { describe, it, expect } from 'vitest';
import { GRAMMAR, KANJI, MORE_DESTINATIONS, STUDY, VOCABULARY, WHATS_NEW, isDestinationActive, isMoreActive, drillPath, grammarChapterPath, grammarFamilyPath, grammarPath, isSessionPath, kanjiPath, synonymsPath, vocabPath } from './navigation.utils';

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

describe('kanjiPath', () => {
    it("is the kanji's page, the glyph as written", () => {
        expect(kanjiPath('輝')).toBe('/kanji/輝');
    });
});

describe('grammarPath', () => {
    it("builds a grammar point's page, its id encoded", () => {
        expect(grammarPath('n4-110')).toBe('/grammar/n4-110');
        expect(grammarPath('a/b')).toBe('/grammar/a%2Fb');
    });
});

describe('grammarFamilyPath and grammarChapterPath', () => {
    it('build the family page and the chapter browser open on a chapter, ids encoded', () => {
        expect(grammarFamilyPath('causality')).toBe('/grammar/family/causality');
        expect(grammarFamilyPath('a/b')).toBe('/grammar/family/a%2Fb');
        expect(grammarChapterPath('n5-c17')).toBe('/grammar/chapters?chapter=n5-c17');
        expect(grammarChapterPath('a&b')).toBe('/grammar/chapters?chapter=a%26b');
    });
});

describe('drillPath', () => {
    it('names each kind of set, its ids encoded', () => {
        expect(drillPath({ kind: 'lesson', familyId: 'causality', lessonId: 'reason-core' })).toBe('/grammar/drill/lesson/causality/reason-core');
        expect(drillPath({ kind: 'family', familyId: 'contradiction' })).toBe('/grammar/drill/family/contradiction');
        expect(drillPath({ kind: 'chapter', chapterId: 'n5-c17' })).toBe('/grammar/drill/chapter/n5-c17');
        expect(drillPath({ kind: 'point', grammarId: 'a/b' })).toBe('/grammar/drill/point/a%2Fb');
    });

    it('is a grammar page, inside Grammar, and no study session', () => {
        const path = drillPath({ kind: 'family', familyId: 'x' });
        expect(isDestinationActive(path, GRAMMAR)).toBe(true);
        expect(isSessionPath(path)).toBe(false);
    });
});
