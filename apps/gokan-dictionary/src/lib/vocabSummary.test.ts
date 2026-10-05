import { describe, it, expect } from 'vitest';
import { vocabSummaryFrom } from './vocabSummary';
import type { Vocabulary } from '@gokan/dataset-schema';

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

describe('vocabSummaryFrom', () => {
    it('projects id, kanji, reading, and the first gloss', () => {
        expect(vocabSummaryFrom(makeVocab())).toEqual({
            id: '1589350',
            kanji: '思う',
            reading: 'おもう',
            gloss: 'to think',
        });
    });

    it('leaves gloss undefined when there are no senses', () => {
        expect(vocabSummaryFrom(makeVocab({ senses: [] })).gloss).toBeUndefined();
    });
});
