import { describe, expect, it } from 'vitest';
import { kanjiCoverage } from './kanjiCoverage.utils';

describe('kanjiCoverage', () => {
    const index = [
        { id: 'v1', containedKanji: ['日', '本'] },
        { id: 'v2', containedKanji: ['人'] },
        { id: 'v3', containedKanji: ['山'] },
    ];

    it('counts known kanji met in a queued word, out of every known kanji', () => {
        const result = kanjiCoverage(index, [{ vocabId: 'v1' }, { vocabId: 'v2' }], { kanjiSet: new Set(['日', '人', '川']) });
        expect(result).toEqual({ covered: 2, total: 3 });
    });

    it('ignores words that are not in the queue, and kanji the learner does not know', () => {
        const result = kanjiCoverage(index, [{ vocabId: 'v3' }], { kanjiSet: new Set(['日']) });
        expect(result).toEqual({ covered: 0, total: 1 });
    });
});
