import { describe, it, expect } from 'vitest';
import { matchAnswer, matchBest } from './answerMatching';

describe('matchAnswer kanji-skeleton rule', () => {
    it('accepts a dropped okurigana tail as a minor error', () => {
        expect(matchAnswer('六', '六つ')).toBe('minor_error');
        expect(matchAnswer('食', '食べる')).toBe('minor_error');
        expect(matchAnswer('食べ', '食べる')).toBe('minor_error');
    });

    it('never grades two different kanji as a typo', () => {
        // Distance 1, and the reason written forms must not use the plain
        // distance test: 会社 and 会話 are different words. This path is shared
        // with the grammar quiz's blanks, which accepted this before.
        expect(matchAnswer('会社', '会話')).toBe('wrong');
        expect(matchAnswer('六', '六月')).toBe('wrong');
        // 々 belongs to the skeleton, so it is not an omittable tail.
        expect(matchAnswer('日', '日々')).toBe('wrong');
    });

    it('is a prefix test, so a swapped okurigana kana stays wrong', () => {
        // Exactly why this is not a distance test: these differ by one kana
        // of okurigana and are genuinely different words.
        expect(matchAnswer('上げる', '上がる')).toBe('wrong');
        expect(matchAnswer('始める', '始まる')).toBe('wrong');
        expect(matchAnswer('必ぜ', '必ず')).toBe('wrong');
    });

    it('leaves the kana-only path untouched', () => {
        expect(matchAnswer('こーたえ', 'こたえ')).toBe('minor_error');
        expect(matchAnswer('こた', 'こたえ')).toBe('wrong');
        expect(matchAnswer('こえ', 'こたえ')).toBe('wrong');
    });
});

describe('matchAnswer counts typos in romaji keystrokes, not kana', () => {
    it('accepts a one-key slip on a short word (tsuma for tsumu)', () => {
        expect(matchAnswer('つま', 'つむ')).toBe('minor_error');
        expect(matchAnswer('すむ', 'つむ')).toBe('minor_error'); // sumu / tsumu
    });

    it('rejects a different mora that is several keys away (yamu for tsumu)', () => {
        // One kana apart, which used to make やむ a "typo" of つむ and let a wrong
        // answer match the near-synonym 止む (reported from production).
        expect(matchAnswer('やむ', 'つむ')).toBe('wrong');
        expect(matchAnswer('つむ', 'やむ')).toBe('wrong');
        expect(matchAnswer('はな', 'みな')).toBe('wrong'); // hana / mina
    });

    it('keeps the documented kana typos one key apart', () => {
        expect(matchAnswer('こたへ', 'こたえ')).toBe('minor_error');
        expect(matchAnswer('こたぇ', 'こたえ')).toBe('minor_error');
        expect(matchAnswer('こたええ', 'こたえ')).toBe('minor_error');
        expect(matchAnswer('たべろ', 'たべる')).toBe('minor_error');
    });

    it('treats katakana like hiragana', () => {
        expect(matchAnswer('テレビー', 'テレビ')).toBe('minor_error');
        expect(matchAnswer('ヤム', 'ツム')).toBe('wrong');
    });
});

describe('matchAnswer: an answer missing a kana', () => {
    it('stays wrong on a short word, where it is usually a different word', () => {
        expect(matchAnswer('おばさん', 'おばあさん')).toBe('wrong');
        expect(matchAnswer('ゆき', 'ゆうき')).toBe('wrong');
        expect(matchAnswer('きて', 'きって')).toBe('wrong');
    });

    it('is a typo in a long word (reported: ひつようじゃなかた)', () => {
        expect(matchAnswer('ひつようじゃなかた', 'ひつようじゃなかった')).toBe('minor_error');
        expect(matchAnswer('しんかんせ', 'しんかんせん')).toBe('minor_error');
    });

    it('still needs the answer to be one key away', () => {
        expect(matchAnswer('ひつようじゃない', 'ひつようじゃなかった')).toBe('wrong');
    });
});

describe('matchAnswer leniency', () => {
    it('lets the lenient level accept a dropped kana from a shorter answer', () => {
        expect(matchAnswer('たべな', 'たべない')).toBe('wrong');
        expect(matchAnswer('たべな', 'たべない', 'lenient')).toBe('minor_error');
    });

    it('lets the lenient level accept two slips in a long answer', () => {
        expect(matchAnswer('ひつよじゃなかた', 'ひつようじゃなかった')).toBe('wrong');
        expect(matchAnswer('ひつよじゃなかた', 'ひつようじゃなかった', 'lenient')).toBe('minor_error');
    });

    it('never makes kanji fuzzy', () => {
        expect(matchAnswer('会社', '会話', 'lenient')).toBe('wrong');
        expect(matchAnswer('上げる', '上がる', 'lenient')).toBe('wrong');
    });

    it('keeps a short answer strict', () => {
        expect(matchAnswer('きて', 'きって', 'lenient')).toBe('wrong');
        expect(matchAnswer('やむ', 'つむ', 'lenient')).toBe('wrong');
    });
});

describe('matchAnswer on English answers', () => {
    it('ignores case, punctuation and a leading "to" / article', () => {
        expect(matchAnswer('To Eat!', 'to eat')).toBe('correct');
        expect(matchAnswer('the cat', 'cat')).toBe('correct');
    });

    it('scales the typo budget with the length of the answer', () => {
        expect(matchAnswer('ab', 'an')).toBe('wrong');
        expect(matchAnswer('cst', 'cat')).toBe('minor_error');
        expect(matchAnswer('consmue', 'consume')).toBe('minor_error');
    });

    it('accepts a partial answer as a minor error', () => {
        expect(matchAnswer('pain', 'painful')).toBe('minor_error');
        expect(matchAnswer('able', 'uncomfortable')).toBe('wrong');
    });

    it('never matches a form that normalizes to nothing', () => {
        expect(matchAnswer('cat', '(note)')).toBe('wrong');
    });
});

describe('matchBest', () => {
    it('prefers a correct form over a typo of an earlier one', () => {
        expect(matchBest('man', ['main', 'man'])).toEqual({ result: 'correct', matchedAnswer: 'man' });
    });

    it('returns the first form a typo matches, else the first form', () => {
        expect(matchBest('mein', ['main', 'alt'])).toEqual({ result: 'minor_error', matchedAnswer: 'main' });
        expect(matchBest('zzzz', ['main', 'alt'])).toEqual({ result: 'wrong', matchedAnswer: 'main' });
    });

    it('short-circuits on pass', () => {
        expect(matchBest('pass', ['main', 'alt'])).toEqual({ result: 'pass', matchedAnswer: 'main' });
    });
});
