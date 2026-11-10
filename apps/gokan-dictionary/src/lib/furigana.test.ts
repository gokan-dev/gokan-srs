import { describe, expect, it } from 'vitest';
import { sentenceRuns } from './furigana';
import { sentence } from '../test/fixtures';

describe('sentenceRuns', () => {
    it('links each word with its furigana, and emphasises the page\'s own word without a link', () => {
        expect(sentenceRuns(sentence(), { targetVocabId: '1589350' })).toEqual([
            { parts: [{ text: '私', ruby: 'わたし' }], vocabId: '1311110', emphasized: false },
            { parts: [{ text: 'はそう' }], emphasized: false },
            { parts: [{ text: '思', ruby: 'おも' }, { text: 'う' }], emphasized: true },
            { parts: [{ text: '。' }], emphasized: false },
        ]);
    });

    it('emphasises a highlighted range, keeping its link', () => {
        const runs = sentenceRuns(sentence(), { highlightRanges: [{ start: 4, length: 2 }] });
        expect(runs[2]).toEqual({ parts: [{ text: '思', ruby: 'おも' }, { text: 'う' }], vocabId: '1589350', emphasized: true });
    });

    it('keeps the furigana of a word with no page, without its link', () => {
        expect(sentenceRuns(sentence(), { unlinked: new Set(['1311110']) })[0]).toEqual({ parts: [{ text: '私', ruby: 'わたし' }], emphasized: false });
    });
});
