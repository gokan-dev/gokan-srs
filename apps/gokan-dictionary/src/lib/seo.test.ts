import { describe, it, expect } from 'vitest';
import { vocabMeta, kanjiMeta, grammarMeta, homeMeta, grammarChaptersIndexMeta, grammarChapterMeta, grammarFamilyMeta, grammarConjugationsIndexMeta, searchablePattern, quotedGlosses, sentenceCase } from './seo';
import type { GrammarChapter, Kanji } from '@gokan/dataset-schema';
import { grammarPoint, vocabulary } from '../test/fixtures';

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
        const { title, description } = vocabMeta(vocabulary());
        expect(title).toContain('思う');
        expect(title).toContain('おもう');
        expect(description).toContain('to think');
    });

    it('puts the English meaning in the title, as learners search it', () => {
        const { title } = vocabMeta(vocabulary());
        expect(title).toMatch(/^思う \(おもう\) meaning: to think, to consider/);
    });

    it('truncates a long meaning in the title but not in the description', () => {
        const long = 'to be thoroughly and completely exhausted after a long day';
        const vocab = vocabulary({
            senses: [{ pos: ['v1'], misc: { rawTags: [] }, glosses: [long], related: { compounds: [] } }],
        });
        expect(vocabMeta(vocab).title).not.toContain(long);
        expect(vocabMeta(vocab).title).toContain('…');
        expect(vocabMeta(vocab).description).toContain(long);
    });

    it('appends the JLPT level when present', () => {
        const { title } = vocabMeta(vocabulary({ jlptLevel: 4 }));
        expect(title).toContain('JLPT N4');
    });

    it('leads with the kana for a word learned in kana, keeping its kanji spelling', () => {
        const here = vocabulary({
            writtenForm: { kanji: '此処', alternatives: [], containedKanji: ['此', '処'] },
            reading: { primary: 'ここ', alternatives: [] },
            usuallyKana: true,
        });
        expect(vocabMeta(here).title).toMatch(/^ここ \(此処\)/);
    });

    it('omits the JLPT suffix when absent', () => {
        const { title } = vocabMeta(vocabulary());
        expect(title).not.toContain('JLPT');
    });

    it('falls back to a generic description when there are no glosses', () => {
        const { description } = vocabMeta(vocabulary({ senses: [] }));
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
        const { title, description } = kanjiMeta(makeKanji(), 0);
        expect(description).not.toContain('0 vocabulary');
        expect(title).not.toContain('words using');
    });

    it('pairs the character with the word "kanji", as it is searched', () => {
        expect(kanjiMeta(makeKanji(), 3).title).toMatch(/^思 kanji/);
    });
});

describe('grammarMeta', () => {
    it('titles a construction by its searchable pattern, romaji and quoted meaning', () => {
        const { title } = grammarMeta(grammarPoint());
        expect(title).toMatch(/^を問わず \(wo towazu\) meaning: regardless of, irrespective of \| JLPT N2 grammar/);
    });

    it('falls back to "meaning and usage" when the explanation quotes no equivalent', () => {
        const { title } = grammarMeta(grammarPoint({ shortExplanation: 'Indicates a contrast.' }));
        expect(title).toContain('を問わず (wo towazu) meaning and usage');
    });

    it('omits the romaji when the point has none', () => {
        expect(grammarMeta(grammarPoint({ romaji: undefined })).title).toMatch(/^を問わず meaning/);
    });

    it('titles a conjugation by the form it derives', () => {
        const point = grammarPoint({ title: 'Verb させる', romaji: 'Verb-saseru', jlptLevel: 4, kind: 'inflection', derives: 'causative (させる)' });
        expect(grammarMeta(point).title).toMatch(/^Causative \(させる\) conjugation and usage \| JLPT N4 grammar/);
    });

    it('keeps an i-adjective conjugation in lowercase', () => {
        const point = grammarPoint({ title: 'い-Adjective て', kind: 'inflection', derives: 'i-adjective て-form (くて)' });
        expect(grammarMeta(point).title).toMatch(/^i-adjective て-form/);
    });

    it('keeps the explanation in the description', () => {
        expect(grammarMeta(grammarPoint()).description).toContain("'regardless of'");
    });
});

describe('searchablePattern', () => {
    it.each([
        ['～を問わず', 'を問わず'],
        ['Noun を余儀なくされる', 'を余儀なくされる'],
        ['Noun から Noun に 至る まで', 'からに至るまで'],
        ['Noun1 も Noun1 なら、Noun2 も Noun2 だ', 'もなら、もだ'],
        ['い-Adjective て', 'て'],
        ['Verb-te kureru', 'te kureru'],
        ['〜ga Verb rareru', 'ga rareru'],
        ['A は B より～', 'A は B より'],
    ])('%s -> %s', (pattern, expected) => {
        expect(searchablePattern(pattern)).toBe(expected);
    });

    it('returns an empty string for a pattern made only of placeholders', () => {
        expect(searchablePattern('Verb')).toBe('');
    });
});

describe('sentenceCase', () => {
    it.each([
        ['causative (させる)', 'Causative (させる)'],
        ['て-form', 'て-form'],
        ['na-adjective adverbial (に)', 'na-adjective adverbial (に)'],
    ])('%s -> %s', (text, expected) => {
        expect(sentenceCase(text)).toBe(expected);
    });
});

describe('quotedGlosses', () => {
    it('joins at most two quoted equivalents', () => {
        expect(quotedGlosses("'not always', 'not necessarily', 'hardly'")).toBe('not always, not necessarily');
    });

    it('does not end a quote at an apostrophe inside a word', () => {
        expect(quotedGlosses("Emphasis; 'isn't it?', 'right?'.")).toBe("isn't it?, right?");
    });

    it('returns undefined when nothing is quoted', () => {
        expect(quotedGlosses('Expresses a desire.')).toBeUndefined();
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
