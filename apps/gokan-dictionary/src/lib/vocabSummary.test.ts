import { describe, it, expect } from 'vitest';
import { vocabSummaryFrom } from './vocabSummary';
import { vocabulary } from '../test/fixtures';

describe('vocabSummaryFrom', () => {
    it('projects id, headword, reading, and the first gloss', () => {
        expect(vocabSummaryFrom(vocabulary())).toEqual({
            id: '1589350',
            word: '思う',
            secondary: 'おもう',
            gloss: 'to think',
        });
    });

    it('names a word learned in kana by its kana, with its kanji spelling beside it', () => {
        const here = vocabulary({
            writtenForm: { kanji: '此処', alternatives: [], containedKanji: ['此', '処'] },
            reading: { primary: 'ここ', alternatives: [] },
            usuallyKana: true,
        });
        expect(vocabSummaryFrom(here)).toMatchObject({ word: 'ここ', secondary: '此処' });
    });

    it('leaves gloss undefined when there are no senses', () => {
        expect(vocabSummaryFrom(vocabulary({ senses: [] })).gloss).toBeUndefined();
    });
});
