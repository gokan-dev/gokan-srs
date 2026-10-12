/**
 * Shared test fixtures for the dictionary. Tests build dataset objects here rather than
 * declaring their own copy, so a schema change updates one factory (AGENTS.md, No duplication).
 */
import type { GrammarPoint, Vocabulary } from '@gokan/dataset-schema';

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
