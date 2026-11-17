import { describe, it, expect } from 'vitest';
import type { FrequencyIndex } from './indexes';
import { kanjiStepIndex, orderPositions, unlockStep } from './kanjiSteps';

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

describe('unlockStep', () => {
    const positions = orderPositions(ORDER);

    it('is the step of the word\'s last kanji in the order', () => {
        expect(unlockStep({ containedKanji: ['学', '生'] }, positions)).toBe(4);
        expect(unlockStep({ containedKanji: ['日', '一'] }, positions)).toBe(2);
    });

    it('is none for a kanji outside the order, no kanji, or a word learned in kana', () => {
        expect(unlockStep({ containedKanji: ['学', '会'] }, positions)).toBeUndefined();
        expect(unlockStep({ containedKanji: [] }, positions)).toBeUndefined();
        expect(unlockStep({ containedKanji: ['日'], usuallyKana: true }, positions)).toBeUndefined();
    });
});
