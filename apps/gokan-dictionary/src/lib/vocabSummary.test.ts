import { describe, it, expect } from 'vitest';
import { shortGloss, truncateAtWord, vocabSummaryFrom } from './vocabSummary';
import { vocabulary } from '../test/fixtures';

describe('vocabSummaryFrom', () => {
    it('projects id, headword, reading and the first sense', () => {
        expect(vocabSummaryFrom(vocabulary())).toEqual({
            id: '1589350',
            word: '思う',
            reading: 'おもう',
            gloss: 'to think; to consider',
        });
    });

    it('names a word learned in kana by its kana, and never shows its kanji spelling', () => {
        const here = vocabulary({
            writtenForm: { kanji: '此処', alternatives: [], containedKanji: ['此', '処'] },
            reading: { primary: 'ここ', alternatives: [] },
            usuallyKana: true,
        });
        expect(vocabSummaryFrom(here)).toEqual({ id: '1589350', word: 'ここ', gloss: 'to think; to consider' });
    });

    it('leaves gloss out when there are no senses', () => {
        expect(vocabSummaryFrom(vocabulary({ senses: [] })).gloss).toBeUndefined();
    });
});

describe('shortGloss', () => {
    it('cuts a long first sense at a word boundary', () => {
        const glosses = ['to live on (e.g. a salary)', 'to live off', 'to subsist on', 'to make a living by'];
        const vocab = vocabulary({ senses: [{ pos: [], misc: { rawTags: [] }, glosses, related: { compounds: [] } }] });
        const gloss = shortGloss(vocab);
        expect(gloss.length).toBeLessThanOrEqual(60);
        expect(gloss).toBe('to live on (e.g. a salary); to live off; to subsist on; to…');
    });
});

describe('truncateAtWord', () => {
    it('keeps short text as it is', () => {
        expect(truncateAtWord('to eat', 60)).toBe('to eat');
    });

    it('drops a trailing separator before the ellipsis', () => {
        expect(truncateAtWord('alpha; beta gamma', 13)).toBe('alpha; beta…');
        expect(truncateAtWord('alpha; beta', 9)).toBe('alpha…');
    });

    it('cuts a single long word mid-word', () => {
        expect(truncateAtWord('abcdefghij', 5)).toBe('abcd…');
    });
});
