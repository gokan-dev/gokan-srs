import { describe, expect, it } from 'vitest';
import { rubyParts, sentenceRuns } from './furigana';
import { sentence } from '../test/fixtures';

describe('rubyParts', () => {
    it('puts the reading over the kanji only', () => {
        expect(rubyParts('食べる', 'たべる')).toEqual([{ text: '食', ruby: 'た' }, { text: 'べる' }]);
        expect(rubyParts('お茶', 'おちゃ')).toEqual([{ text: 'お' }, { text: '茶', ruby: 'ちゃ' }]);
    });

    it('gives each run of kanji its own part of the reading', () => {
        expect(rubyParts('引き出し', 'ひきだし')).toEqual([
            { text: '引', ruby: 'ひ' }, { text: 'き' }, { text: '出', ruby: 'だ' }, { text: 'し' },
        ]);
        expect(rubyParts('日本', 'にほん')).toEqual([{ text: '日本', ruby: 'にほん' }]);
    });

    it('reads a katakana reading as hiragana', () => {
        expect(rubyParts('食べる', 'タベル')).toEqual([{ text: '食', ruby: 'た' }, { text: 'べる' }]);
    });

    it('falls back to the whole reading over the whole word when the kana do not match', () => {
        expect(rubyParts('食べ', 'たべる')).toEqual([{ text: '食べ', ruby: 'たべる' }]);
    });

    it('adds nothing to kana or to a word without a reading', () => {
        expect(rubyParts('ここ', 'ここ')).toEqual([{ text: 'ここ' }]);
        expect(rubyParts('私', undefined)).toEqual([{ text: '私' }]);
    });
});

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
});
