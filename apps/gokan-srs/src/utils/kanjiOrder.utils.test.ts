import { describe, it, expect } from 'vitest';
import { nextKanjiStep } from './kanjiOrder.utils';

const ORDER = ['一', '日', '学', '生'];

describe('nextKanjiStep', () => {
    it('names the kanji the next step teaches, and nothing past the end', () => {
        expect(nextKanjiStep(ORDER, 0)).toEqual({ step: 1, kanjis: ['一'] });
        expect(nextKanjiStep(ORDER, 3)).toEqual({ step: 4, kanjis: ['生'] });
        expect(nextKanjiStep(ORDER, 4)).toBeNull();
    });
});
