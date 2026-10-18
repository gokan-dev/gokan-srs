import { describe, it, expect } from 'vitest';
import type { FrequencyIndex } from './indexes';
import { kanjiStepIndex } from './kanjiSteps';

const ORDER = ['一', '日', '学', '生'];

describe('kanjiStepIndex', () => {
    it('unlocks a word at the step of its last kanji, most frequent first', () => {
        const frequency: FrequencyIndex = [
            { id: 'gakusei', containedKanji: ['学', '生'] },
            { id: 'ichinichi', containedKanji: ['一', '日'] },
            { id: 'nichi', containedKanji: ['日'] },
        ];
        expect(kanjiStepIndex(frequency, ORDER)).toEqual({ 2: ['ichinichi', 'nichi'], 4: ['gakusei'] });
    });

    it('never unlocks a word with a kanji outside the order, no kanji, or learned in kana', () => {
        const frequency: FrequencyIndex = [
            { id: 'umi', containedKanji: ['海'] },
            { id: 'gakkai', containedKanji: ['学', '会'] },
            { id: 'koohii', containedKanji: [] },
            { id: 'koko', containedKanji: [], usuallyKana: true },
        ];
        expect(kanjiStepIndex(frequency, ORDER)).toEqual({});
    });
});
