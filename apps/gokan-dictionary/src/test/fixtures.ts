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

/** ～を問わず, an N2 construction whose explanation quotes its English equivalents. */
export function grammarPoint(overrides: Partial<GrammarPoint> = {}): GrammarPoint {
    return {
        id: 'n2-169',
        title: '～を問わず',
        romaji: '〜wo towazu',
        jlptLevel: 2,
        shortExplanation: "Means 'regardless of' or 'irrespective of'.",
        longExplanation: 'Used to say that something holds whatever the value of the noun.',
        formation: 'Noun + を問わず',
        kind: 'construction',
        examples: [],
        ...overrides,
    };
}

/** 学, an N5 kanji, as KANJIDIC2 and KRADFILE describe it. */
export function kanji(overrides: Partial<Kanji> = {}): Kanji {
    return {
        character: '学',
        steps: { kklc: 99, rtk: 346, jlpt: 5 },
        frequency: 63,
        newspaperFrequency: 63,
        meanings: ['study', 'learning', 'science'],
        readings: { on: ['ガク'], kun: ['まな.ぶ'], nanori: ['たか'] },
        strokeCount: 8,
        grade: 1,
        radical: { number: 39, character: '子' },
        components: ['子', '⺌', '冖'],
        ...overrides,
    };
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
