import { describe, it, expect } from 'vitest';
import { KANJI_ORDERS, kanjiOrder, type GrammarChapter } from '@gokan/dataset-schema';
import { grammarPoint, kanji, vocabulary } from '../../test/fixtures';
import { en } from './en';

describe('numbers', () => {
    // Written in English whatever the machine building the pages: once read the builder's own
    // locale, so a build in France wrote "3 128" where CI wrote "3,128".
    it('groups thousands as English does, on any machine', () => {
        expect(en.meta.kanjiIndex(3128).description).toContain('All 3,128 kanji');
        expect(en.meta.vocabIndex(35872).description).toMatch(/^35,872 Japanese words/);
    });
});

describe('count', () => {
    it('writes the singular for exactly one, the plural otherwise, the number grouped', () => {
        expect(en.count(0, 'word')).toBe('0 words');
        expect(en.count(1, 'word')).toBe('1 word');
        expect(en.count(1000, 'word')).toBe('1,000 words');
    });
});

describe('meta.vocab', () => {
    it('includes the written form, reading, and first gloss', () => {
        const { title, description } = en.meta.vocab(vocabulary());
        expect(title).toContain('思う');
        expect(title).toContain('おもう');
        expect(description).toContain('to think');
    });

    it('puts the English meaning in the title, as learners search it', () => {
        const { title } = en.meta.vocab(vocabulary());
        expect(title).toMatch(/^思う \(おもう\) meaning: to think, to consider/);
    });

    it('truncates a long meaning in the title but not in the description', () => {
        const long = 'to be thoroughly and completely exhausted after a long day';
        const vocab = vocabulary({
            senses: [{ pos: ['v1'], misc: { rawTags: [] }, glosses: [long], related: { compounds: [] } }],
        });
        expect(en.meta.vocab(vocab).title).not.toContain(long);
        expect(en.meta.vocab(vocab).title).toContain('…');
        expect(en.meta.vocab(vocab).description).toContain(long);
    });

    it('appends the JLPT level when present', () => {
        const { title } = en.meta.vocab(vocabulary({ jlptLevel: 4 }));
        expect(title).toContain('JLPT N4');
    });

    it('leads with the kana for a word learned in kana, keeping its kanji spelling', () => {
        const here = vocabulary({
            writtenForm: { kanji: '此処', alternatives: [], containedKanji: ['此', '処'] },
            reading: { primary: 'ここ', alternatives: [] },
            usuallyKana: true,
        });
        expect(en.meta.vocab(here).title).toMatch(/^ここ \(此処\)/);
    });

    it('omits the JLPT suffix when absent', () => {
        const { title } = en.meta.vocab(vocabulary());
        expect(title).not.toContain('JLPT');
    });

    it('falls back to a generic description when there are no glosses', () => {
        const { description } = en.meta.vocab(vocabulary({ senses: [] }));
        expect(description).not.toContain('undefined');
        expect(description).toContain('思う');
    });
});

describe('meta.kanji', () => {
    it('titles the kanji by its meaning, as it is searched', () => {
        expect(en.meta.kanji(kanji(), 3).title).toMatch(/^学 kanji meaning: study, learning, science \(JLPT N5\) - /);
    });

    it('describes the meaning, the readings as typed and the words that use it', () => {
        expect(en.meta.kanji(kanji(), 42).description)
            .toBe('The kanji 学 means "study, learning, science", read ガク, まなぶ. Its 8 strokes, components and readings, and the 42 words that use it.');
    });

    it('uses singular wording for exactly one word, and none for zero', () => {
        expect(en.meta.kanji(kanji(), 1).description).toContain(', and the 1 word that uses it.');
        expect(en.meta.kanji(kanji(), 0).description).not.toContain(' word');
    });

    it('falls back to the character alone for a kanji with no meaning', () => {
        const zero = kanji({ character: '〇', meanings: [], readings: { on: [], kun: [], nanori: [] }, strokeCount: 1, steps: {} });
        expect(en.meta.kanji(zero, 0)).toEqual({ title: '〇 kanji - Gokan Dictionary', description: 'The kanji 〇. Its 1 stroke, components and readings.' });
    });
});

describe('meta.grammar', () => {
    it('titles a construction by its searchable pattern, romaji and quoted meaning', () => {
        const { title } = en.meta.grammar(grammarPoint());
        expect(title).toMatch(/^を問わず \(wo towazu\) meaning: regardless of, irrespective of \| JLPT N2 grammar/);
    });

    it('falls back to "meaning and usage" when the explanation quotes no equivalent', () => {
        const { title } = en.meta.grammar(grammarPoint({ shortExplanation: 'Indicates a contrast.' }));
        expect(title).toContain('を問わず (wo towazu) meaning and usage');
    });

    it('omits the romaji when the point has none', () => {
        expect(en.meta.grammar(grammarPoint({ romaji: undefined })).title).toMatch(/^を問わず meaning/);
    });

    it('titles a conjugation by the form it derives', () => {
        const point = grammarPoint({ title: 'Verb させる', romaji: 'Verb-saseru', jlptLevel: 4, kind: 'inflection', derives: 'causative (させる)' });
        expect(en.meta.grammar(point).title).toMatch(/^Causative \(させる\) conjugation and usage \| JLPT N4 grammar/);
    });

    it('keeps an i-adjective conjugation in lowercase', () => {
        const point = grammarPoint({ title: 'い-Adjective て', kind: 'inflection', derives: 'i-adjective て-form (くて)' });
        expect(en.meta.grammar(point).title).toMatch(/^i-adjective て-form/);
    });

    it('keeps the explanation in the description', () => {
        expect(en.meta.grammar(grammarPoint()).description).toContain("'regardless of'");
    });
});

describe('meta.home', () => {
    it('returns a non-empty title and description', () => {
        const { title, description } = en.meta.home();
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

describe('meta.grammarChaptersIndex', () => {
    it('includes the chapter and point counts', () => {
        const { title, description } = en.meta.grammarChaptersIndex(151, 760);
        expect(title).toContain('151');
        expect(description).toContain('151');
        expect(description).toContain('760');
    });
});

describe('meta.grammarChapter', () => {
    it('includes the chapter title and point count', () => {
        const { title, description } = en.meta.grammarChapter(makeChapter());
        expect(title).toContain('Topic, identity and の');
        expect(description).toContain('3 grammar points');
    });

    it('uses singular wording for a one-point chapter', () => {
        const { description } = en.meta.grammarChapter(makeChapter({ points: ['n5-040'] }));
        expect(description).toContain('1 grammar point ');
        expect(description).not.toContain('1 grammar points');
    });
});

describe('meta.grammarFamily', () => {
    it('includes the family name and member count', () => {
        const { title, description } = en.meta.grammarFamily('Causality (Because / Since / Due to)', 5);
        expect(title).toContain('Causality');
        expect(description).toContain('5 related Japanese grammar points');
    });
});

describe('meta.grammarConjugationsIndex', () => {
    it('includes the form and point counts', () => {
        const { description } = en.meta.grammarConjugationsIndex(38, 40);
        expect(description).toContain('38 conjugation forms');
        expect(description).toContain('40 inflection patterns');
    });
});

describe('meta.vocabJlpt', () => {
    it('names the page after the first, so every list page has its own title', () => {
        expect(en.meta.vocabJlpt(1, 2817).title).toContain('JLPT N1 Vocabulary List (2,817 words) - ');
        expect(en.meta.vocabJlpt(1, 2817, 3).title).toContain('(2,817 words), page 3 - ');
        expect(en.meta.vocabJlpt(1, 2817, 3).title).not.toBe(en.meta.vocabJlpt(1, 2817, 2).title);
    });
});

describe('meta.grammarFamiliesIndex and searchMeta', () => {
    it('describe their pages', () => {
        expect(en.meta.grammarFamiliesIndex(123).description).toContain('123 groups');
        expect(en.meta.search().title).toContain('Search');
    });
});

describe('kanji order pages', () => {
    it('lead the titles with what a learner types', () => {
        expect(en.meta.kanjiOrder(kanjiOrder('kklc'), 2300, 34187).title).toBe('KKLC vocabulary list by kanji step - Gokan Dictionary');
        expect(en.meta.kanjiRange(kanjiOrder('kklc'), { first: 1, last: 100 }, 412).title)
            .toBe('KKLC vocabulary: words you can read after kanji 1 to 100 - Gokan Dictionary');
        expect(en.meta.kanjiOrders(KANJI_ORDERS).title).toBe('Vocabulary by kanji learning order: KKLC, RTK and more - Gokan Dictionary');
    });

    it('name an order that is not a book, or an older edition, as it is searched', () => {
        expect(en.meta.kanjiOrder(kanjiOrder('jlpt'), 2211, 32186).title).toBe('JLPT kanji order vocabulary list by kanji step - Gokan Dictionary');
        expect(en.meta.kanjiOrder(kanjiOrder('rtkLegacy'), 3007, 34694).title).toBe('RTK 1st to 5th editions vocabulary list by kanji step - Gokan Dictionary');
    });

    it('head a range page with its title, for every order, never naming kanji twice', () => {
        for (const order of KANJI_ORDERS) {
            const range = { first: 301, last: 400 };
            const heading = en.kanjiRangeHeading(order, range);
            expect(heading).not.toContain(`${order.searchName} kanji`);
            expect(`${heading} - Gokan Dictionary`).toBe(en.meta.kanjiRange(order, range, 10).title);
        }
    });

    it('say how many kanji and words each page covers', () => {
        expect(en.meta.kanjiOrders(KANJI_ORDERS).description).toContain(`${KANJI_ORDERS.length} kanji learning orders`);
        const order = en.meta.kanjiOrder(kanjiOrder('kklc'), 2300, 34187).description;
        expect(order).toContain('KKLC (Kodansha Kanji Learner\'s Course): 2,300 kanji');
        expect(order).toContain('34,187 words');
        const range = en.meta.kanjiRange(kanjiOrder('henshall'), { first: 1901, last: 1945 }, 1);
        expect(range.description).toContain('The 45 kanji of Henshall steps 1901 to 1945 and the 1 word they unlock');
    });
});

describe('meta.error', () => {
    it('names a missing page and a failure apart, each under the site name', () => {
        expect(en.meta.error(404).title).toBe('Page not found - Gokan Dictionary');
        expect(en.meta.error(500).title).toBe('Page unavailable - Gokan Dictionary');
        expect(en.meta.error(503)).toEqual(en.meta.error(500));
    });
});
