import { describe, it, expect } from 'vitest';
import { segmentInteractiveSentence } from './interactiveSentence.utils';
import type { Sentence } from '@gokan/dataset-schema';

function makeSentence(overrides: Partial<Sentence> = {}): Sentence {
    return {
        id: 's-1',
        original: '彼は仕事をするかたわら、大学に通っている。',
        en: [{ id: 's-1-en', text: 'While working, he also attends university.' }],
        vocabIds: ['v-kare', 'v-shigoto', 'v-kayou'],
        matches: {
            'v-kare': [{ start: 0, length: 1, reading: 'かれ' }],
            'v-shigoto': [{ start: 2, length: 2, reading: 'しごと' }],
            'v-kayou': [{ start: 15, length: 5, reading: 'かよっている' }],
        },
        ...overrides,
    };
}

function rejoin(segments: { content: string }[]): string {
    return segments.map(s => s.content).join('');
}

describe('segmentInteractiveSentence', () => {
    it('flags the target vocab match as isTarget even with no click handler involved (issue #89)', () => {
        const sentence = makeSentence();
        const segments = segmentInteractiveSentence(sentence, { targetVocabId: 'v-shigoto' });

        const target = segments.find(s => s.vocabId === 'v-shigoto');
        expect(target?.isTarget).toBe(true);
        expect(target?.content).toBe('仕事');

        for (const seg of segments) {
            if (seg.vocabId !== 'v-shigoto') expect(seg.isTarget).toBe(false);
        }
    });

    it('never flags isTarget when no targetVocabId is given', () => {
        const sentence = makeSentence();
        const segments = segmentInteractiveSentence(sentence);
        expect(segments.every(s => !s.isTarget)).toBe(true);
    });

    it('reproduces the original text exactly regardless of targeting', () => {
        const sentence = makeSentence();
        const segments = segmentInteractiveSentence(sentence, { targetVocabId: 'v-kayou' });
        expect(rejoin(segments)).toBe(sentence.original);
    });

    it('splits a highlight range over unmatched (particle) text into its own flagged sub-segment', () => {
        const sentence = makeSentence();
        // "は" sits at offset 1, length 1 - unmatched plain text between the two vocab matches.
        const segments = segmentInteractiveSentence(sentence, { highlightRanges: [{ start: 1, length: 1 }] });

        const highlighted = segments.filter(s => s.isHighlighted);
        expect(highlighted).toHaveLength(1);
        expect(highlighted[0]).toMatchObject({ type: 'text', content: 'は', start: 1, end: 2 });
        expect(rejoin(segments)).toBe(sentence.original);
    });

    it('flags a vocab match highlighted (as a whole, unsplit segment) when a range covers only part of it', () => {
        const sentence = makeSentence();
        // "仕事" spans [2, 4); a range covering only its first character must not split the match.
        const segments = segmentInteractiveSentence(sentence, { highlightRanges: [{ start: 2, length: 1 }] });

        const match = segments.find(s => s.vocabId === 'v-shigoto');
        expect(match).toMatchObject({ type: 'match', content: '仕事', isHighlighted: true });
        // Still exactly one segment for this match - not split into two.
        expect(segments.filter(s => s.start >= 2 && s.end <= 4)).toHaveLength(1);
        expect(rejoin(segments)).toBe(sentence.original);
    });

    it('flags a vocab match highlighted when a range covers it exactly', () => {
        const sentence = makeSentence();
        const segments = segmentInteractiveSentence(sentence, { highlightRanges: [{ start: 2, length: 2 }] });

        const match = segments.find(s => s.vocabId === 'v-shigoto');
        expect(match).toMatchObject({ isHighlighted: true });
        expect(rejoin(segments)).toBe(sentence.original);
    });

    it('does not highlight a match a range does not touch', () => {
        const sentence = makeSentence();
        const segments = segmentInteractiveSentence(sentence, { highlightRanges: [{ start: 1, length: 1 }] });

        const kare = segments.find(s => s.vocabId === 'v-kare');
        const kayou = segments.find(s => s.vocabId === 'v-kayou');
        expect(kare?.isHighlighted).toBe(false);
        expect(kayou?.isHighlighted).toBe(false);
    });

    it('splits surrounding plain text on both sides of a mid-segment highlight range', () => {
        const sentence = makeSentence({
            original: 'ABCDE',
            matches: {},
            vocabIds: [],
        });
        const segments = segmentInteractiveSentence(sentence, { highlightRanges: [{ start: 1, length: 2 }] });

        expect(segments.map(s => ({ content: s.content, isHighlighted: s.isHighlighted }))).toEqual([
            { content: 'A', isHighlighted: false },
            { content: 'BC', isHighlighted: true },
            { content: 'DE', isHighlighted: false },
        ]);
        expect(rejoin(segments)).toBe('ABCDE');
    });

    it('keeps the earliest-start-wins overlap rule for overlapping vocab matches', () => {
        const sentence = makeSentence({
            original: '大学生',
            matches: {
                'v-daigaku': [{ start: 0, length: 2 }],
                'v-gakusei': [{ start: 1, length: 2 }],
            },
            vocabIds: ['v-daigaku', 'v-gakusei'],
        });
        const segments = segmentInteractiveSentence(sentence);

        expect(segments.map(s => ({ type: s.type, content: s.content, vocabId: s.vocabId }))).toEqual([
            { type: 'match', content: '大学', vocabId: 'v-daigaku' },
            { type: 'text', content: '生', vocabId: undefined },
        ]);
    });

    it('drops empty or out-of-range highlight ranges without affecting other segments', () => {
        const sentence = makeSentence({ original: 'ABCDE', matches: {}, vocabIds: [] });
        const segments = segmentInteractiveSentence(sentence, {
            highlightRanges: [{ start: 3, length: 0 }, { start: 10, length: 5 }],
        });

        expect(segments.every(s => !s.isHighlighted)).toBe(true);
        expect(rejoin(segments)).toBe('ABCDE');
    });
});
