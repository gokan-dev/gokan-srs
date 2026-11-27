import { describe, expect, it } from 'vitest';
import { japaneseRuns } from './japaneseRuns';

describe('japaneseRuns', () => {
    it('splits a mixed title into its Japanese and English runs', () => {
        expect(japaneseRuns('から / ので')).toEqual([
            { text: 'から', japanese: true },
            { text: ' / ', japanese: false },
            { text: 'ので', japanese: true },
        ]);
        expect(japaneseRuns('Using ～ば、then 理由')).toEqual([
            { text: 'Using ', japanese: false },
            { text: '～ば、', japanese: true },
            { text: 'then ', japanese: false },
            { text: '理由', japanese: true },
        ]);
    });

    it('keeps text in one script as one run, and nothing as none', () => {
        expect(japaneseRuns('Giving a reason')).toEqual([{ text: 'Giving a reason', japanese: false }]);
        expect(japaneseRuns('だから')).toEqual([{ text: 'だから', japanese: true }]);
        expect(japaneseRuns('')).toEqual([]);
    });
});
