import { describe, it, expect } from 'vitest';
import { grammarExampleToSentence, patternHighlightRanges } from './grammarSentence.utils';
import type { GrammarExample } from '../models/grammar.model';

function makeExample(overrides: Partial<GrammarExample> = {}): GrammarExample {
    return {
        jp: '彼は仕事をするかたわら、大学に通っている。',
        romaji: 'kare wa shigoto o suru katawara, daigaku ni kayotteiru.',
        en: 'While working, he also attends university.',
        words: [
            { surface: '彼', vocabId: 'v-kare', reading: 'かれ' },
            { surface: 'は', vocabId: null },
            { surface: '仕事', vocabId: 'v-shigoto', reading: 'しごと' },
            { surface: 'をするかたわら、大学に', vocabId: null },
            { surface: '通っている', vocabId: 'v-kayou', reading: 'かよっている', baseForm: '通う' },
            { surface: '。', vocabId: null },
        ],
        patternWordIndices: [],
        ...overrides,
    };
}

describe('grammarExampleToSentence', () => {
    it('carries the Japanese text and English translation over unchanged', () => {
        const example = makeExample();
        const sentence = grammarExampleToSentence(example, 0);
        expect(sentence.original).toBe(example.jp);
        expect(sentence.en).toEqual([{ id: 'grammar-example-0-en', text: example.en }]);
    });

    it('derives each matched word\'s start offset from cumulative surface length, not a hand-tracked index', () => {
        const example = makeExample();
        const sentence = grammarExampleToSentence(example, 0);

        expect(sentence.matches?.['v-kare']).toEqual([{ start: 0, length: 1, reading: 'かれ' }]);
        expect(sentence.matches?.['v-shigoto']).toEqual([{ start: 2, length: 2, reading: 'しごと' }]);
        // "通っている" starts after "彼は仕事をするかたわら、大学に" (15 chars in).
        expect(sentence.matches?.['v-kayou']).toEqual([{ start: 15, length: 5, reading: 'かよっている' }]);
    });

    it('omits particle/unresolved words (vocabId null) from matches and vocabIds', () => {
        const example = makeExample();
        const sentence = grammarExampleToSentence(example, 0);

        expect(sentence.matches?.['は']).toBeUndefined();
        expect(sentence.vocabIds).toEqual(['v-kare', 'v-shigoto', 'v-kayou']);
    });

    it('accumulates multiple occurrences of the same vocabId into one match list', () => {
        const example = makeExample({
            jp: '早い早い',
            words: [
                { surface: '早い', vocabId: 'v-hayai', reading: 'はやい' },
                { surface: '早い', vocabId: 'v-hayai', reading: 'はやい' },
            ],
        });
        const sentence = grammarExampleToSentence(example, 0);

        expect(sentence.matches?.['v-hayai']).toEqual([
            { start: 0, length: 2, reading: 'はやい' },
            { start: 2, length: 2, reading: 'はやい' },
        ]);
    });

    it('produces a stable, index-scoped id so multiple examples on the same page never collide', () => {
        const sentence = grammarExampleToSentence(makeExample(), 3);
        expect(sentence.id).toBe('grammar-example-3');
    });
});

describe('patternHighlightRanges', () => {
    it('derives correct offsets from cumulative surface lengths', () => {
        const example = makeExample({ patternWordIndices: [3] });
        // words[3] is "をするかたわら、大学に", starting after "彼は仕事" (1+1+2 = 4 chars).
        expect(patternHighlightRanges(example)).toEqual([{ start: 4, length: 11 }]);
    });

    it('merges adjacent pattern words into one contiguous range', () => {
        const example = makeExample({ patternWordIndices: [0, 1] });
        // words[0] "彼" (1 char) immediately followed by words[1] "は" (1 char).
        expect(patternHighlightRanges(example)).toEqual([{ start: 0, length: 2 }]);
    });

    it('keeps non-adjacent pattern words as separate ranges', () => {
        const example = makeExample({ patternWordIndices: [1, 4] });
        // words[1] "は" at offset 1 (length 1); words[4] "通っている" at offset 15 (length 5).
        expect(patternHighlightRanges(example)).toEqual([
            { start: 1, length: 1 },
            { start: 15, length: 5 },
        ]);
    });

    it('returns an empty array when patternWordIndices is empty', () => {
        const example = makeExample({ patternWordIndices: [] });
        expect(patternHighlightRanges(example)).toEqual([]);
    });

    it('reproduces the pattern text exactly when ranges are sliced back out of jp', () => {
        const example = makeExample({ patternWordIndices: [2, 3] });
        const ranges = patternHighlightRanges(example);
        const sliced = ranges.map(r => example.jp.slice(r.start, r.start + r.length)).join('');
        expect(sliced).toBe('仕事をするかたわら、大学に');
    });
});
