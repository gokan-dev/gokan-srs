import { describe, it, expect } from 'vitest';
import { segmentSentence } from './sentenceSegments';
import type { Sentence } from '@gokan/dataset-schema';

function sentence(original: string, matches: Sentence['matches']): Sentence {
    return { id: 's1', original, en: [], vocabIds: Object.keys(matches ?? {}), matches };
}

/** The invariant that matters most: rendering the segments must reproduce the sentence. */
function rejoin(segments: { text: string }[]): string {
    return segments.map(s => s.text).join('');
}

describe('segmentSentence', () => {
    it('splits text around a single match', () => {
        const s = sentence('私は本を読む', { '1': [{ start: 2, length: 1 }] });
        const segments = segmentSentence(s);
        expect(segments.map(x => [x.text, x.vocabId])).toEqual([
            ['私は', null],
            ['本', '1'],
            ['を読む', null],
        ]);
        expect(rejoin(segments)).toBe(s.original);
    });

    it('handles multiple vocab in one sentence, ordered by position', () => {
        const s = sentence('私は本を読む', {
            '2': [{ start: 4, length: 2 }],
            '1': [{ start: 2, length: 1 }],
        });
        const segments = segmentSentence(s);
        expect(segments.filter(x => x.vocabId).map(x => x.text)).toEqual(['本', '読む']);
        expect(rejoin(segments)).toBe(s.original);
    });

    it('marks the target vocab so it can be emphasised instead of self-linked', () => {
        const s = sentence('私は本を読む', { '1': [{ start: 2, length: 1 }] });
        expect(segmentSentence(s, '1').find(x => x.vocabId === '1')?.isTarget).toBe(true);
        expect(segmentSentence(s, '9').find(x => x.vocabId === '1')?.isTarget).toBe(false);
    });

    it('skips a match overlapping one already emitted, keeping the text intact', () => {
        const s = sentence('私は本を読む', {
            '1': [{ start: 2, length: 2 }],
            '2': [{ start: 3, length: 2 }],
        });
        const segments = segmentSentence(s);
        expect(segments.filter(x => x.vocabId).map(x => x.vocabId)).toEqual(['1']);
        expect(rejoin(segments)).toBe(s.original);
    });

    it('prefers the longer match when two start at the same offset', () => {
        const s = sentence('読み書きする', {
            '1': [{ start: 0, length: 2 }],
            '2': [{ start: 0, length: 4 }],
        });
        const segments = segmentSentence(s);
        expect(segments[0]).toMatchObject({ text: '読み書き', vocabId: '2' });
        expect(rejoin(segments)).toBe(s.original);
    });

    it('drops out-of-range offsets rather than truncating the sentence', () => {
        const s = sentence('短い文', {
            '1': [{ start: 1, length: 99 }],
            '2': [{ start: -1, length: 2 }],
            '3': [{ start: 0, length: 0 }],
        });
        const segments = segmentSentence(s);
        expect(segments).toEqual([{ text: '短い文', vocabId: null, isTarget: false }]);
    });

    it('returns one plain segment when the sentence has no matches at all', () => {
        expect(segmentSentence(sentence('матches なし', undefined))).toEqual([
            { text: 'матches なし', vocabId: null, isTarget: false },
        ]);
    });
});
