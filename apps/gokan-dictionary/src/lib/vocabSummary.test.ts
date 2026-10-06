import { describe, it, expect } from 'vitest';
import { vocabSummaryFrom } from './vocabSummary';
import { vocabulary } from '../test/fixtures';

describe('vocabSummaryFrom', () => {
    it('projects id, kanji, reading, and the first gloss', () => {
        expect(vocabSummaryFrom(vocabulary())).toEqual({
            id: '1589350',
            kanji: '思う',
            reading: 'おもう',
            gloss: 'to think',
        });
    });

    it('leaves gloss undefined when there are no senses', () => {
        expect(vocabSummaryFrom(vocabulary({ senses: [] })).gloss).toBeUndefined();
    });
});
