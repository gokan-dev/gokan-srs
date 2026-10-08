import { describe, it, expect } from 'vitest';
import { generateInflections, inferredWord, isFormOfWord, kanaOfSurface, readingMatchesWord, toInflectableWord, wordClassesOf } from './inflection.utils';
import type { InflectableWord } from './inflection.utils';
import type { Sense } from '@gokan/dataset-schema';

const sensesOf = (...tags: string[][]): Sense[] => tags.map(pos => ({ pos, glosses: [], misc: { rawTags: [] }, related: { compounds: [] } }));

const word = (written: string, reading: string, ...pos: string[]): InflectableWord =>
    toInflectableWord({
        writtenForm: { kanji: written, alternatives: [], containedKanji: [] },
        reading: { primary: reading, alternatives: [] },
        senses: sensesOf(pos),
    });

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

describe('readingMatchesWord', () => {
    // The two differently-read entries that share the written form 遊ぶ:
    // 遊ぶ (あそぶ, "play") and the rare 荒ぶ (すさぶ, "grow wild").
    const ASOBU = word('遊ぶ', 'あそぶ', 'v5b', 'vi');
    const SUSABU = toInflectableWord({
        writtenForm: { kanji: '荒ぶ', alternatives: ['進ぶ', '遊ぶ'], containedKanji: [] },
        reading: { primary: 'すさぶ', alternatives: [] },
        senses: sensesOf(['v5b', 'vi']),
    });

    it('accepts an inflected reading that keeps the dictionary stem', () => {
        expect(readingMatchesWord('あそんでる', ASOBU)).toBe(true);     // 遊んでる
        expect(readingMatchesWord('あそびました', ASOBU)).toBe(true);
        expect(readingMatchesWord('すさんで', SUSABU)).toBe(true);      // 荒んで
    });

    it('rejects a reading that belongs to a differently-read homograph (the bug)', () => {
        // 遊んでる (あそぶ) must NOT read as the rare すさぶ entry.
        expect(readingMatchesWord('あそんでる', SUSABU)).toBe(false);
        // すすんでいた (進む/すすむ) must not attach to a すさぶ/すさむ entry, nor あそぶ.
        expect(readingMatchesWord('すすんでいた', SUSABU)).toBe(false);
        expect(readingMatchesWord('すさんで', ASOBU)).toBe(false);
    });

    it('tolerates trailing auxiliaries and particles the tables do not enumerate', () => {
        expect(readingMatchesWord('あそんでるよ', ASOBU)).toBe(true);
        const IERU = word('言える', 'いえる', 'v1', 'vi');
        expect(readingMatchesWord('いえるでしょう', IERU)).toBe(true);
        const WARUI = word('悪い', 'わるい', 'adj-i');
        expect(readingMatchesWord('わるいから', WARUI)).toBe(true);
    });

    it('requires an exact reading for a non-inflecting word', () => {
        const KARE = word('彼', 'かれ', 'n');     // "he"
        const ANO = word('彼の', 'あの', 'adj-pn'); // "that", also written 彼
        expect(readingMatchesWord('かれ', KARE)).toBe(true);
        expect(readingMatchesWord('かれ', ANO)).toBe(false);
    });

    it('normalizes katakana so a loanword hiragana reading matches its katakana reading', () => {
        const COFFEE = word('珈琲', 'コーヒー', 'n');
        expect(readingMatchesWord('こーひー', COFFEE)).toBe(true);
    });

    it('handles する / 来る irregular stems without rejecting a real form', () => {
        expect(readingMatchesWord('きて', KURU)).toBe(true);
        expect(readingMatchesWord('きた', KURU)).toBe(true);
        expect(readingMatchesWord('こない', KURU)).toBe(true);
        expect(readingMatchesWord('して', SURU)).toBe(true);
    });

    it('never excludes a match that carries no reading', () => {
        expect(readingMatchesWord('', SUSABU)).toBe(true);
    });
});

describe('inferredWord: how a token with no dictionary entry conjugates', () => {
    /** True when `form` is a form of the word read off `surface` (dictionary form `base`). */
    const formOf = (base: string, surface: string, form: string) => {
        const w = inferredWord(base, surface);
        return w !== null && isFormOfWord(form, w);
    };

    it('names the irregular verbs, and ある whose negative is ない', () => {
        expect(inferredWord('ある', 'あり')?.classes).toEqual(['godan-aru']);
        expect(formOf('ある', 'あり', 'ありません')).toBe(true);
        expect(formOf('ある', 'あり', 'ない')).toBe(true);
        expect(formOf('ある', 'あり', 'あらない')).toBe(false);
        expect(formOf('する', 'し', 'した')).toBe(true);
        expect(formOf('くる', 'き', 'こない')).toBe(true);
        expect(formOf('来る', '来', '来なかった')).toBe(true);
        expect(formOf('行く', '行っ', '行きます')).toBe(true);
        expect(formOf('なさる', 'なさい', 'なさいます')).toBe(true);
    });

    it('tells ichidan from godan by the stem the occurrence shows', () => {
        // The bare stem is ichidan; り, ら or っ after it is godan.
        expect(inferredWord('いける', 'いけ')?.classes).toEqual(['ichidan']);
        expect(inferredWord('いる', 'い')?.classes).toEqual(['ichidan']);
        expect(inferredWord('なる', 'なり')?.classes).toEqual(['godan']);
        expect(inferredWord('なる', 'なっ')?.classes).toEqual(['godan']);
        expect(formOf('なる', 'なり', 'なった')).toBe(true);
        expect(formOf('いける', 'いけ', 'いけません')).toBe(true);
        // れ and ろ fit both, as does a verb seen in its dictionary form.
        expect(inferredWord('いる', 'いれ')?.classes).toEqual(['ichidan', 'godan']);
        expect(inferredWord('なる', 'なる')?.classes).toEqual(['ichidan', 'godan']);
        expect(formOf('もつ', 'もっ', 'もちます')).toBe(true);
    });

    it('reads a conjugated い word as an adjective (the ない of なければ included), never a bare noun ending in い', () => {
        expect(formOf('ない', 'なけれ', 'なかった')).toBe(true);
        expect(formOf('たい', 'たく', 'たかった')).toBe(true);
        expect(inferredWord('くらい', 'くらい')).toBeNull();
    });

    it('conjugates the copula, which has no stem', () => {
        expect(formOf('だ', 'で', 'である')).toBe(true);
        expect(formOf('だ', 'で', 'じゃない')).toBe(true);
        expect(formOf('だ', 'な', 'である')).toBe(true); // the attributive な (静かなものだ) is the copula too
        expect(formOf('だ', 'で', 'ある')).toBe(false);
    });

    it('leaves alone what the generator does not conjugate', () => {
        for (const [base, surface] of [['ます', 'ませ'], ['た', 'た'], ['ぬ', 'ぬ'], ['べし', 'べき'], ['こと', 'こと']]) {
            expect(inferredWord(base, surface)).toBeNull();
        }
    });
});
