import { describe, it, expect } from 'vitest';
import { generateInflections, isFormOfWord, kanaOfSurface, toInflectableWord, wordClassesOf } from './inflection.utils';
import type { InflectableWord } from './inflection.utils';

const sensesOf = (...tags: string[][]) => tags.map(pos => ({ pos, glosses: [], misc: [] })) as never;

const word = (written: string, reading: string, ...pos: string[]): InflectableWord =>
    toInflectableWord({
        writtenForm: { kanji: written, alternatives: [], containedKanji: [] },
        reading: { primary: reading, alternatives: [] },
        senses: sensesOf(pos),
    } as never);

const formsOf = (w: InflectableWord) => {
    const all = generateInflections(w);
    return new Set([...all.map(f => f.written), ...all.map(f => f.kana)]);
};

const TABERU = word('食べる', 'たべる', 'v1', 'vt');
const KAKU = word('書く', 'かく', 'v5k', 'vt');
const IKU = word('行く', 'いく', 'v5k-s', 'vi');
const KURU = word('来る', 'くる', 'vk', 'vi');
const SURU = word('する', 'する', 'vs-i');
const BENKYOU = word('勉強', 'べんきょう', 'n', 'vs');
const HAYAI = word('早い', 'はやい', 'adj-i');
const II = word('いい', 'いい', 'adj-ix');
const TAIHEN = word('大変', 'たいへん', 'adj-na', 'n');
const ARU = word('有る', 'ある', 'v5r-i', 'vi');
const AGARU = word('上がる', 'あがる', 'v5r', 'vi');
const KAIWA = word('会話', 'かいわ', 'n');

describe('wordClassesOf', () => {
    it('reads the inflection class from JMdict POS tags', () => {
        expect(wordClassesOf({ senses: sensesOf(['v1', 'vt']) })).toEqual(['ichidan']);
        expect(wordClassesOf({ senses: sensesOf(['v5k', 'vt']) })).toEqual(['godan']);
        expect(wordClassesOf({ senses: sensesOf(['v5k-s', 'vi']) })).toEqual(['godan-iku']);
        expect(wordClassesOf({ senses: sensesOf(['vk', 'vi']) })).toEqual(['kuru']);
        expect(wordClassesOf({ senses: sensesOf(['vs-i']) })).toEqual(['suru']);
        expect(wordClassesOf({ senses: sensesOf(['n', 'vs']) })).toEqual(['suru-noun']);
        expect(wordClassesOf({ senses: sensesOf(['adj-i']) })).toEqual(['i-adj']);
        expect(wordClassesOf({ senses: sensesOf(['adj-ix']) })).toEqual(['ii']);
        expect(wordClassesOf({ senses: sensesOf(['adv'], ['adj-na', 'n']) })).toEqual(['na-adj']);
    });

    it('collects every class a word declares, and none for a plain noun', () => {
        expect(wordClassesOf({ senses: sensesOf(['adj-na', 'n', 'vs']) }).sort()).toEqual(['na-adj', 'suru-noun']);
        expect(wordClassesOf({ senses: sensesOf(['n']) })).toEqual([]);
        expect(wordClassesOf({})).toEqual([]);
    });
});

describe('generateInflections', () => {
    it('produces ichidan forms, including derived verbs one level deep', () => {
        const f = formsOf(TABERU);
        for (const form of ['食べる', '食べた', '食べて', '食べない', '食べます', '食べたら', '食べれば', '食べよう', '食べられる', '食べさせられた', 'たべさせられた', '食べちゃった', '食べている']) {
            expect(f.has(form), form).toBe(true);
        }
    });

    it('applies every godan sound change', () => {
        const cases: Array<[InflectableWord, string[]]> = [
            [KAKU, ['書いて', '書いた', '書かない', '書きます', '書ける', '書かれる', '書かせる', '書こう', '書けば', '書かされる']],
            [word('泳ぐ', 'およぐ', 'v5g'), ['泳いで', '泳いだ']],
            [word('話す', 'はなす', 'v5s'), ['話して', '話した', '話させられる']],
            [word('待つ', 'まつ', 'v5t'), ['待って', '待った']],
            [word('死ぬ', 'しぬ', 'v5n'), ['死んで', '死んだ']],
            [word('読む', 'よむ', 'v5m'), ['読んで', '読んだ', '読んじゃった']],
            [word('遊ぶ', 'あそぶ', 'v5b'), ['遊んで', '遊んだ']],
            [word('帰る', 'かえる', 'v5r'), ['帰って', '帰った', '帰らない']],
            [word('買う', 'かう', 'v5u'), ['買って', '買わない', '買います']],
        ];
        for (const [w, expected] of cases) {
            const f = formsOf(w);
            for (const form of expected) expect(f.has(form), form).toBe(true);
        }
        // 話す has no shortened causative-passive: 話さされる is not a word.
        expect(formsOf(word('話す', 'はなす', 'v5s')).has('話さされる')).toBe(false);
    });

    it('handles 行く, ある, 来る and する irregulars', () => {
        expect(formsOf(IKU).has('行って')).toBe(true);
        expect(formsOf(IKU).has('行いて')).toBe(false);
        expect(formsOf(ARU).has('ない')).toBe(true);
        expect(formsOf(ARU).has('有らない')).toBe(false);

        const kuru = generateInflections(KURU);
        expect(kuru).toContainEqual({ written: '来ない', kana: 'こない' });
        expect(kuru).toContainEqual({ written: '来て', kana: 'きて' });
        expect(kuru).toContainEqual({ written: '来れば', kana: 'くれば' });

        const suru = formsOf(SURU);
        for (const form of ['した', 'して', 'しない', 'します', 'させる', 'される', 'できる']) expect(suru.has(form), form).toBe(true);
        expect(formsOf(BENKYOU).has('勉強した')).toBe(true);
        expect(formsOf(BENKYOU).has('べんきょうします')).toBe(true);
    });

    it('produces adjective forms', () => {
        const hayai = formsOf(HAYAI);
        for (const form of ['早く', '早かった', '早くない', '早かろ', 'はやかろ', '早ければ']) expect(hayai.has(form), form).toBe(true);
        expect(formsOf(II).has('よくない')).toBe(true);
        expect(formsOf(II).has('よかった')).toBe(true);
        const taihen = formsOf(TAIHEN);
        for (const form of ['大変じゃなくて', 'たいへんじゃなくて', '大変な', '大変だった', '大変ではありません']) expect(taihen.has(form), form).toBe(true);
    });

    it('yields nothing for a word that does not inflect', () => {
        expect(generateInflections(KAIWA)).toEqual([]);
    });
});

describe('kanaOfSurface', () => {
    it('gives the kana of a conjugated surface', () => {
        expect(kanaOfSurface('食べたら', TABERU)).toBe('たべたら');
        expect(kanaOfSurface('早かろ', HAYAI)).toBe('はやかろ');
        expect(kanaOfSurface('来なかった', KURU)).toBe('こなかった');
    });

    it('is null for a surface the generator does not produce', () => {
        expect(kanaOfSurface('食べ物', TABERU)).toBeNull();
    });
});

describe('isFormOfWord', () => {
    it('accepts any form, in kanji or kana', () => {
        expect(isFormOfWord('食べた', TABERU)).toBe(true);
        expect(isFormOfWord('たべたら', TABERU)).toBe(true);
        expect(isFormOfWord('食べる', TABERU)).toBe(true);
        expect(isFormOfWord(' 食べて ', TABERU)).toBe(true);
    });

    it('falls back to the kanji stem for forms the tables do not list', () => {
        expect(isFormOfWord('食べさせられなかったら', TABERU)).toBe(true);
    });

    it('rejects a different word, even one sharing kanji or kana', () => {
        expect(isFormOfWord('上げる', AGARU)).toBe(false);
        expect(isFormOfWord('会社', KAIWA)).toBe(false);
        expect(isFormOfWord('たかい', TABERU)).toBe(false);
        expect(isFormOfWord('食べ物', TABERU)).toBe(false);
    });

    it('does not count a bare stem as a form', () => {
        expect(isFormOfWord('書', KAKU)).toBe(false);
        expect(isFormOfWord('', KAKU)).toBe(false);
    });
});
