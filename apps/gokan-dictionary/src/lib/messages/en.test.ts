import { describe, it, expect } from 'vitest';
import { KANJI_ORDERS, kanjiOrder, type GrammarChapter, type KanjiOrder } from '@gokan/dataset-schema';
import { grammarPoint, kanji, panelCopyPerOrder, vocabulary } from '../../test/fixtures';
import { en } from './en';
import type { LinkedText } from './index';
import { zhHans } from './zh-hans';

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

describe('meta.home', () => {
    // The learning orders are what no other dictionary lists: the home page leads with them, and
    // still names itself a Japanese dictionary for the searches it already answers.
    it('leads with the kanji learning orders and keeps "Japanese dictionary"', () => {
        const { title, description } = en.meta.home();
        expect(title).toMatch(/^Japanese Dictionary by the Kanji You Know: KKLC, RTK/);
        expect(description).toContain('Japanese dictionary');
        expect(description).toContain('KKLC, RTK');
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

describe('appPanel', () => {
    const kklc = kanjiOrder('kklc');

    it('names the step at which a word becomes readable, the word marked as Japanese', () => {
        const copy = en.appPanel.word('学生', { order: kklc, step: 212 });
        expect(copy.text).toEqual(['You can read ', { text: '学生', lang: 'ja' }, ' after step 212 of KKLC. Gokan teaches words in the order of the kanji you know.']);
        // The link starts the learner with step 212 known: their first new kanji is the next one.
        expect(copy.action).toBe('Start after step 212');
    });

    it('counts the words knowing an order up to a kanji\'s step unlocks, and on a range page leaves the count to its intro', () => {
        expect(en.appPanel.kanji('学', { order: kklc, step: 212 }, 1450).text.at(-1)).toContain('the 1,450 words those kanji unlock');
        const range = en.appPanel.range({ order: kanjiOrder('jlpt'), step: 400 });
        expect(range.text).toEqual(['Know the JLPT kanji order up to step 400? Gokan starts you with the words those kanji unlock.']);
        expect(range.action).toBe('Start after step 400');
    });

    it('names an order by its prose name: a derived order or a card set in lower case with "the", a book as titled', () => {
        expect(en.appPanel.word('学生', { order: kanjiOrder('frequency'), step: 412 }).text.at(-1)).toContain('after step 412 of the kanji frequency order.');
        expect(en.appPanel.order(kanjiOrder('frequency')).text).toEqual(['Study vocabulary with the kanji frequency order: Gokan teaches each word once you know its kanji.']);
        expect(en.appPanel.order(kanjiOrder('kanjiFlashcards')).text).toEqual(['Study vocabulary with the White Rabbit kanji cards: Gokan teaches each word once you know its kanji.']);
        expect(en.appPanel.range({ order: kanjiOrder('rtkLegacy'), step: 300 }).text).toEqual(['Know RTK (1st to 5th editions) up to step 300? Gokan starts you with the words those kanji unlock.']);
        expect(en.appPanel.order(kklc).text[0]).toContain('with KKLC:');
    });
});

// Every catalog, every order: the panel's sentences name an order by a name that reads inside a
// sentence (English's proseName, Chinese's searchName), never its short label ("Frequency", "RTK,
// older editions").
describe.each([['en', en, (order: KanjiOrder) => order.proseName], ['zh-hans', zhHans, (order: KanjiOrder) => order.searchName]] as const)('%s appPanel, every order', (_locale, messages, nameOf) => {
    const proseOf = (copy: { text: LinkedText; action: string }) => [...copy.text.map(part => (typeof part === 'string' ? part : part.text)), copy.action].join('');

    it.each(KANJI_ORDERS.map(order => [order.id, order] as const))('%s', (_id, order) => {
        const at = { order, step: 7 };
        const outputs = [messages.appPanel.word('学生', at), messages.appPanel.kanji('学', at, 3), messages.appPanel.range(at), messages.appPanel.order(order)].map(proseOf);
        const name = nameOf(order);
        expect(name).not.toContain(',');
        // Mid-sentence, an article is lower case: "with the kanji frequency order".
        expect(name).not.toMatch(/^The /);
        // Maniette's name is a French title: a run marked French, in either catalog.
        if (order.id === 'maniette') for (const copy of [messages.appPanel.word('学生', at), messages.appPanel.order(order)]) expect(copy.text).toContainEqual({ text: name, lang: 'fr' });
        for (const output of outputs) {
            expect(output).toContain(name);
            if (!name.includes(order.label)) expect(output.replaceAll(name, '')).not.toContain(order.label);
        }
    });
});

// Every order's panel copy, written out once so a reviewer reads all eleven and a change to an
// article or a name (each order's proseName) shows in the diff.
// A marked run reads {lang:text}.
describe('appPanel copy per order', () => {
    it('reads well for every order', () => {
        expect(panelCopyPerOrder(en)).toMatchInlineSnapshot(`
          "kklc:
            You can read {ja:学生} after step 1234 of KKLC. Gokan teaches words in the order of the kanji you know. [Start after step 1234]
            {ja:学} is step 1234 of KKLC. Know this far? Gokan starts you with the 5,678 words those kanji unlock. [Start after step 1234]
            Know KKLC up to step 1234? Gokan starts you with the words those kanji unlock. [Start after step 1234]
            Study vocabulary with KKLC: Gokan teaches each word once you know its kanji. [Start with this order]
          rtk:
            You can read {ja:学生} after step 1234 of RTK. Gokan teaches words in the order of the kanji you know. [Start after step 1234]
            {ja:学} is step 1234 of RTK. Know this far? Gokan starts you with the 5,678 words those kanji unlock. [Start after step 1234]
            Know RTK up to step 1234? Gokan starts you with the words those kanji unlock. [Start after step 1234]
            Study vocabulary with RTK: Gokan teaches each word once you know its kanji. [Start with this order]
          jlpt:
            You can read {ja:学生} after step 1234 of the JLPT kanji order. Gokan teaches words in the order of the kanji you know. [Start after step 1234]
            {ja:学} is step 1234 of the JLPT kanji order. Know this far? Gokan starts you with the 5,678 words those kanji unlock. [Start after step 1234]
            Know the JLPT kanji order up to step 1234? Gokan starts you with the words those kanji unlock. [Start after step 1234]
            Study vocabulary with the JLPT kanji order: Gokan teaches each word once you know its kanji. [Start with this order]
          frequency:
            You can read {ja:学生} after step 1234 of the kanji frequency order. Gokan teaches words in the order of the kanji you know. [Start after step 1234]
            {ja:学} is step 1234 of the kanji frequency order. Know this far? Gokan starts you with the 5,678 words those kanji unlock. [Start after step 1234]
            Know the kanji frequency order up to step 1234? Gokan starts you with the words those kanji unlock. [Start after step 1234]
            Study vocabulary with the kanji frequency order: Gokan teaches each word once you know its kanji. [Start with this order]
          kanjiKana:
            You can read {ja:学生} after step 1234 of Kanji & Kana. Gokan teaches words in the order of the kanji you know. [Start after step 1234]
            {ja:学} is step 1234 of Kanji & Kana. Know this far? Gokan starts you with the 5,678 words those kanji unlock. [Start after step 1234]
            Know Kanji & Kana up to step 1234? Gokan starts you with the words those kanji unlock. [Start after step 1234]
            Study vocabulary with Kanji & Kana: Gokan teaches each word once you know its kanji. [Start with this order]
          kanjiInContext:
            You can read {ja:学生} after step 1234 of Kanji in Context. Gokan teaches words in the order of the kanji you know. [Start after step 1234]
            {ja:学} is step 1234 of Kanji in Context. Know this far? Gokan starts you with the 5,678 words those kanji unlock. [Start after step 1234]
            Know Kanji in Context up to step 1234? Gokan starts you with the words those kanji unlock. [Start after step 1234]
            Study vocabulary with Kanji in Context: Gokan teaches each word once you know its kanji. [Start with this order]
          rtkLegacy:
            You can read {ja:学生} after step 1234 of RTK (1st to 5th editions). Gokan teaches words in the order of the kanji you know. [Start after step 1234]
            {ja:学} is step 1234 of RTK (1st to 5th editions). Know this far? Gokan starts you with the 5,678 words those kanji unlock. [Start after step 1234]
            Know RTK (1st to 5th editions) up to step 1234? Gokan starts you with the words those kanji unlock. [Start after step 1234]
            Study vocabulary with RTK (1st to 5th editions): Gokan teaches each word once you know its kanji. [Start with this order]
          henshall:
            You can read {ja:学生} after step 1234 of Henshall. Gokan teaches words in the order of the kanji you know. [Start after step 1234]
            {ja:学} is step 1234 of Henshall. Know this far? Gokan starts you with the 5,678 words those kanji unlock. [Start after step 1234]
            Know Henshall up to step 1234? Gokan starts you with the words those kanji unlock. [Start after step 1234]
            Study vocabulary with Henshall: Gokan teaches each word once you know its kanji. [Start with this order]
          kanjiFlashcards:
            You can read {ja:学生} after step 1234 of the White Rabbit kanji cards. Gokan teaches words in the order of the kanji you know. [Start after step 1234]
            {ja:学} is step 1234 of the White Rabbit kanji cards. Know this far? Gokan starts you with the 5,678 words those kanji unlock. [Start after step 1234]
            Know the White Rabbit kanji cards up to step 1234? Gokan starts you with the words those kanji unlock. [Start after step 1234]
            Study vocabulary with the White Rabbit kanji cards: Gokan teaches each word once you know its kanji. [Start with this order]
          tuttleCards:
            You can read {ja:学生} after step 1234 of the Tuttle kanji cards. Gokan teaches words in the order of the kanji you know. [Start after step 1234]
            {ja:学} is step 1234 of the Tuttle kanji cards. Know this far? Gokan starts you with the 5,678 words those kanji unlock. [Start after step 1234]
            Know the Tuttle kanji cards up to step 1234? Gokan starts you with the words those kanji unlock. [Start after step 1234]
            Study vocabulary with the Tuttle kanji cards: Gokan teaches each word once you know its kanji. [Start with this order]
          maniette:
            You can read {ja:学生} after step 1234 of {fr:Les Kanjis dans la tête}. Gokan teaches words in the order of the kanji you know. [Start after step 1234]
            {ja:学} is step 1234 of {fr:Les Kanjis dans la tête}. Know this far? Gokan starts you with the 5,678 words those kanji unlock. [Start after step 1234]
            Know {fr:Les Kanjis dans la tête} up to step 1234? Gokan starts you with the words those kanji unlock. [Start after step 1234]
            Study vocabulary with {fr:Les Kanjis dans la tête}: Gokan teaches each word once you know its kanji. [Start with this order]"
        `);
    });
});

describe('pitch accent', () => {
    it('names heiban and where any other pattern drops, most usual first', () => {
        expect(en.vocab.pitchAccent([0])).toBe('Pitch accent: heiban');
        expect(en.vocab.pitchAccent([2, 0])).toBe('Pitch accent: drop after mora 2, or heiban');
        expect(zhHans.vocab.pitchAccent([2, 0])).toBe('音调：第2拍后下降，或平板型');
    });
});

describe('romajiPage intro (#278)', () => {
    const prose = (parts: LinkedText) => parts.map(part => (typeof part === 'string' ? part : part.text)).join('');

    it('says the kana tell apart words whose kana differ, never that only the context does', () => {
        // 禁煙 きんえん and 記念 きねん share /romaji/kinen/, the apostrophe dropped.
        for (const catalog of [en, zhHans]) {
            const intro = prose(catalog.romajiPage.intro(2, ['きんえん', 'きねん'], 'kinen', 'readings'));
            expect(intro).not.toBe(prose(catalog.romajiPage.intro(2, ['きんえん', 'きねん'], 'kinen', 'same')));
        }
        const intro = prose(en.romajiPage.intro(2, ['きんえん', 'きねん'], 'kinen', 'readings'));
        expect(intro).toBe('Two words are read きんえん or きねん (kinen). Written, their spelling tells them apart; spoken, their readings do.');
        expect(intro).not.toContain('only the context');
    });

    it('credits the readings with only some words when two share their kana: 人員, 辞任 and 自認 (jinin)', () => {
        const intro = prose(en.romajiPage.intro(3, ['じんいん', 'じにん'], 'jinin', 'partly-same'));
        expect(intro).toBe('Three words are read じんいん or じにん (jinin). Written, their spelling tells them apart; spoken, their readings tell some of them apart, and only the context the rest.');
        expect(intro).not.toContain('their readings do');
    });
});

describe('romajiPage note (#278)', () => {
    it('holds "mora" to its number with a no-break space, so a narrow note never splits them', () => {
        const note = en.romajiPage.note({ jlpt: 3, top: null, downsteps: [1, 0] });
        expect(note).toBe('N3 · Not in the frequency list · Pitch accent: drop after mora\u00a01, or heiban');
        expect(en.vocab.pitchAccent([1])).toBe('Pitch accent: drop after mora 1');
    });
});
