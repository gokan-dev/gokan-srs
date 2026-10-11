/**
 * Shared test fixtures for the dictionary. Tests build dataset objects here rather than
 * declaring their own copy, so a schema change updates one factory (AGENTS.md, No duplication).
 */
import type { GrammarPoint, Kanji, Sentence, Vocabulary } from '@gokan/dataset-schema';

/** 思う, a common verb with two glosses. */
export function vocabulary(overrides: Partial<Vocabulary> = {}): Vocabulary {
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

/** から, an N5 grammar point with no examples. */
export function grammarPoint(overrides: Partial<GrammarPoint> = {}): GrammarPoint {
    return {
        id: 'n5-073',
        title: 'から',
        romaji: 'kara',
        jlptLevel: 5,
        shortExplanation: 'Because, since; gives a reason.',
        longExplanation: 'から follows a clause to give the reason for the next one.',
        formation: 'Verb/Adjective + から',
        examples: [],
        ...overrides,
    };
}

/** 学, an N5 kanji. */
export function kanji(overrides: Partial<Kanji> = {}): Kanji {
    return { character: '学', steps: { kklc: 99, jlpt: 5 }, frequency: 63, ...overrides };
}

/** A sentence containing 思う (and 私), with one translation. */
export function sentence(overrides: Partial<Sentence> = {}): Sentence {
    return {
        id: 's1',
        original: '私はそう思う。',
        en: [{ id: 'e1', text: 'I think so.' }],
        vocabIds: ['1589350', '1311110'],
        matches: {
            '1311110': [{ start: 0, length: 1, reading: 'わたし' }],
            '1589350': [{ start: 4, length: 2, reading: 'おもう' }],
        },
        ...overrides,
    };
}
