import { describe, it, expect } from 'vitest';
import { romajiToHiragana, looksLikeRomaji, kanaToRomaji, romajiReadingPrefixes, normalizeRomajiQuery, readRomajiQuery } from './romaji';

describe('romajiToHiragana', () => {
    it('converts basic syllables', () => {
        expect(romajiToHiragana('nichi')).toBe('にち');
        expect(romajiToHiragana('nihon')).toBe('にほん');
        expect(romajiToHiragana('watashi')).toBe('わたし');
        expect(romajiToHiragana('omou')).toBe('おもう');
    });

    it('handles syllabic n before consonants and at the end', () => {
        expect(romajiToHiragana('kanji')).toBe('かんじ');
        expect(romajiToHiragana('hon')).toBe('ほん');
        expect(romajiToHiragana('shinbun')).toBe('しんぶん');
        expect(romajiToHiragana("hon'ya")).toBe('ほんや'); // apostrophe disambiguates ん + や
    });

    it('handles double-n', () => {
        expect(romajiToHiragana('konnichi')).toBe('こんにち');
    });

    it('handles sokuon (doubled consonants)', () => {
        expect(romajiToHiragana('gakkou')).toBe('がっこう');
        expect(romajiToHiragana('kitte')).toBe('きって');
        expect(romajiToHiragana('matcha')).toBe('まっちゃ');
    });

    it('handles y-combos and alternate spellings', () => {
        expect(romajiToHiragana('kyou')).toBe('きょう');
        expect(romajiToHiragana('sha')).toBe('しゃ');
        expect(romajiToHiragana('sya')).toBe('しゃ'); // kunrei-shiki variant
        expect(romajiToHiragana('tsukau')).toBe('つかう');
        expect(romajiToHiragana('tukau')).toBe('つかう'); // kunrei variant
    });

    it('supports incremental matching for a leading full syllable', () => {
        // にち contains に, so a partial romaji query still narrows results.
        expect('にち'.includes(romajiToHiragana('ni'))).toBe(true);
    });

    it('passes through non-romaji characters untouched', () => {
        expect(romajiToHiragana('にち')).toBe('にち'); // already kana
        // English meaning words won't blow up (leftover letters pass through).
        expect(romajiToHiragana('think')).toContain('ん'); // 'n' -> ん; rest passes through harmlessly
    });
});

describe('romajiToHiragana: nn', () => {
    it('reads nn at the end or before a consonant as one ん', () => {
        expect(romajiToHiragana('kann')).toBe('かん');
        expect(romajiToHiragana('konn')).toBe('こん');
        expect(romajiToHiragana('kannji')).toBe('かんじ');
        expect(romajiToHiragana('konnna')).toBe('こんな');
    });

    it('reads nn before a vowel or y as ん and an n syllable', () => {
        expect(romajiToHiragana('konnichiha')).toBe('こんにちは');
        expect(romajiToHiragana('konnyaku')).toBe('こんにゃく');
    });
});

describe('romajiReadingPrefixes', () => {
    it('keeps a romaji made of complete syllables as converted', () => {
        expect(romajiReadingPrefixes('tabe')).toEqual(['たべ']);
        expect(romajiReadingPrefixes('taberu')).toEqual(['たべる']);
    });

    it('reads an unfinished syllable as every syllable it begins, and a single consonant also as っ', () => {
        expect(romajiReadingPrefixes('taber').sort()).toEqual(['たべら', 'たべり', 'たべる', 'たべれ', 'たべろ', 'たべりゃ', 'たべりゅ', 'たべりょ', 'たべっ'].sort());
        expect(romajiReadingPrefixes('tabet')).toEqual(expect.arrayContaining(['たべて', 'たべた', 'たべつ', 'たべち', 'たべっ']));
        expect(romajiReadingPrefixes('benky').sort()).toEqual(['べんきゃ', 'べんきゅ', 'べんきょ'].sort());
        expect(romajiReadingPrefixes('nihong')).toEqual(expect.arrayContaining(['にほんご', 'にほんが', 'にほんっ']));
        expect(romajiReadingPrefixes('chot')).toEqual(expect.arrayContaining(['ちょっ', 'ちょと']));
        expect(romajiReadingPrefixes('gakk')).toEqual(expect.arrayContaining(['がっこ', 'がっか']));
        expect(romajiReadingPrefixes('matc')).toEqual(expect.arrayContaining(['まっちゃ', 'まっち']));
    });

    it('reads a final n as ん or the start of an n syllable, and a final nn as one ん', () => {
        expect(romajiReadingPrefixes('kan').sort()).toEqual(['かん', 'かな', 'かに', 'かぬ', 'かね', 'かの', 'かにゃ', 'かにゅ', 'かにょ'].sort());
        expect(romajiReadingPrefixes('kann')).toEqual(['かん']);
        expect(romajiReadingPrefixes('kannj')).toEqual(expect.arrayContaining(['かんじゃ', 'かんじゅ', 'かんじょ', 'かんじ']));
        expect(romajiReadingPrefixes('kannj')).not.toContain('かんにゃ');
        expect(romajiReadingPrefixes('konny')).toEqual(expect.arrayContaining(['こんにゃ', 'こんにゅ', 'こんにょ']));
        expect(romajiReadingPrefixes('beny')).toEqual(expect.arrayContaining(['べにゃ', 'べんや']));
    });

    it('adds no っ after a っ, or for y or w, which never double', () => {
        for (const romaji of ['kakk', 'tt', 'matc']) {
            expect(romajiReadingPrefixes(romaji).filter(kana => kana.includes('っっ'))).toEqual([]);
        }
        expect(romajiReadingPrefixes('oy').sort()).toEqual(['おや', 'おゆ', 'およ'].sort());
        expect(romajiReadingPrefixes('ow')).not.toContain('おっ');
        expect(romajiReadingPrefixes('ny')).not.toContain('んっ');
    });

    it('is empty for a query that is not romaji', () => {
        expect(romajiReadingPrefixes('xyz')).toEqual([]);
        expect(romajiReadingPrefixes('to eat')).toEqual([]);
        expect(romajiReadingPrefixes('n5')).toEqual([]);
    });
});

describe('readRomajiQuery', () => {
    it('drops spaces', () => {
        expect(normalizeRomajiQuery('tabe ru')).toBe('taberu');
        expect(readRomajiQuery('tabe ru')?.kana).toBe('たべる');
    });

    it("keeps ' as the ん separator, and only there", () => {
        expect(readRomajiQuery("kan'i")?.kana).toBe('かんい');
        expect(readRomajiQuery("kani")?.kana).toBe('かに');
        expect(normalizeRomajiQuery("o'ka")).toBe('oka');
    });

    it('reads - as ー, as an IME types it', () => {
        expect(readRomajiQuery('ko-hi-')).toEqual({ kana: 'こーひー', prefixes: ['こーひー'] });
    });

    it('is null without a Latin letter', () => {
        expect(readRomajiQuery('食べる')).toBeNull();
    });
});

describe('looksLikeRomaji', () => {
    it('detects latin letters', () => {
        expect(looksLikeRomaji('nichi')).toBe(true);
        expect(looksLikeRomaji('にち')).toBe(false);
        expect(looksLikeRomaji('日')).toBe(false);
    });
});

describe('kanaToRomaji', () => {
    it('spells kana the way an IME is typed, Hepburn first', () => {
        expect(kanaToRomaji('つむ')).toBe('tsumu');
        expect(kanaToRomaji('しゃしん')).toBe('shashin');
        expect(kanaToRomaji('ちゃ')).toBe('cha');
        expect(kanaToRomaji('じゅう')).toBe('juu');
        expect(kanaToRomaji('ふじ')).toBe('fuji');
    });

    it('doubles the consonant after っ and keeps small kana and ー as keystrokes', () => {
        expect(kanaToRomaji('きって')).toBe('kitte');
        expect(kanaToRomaji('まっちゃ')).toBe('maccha');
        expect(kanaToRomaji('こたぇ')).toBe('kotaxe');
        expect(kanaToRomaji('こーひー')).toBe('ko-hi-');
    });

    it('reads katakana as hiragana and passes anything else through', () => {
        expect(kanaToRomaji('テレビ')).toBe('terebi');
        expect(kanaToRomaji('食べる')).toBe('食beru');
    });

    it('round-trips with romajiToHiragana on plain words', () => {
        for (const word of ['にほん', 'わたし', 'しゃしん', 'きって']) {
            expect(romajiToHiragana(kanaToRomaji(word))).toBe(word);
        }
    });
});
