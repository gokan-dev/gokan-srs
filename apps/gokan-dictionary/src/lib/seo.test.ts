import { describe, it, expect } from 'vitest';
import { vocabMeta, kanjiMeta, homeMeta, grammarChaptersIndexMeta, grammarChapterMeta, grammarFamilyMeta, grammarConjugationsIndexMeta } from './seo';
import type { Vocabulary } from '../models/vocabulary.model';
import type { Kanji } from '../models/kanji.model';
import type { GrammarChapter } from '../models/grammar.model';

function makeVocab(overrides: Partial<Vocabulary> = {}): Vocabulary {
    return {
        id: '1589350',
        writtenForm: { kanji: '思う', alternatives: [], containedKanji: ['思'] },
        reading: { primary: 'おもう', alternatives: [] },
        frequency: { kanjiRank: 1 },
        progression: { kklcStep: 1 },
        senses: [
            { pos: ['v5u'], misc: { rawTags: [] }, glosses: ['to think', 'to consider'], related: { compounds: [] } },
        ],
        isCommon: true,
        ...overrides,
    };
}

function makeKanji(overrides: Partial<Kanji> = {}): Kanji {
    return {
        character: '思',
        steps: { kklc: 1 },
        frequency: 500,
        ...overrides,
    };
}

describe('vocabMeta', () => {
    it('includes the written form, reading, and first gloss', () => {
        const { title, description } = vocabMeta(makeVocab());
        expect(title).toContain('思う');
        expect(title).toContain('おもう');
        expect(description).toContain('to think');
    });

    it('appends the JLPT level when present', () => {
        const { title } = vocabMeta(makeVocab({ jlptLevel: 4 }));
        expect(title).toContain('JLPT N4');
    });

    it('omits the JLPT suffix when absent', () => {
        const { title } = vocabMeta(makeVocab());
        expect(title).not.toContain('JLPT');
    });

    it('falls back to a generic description when there are no glosses', () => {
        const { description } = vocabMeta(makeVocab({ senses: [] }));
        expect(description).not.toContain('undefined');
        expect(description).toContain('思う');
    });
});

describe('kanjiMeta', () => {
    it('includes the character and vocab count', () => {
        const { title, description } = kanjiMeta(makeKanji(), 42);
        expect(title).toContain('思');
        expect(description).toContain('42');
    });

    it('appends the JLPT level when present', () => {
        const { title } = kanjiMeta(makeKanji({ steps: { kklc: 1, jlpt: 3 } }), 0);
        expect(title).toContain('JLPT N3');
    });

    it('uses singular wording for exactly one vocab word', () => {
        const { description } = kanjiMeta(makeKanji(), 1);
        expect(description).toContain('1 vocabulary word ');
        expect(description).not.toContain('1 vocabulary words');
    });

    it('handles zero associated vocab without a dangling count', () => {
        const { description } = kanjiMeta(makeKanji(), 0);
        expect(description).not.toContain('0 vocabulary');
    });
});

describe('homeMeta', () => {
    it('returns a non-empty title and description', () => {
        const { title, description } = homeMeta();
        expect(title.length).toBeGreaterThan(0);
        expect(description.length).toBeGreaterThan(0);
    });
});

function makeChapter(overrides: Partial<GrammarChapter> = {}): GrammarChapter {
    return {
        id: 'n5-c01',
        title: 'Topic, identity and の',
        summary: 'The は topic marker and the copula pattern.',
        jlptLevel: 5,
        points: ['n5-040', 'n5-125', 'n5-011'],
        ...overrides,
    };
}

describe('grammarChaptersIndexMeta', () => {
    it('includes the chapter and point counts', () => {
        const { title, description } = grammarChaptersIndexMeta(151, 760);
        expect(title).toContain('151');
        expect(description).toContain('151');
        expect(description).toContain('760');
    });
});

describe('grammarChapterMeta', () => {
    it('includes the chapter title and point count', () => {
        const { title, description } = grammarChapterMeta(makeChapter());
        expect(title).toContain('Topic, identity and の');
        expect(description).toContain('3 grammar points');
    });

    it('uses singular wording for a one-point chapter', () => {
        const { description } = grammarChapterMeta(makeChapter({ points: ['n5-040'] }));
        expect(description).toContain('1 grammar point ');
        expect(description).not.toContain('1 grammar points');
    });
});

describe('grammarFamilyMeta', () => {
    it('includes the family name and member count', () => {
        const { title, description } = grammarFamilyMeta('Causality (Because / Since / Due to)', 5);
        expect(title).toContain('Causality');
        expect(description).toContain('5 related Japanese grammar points');
    });
});

describe('grammarConjugationsIndexMeta', () => {
    it('includes the form and point counts', () => {
        const { description } = grammarConjugationsIndexMeta(38, 40);
        expect(description).toContain('38 conjugation forms');
        expect(description).toContain('40 inflection patterns');
    });
});
