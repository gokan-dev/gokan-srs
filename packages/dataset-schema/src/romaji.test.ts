import { describe, it, expect } from 'vitest';
import { romajiToHiragana, looksLikeRomaji, kanaToRomaji, kanaToHepburn, toHiragana, romajiReadingPrefixes, normalizeRomajiQuery, readRomajiQuery, convertRomajiInput, finishRomajiInput } from './romaji';

/** The field after typing `typed` at the end, one key at a time, as an input event would see it. */
function typeKeys(typed: string, start = ''): string {
    let text = start;
    for (const key of typed) text = convertRomajiInput(text + key, text.length + 1).text;
    return text;
}

describe('convertRomajiInput', () => {
    it('converts complete syllables and leaves an unfinished tail as typed', () => {
        expect(typeKeys('taberu')).toBe('たべる');
        expect(typeKeys('kak')).toBe('かk');
        expect(typeKeys('ky')).toBe('ky');
        expect(typeKeys('benkyou')).toBe('べんきょう');
    });

    it('keeps n until the next letter decides it', () => {
        expect(typeKeys('kan')).toBe('かn');
        expect(typeKeys('kana')).toBe('かな');
        expect(typeKeys('kanji')).toBe('かんじ');
        expect(typeKeys('hon')).toBe('ほn');
        expect(typeKeys('kony')).toBe('こny');
        expect(typeKeys('konyaku')).toBe('こにゃく');
    });

    it("reads nn and n' as ん", () => {
        expect(typeKeys('kann')).toBe('かん');
        expect(typeKeys("kan'i")).toBe('かんい');
        expect(typeKeys('kannnani')).toBe('かんなに');
        // A real IME's nn is ん at once, so a vowel after it is its own kana.
        expect(typeKeys('kannani')).toBe('かんあに');
        expect(typeKeys('konnnichiha')).toBe('こんにちは');
        expect(typeKeys('honnya')).toBe('ほんや');
    });

    it('reads a doubled consonant and tch as っ', () => {
        expect(typeKeys('kitte')).toBe('きって');
        expect(typeKeys('gakkou')).toBe('がっこう');
        expect(typeKeys('matcha')).toBe('まっちゃ');
        expect(typeKeys('kitt')).toBe('きっt');
    });

    it('types small kana with an x or l prefix', () => {
        expect(typeKeys('xtsu')).toBe('っ');
        expect(typeKeys('ltu')).toBe('っ');
        expect(typeKeys('xya')).toBe('ゃ');
        expect(typeKeys('lyo')).toBe('ょ');
        expect(typeKeys('fuxa')).toBe('ふぁ');
    });

    it('types loanword combos as an IME does', () => {
        expect(typeKeys('fa fi fe fo')).toBe('ふぁ ふぃ ふぇ ふぉ');
        expect(typeKeys('she che je')).toBe('しぇ ちぇ じぇ');
        expect(typeKeys('ti di thi dhi')).toBe('ち ぢ てぃ でぃ');
        expect(typeKeys('ye tsa')).toBe('いぇ つぁ');
        expect(typeKeys('fo-ku')).toBe('ふぉーく');
    });

    it('types - as ー', () => {
        expect(typeKeys('ko-hi-')).toBe('こーひー');
    });

    it('keeps the caret right after what was typed, and leaves the text after it alone', () => {
        // "たる", the caret after た, "be" typed there.
        expect(convertRomajiInput('たbる', 2)).toEqual({ text: 'たbる', caret: 2 });
        expect(convertRomajiInput('たbeる', 3)).toEqual({ text: 'たべる', caret: 2 });
        // Romaji after the caret is not this keystroke's: it waits.
        expect(convertRomajiInput('かka', 1)).toEqual({ text: 'かka', caret: 1 });
    });

    it('is idempotent, so Backspace removes one kana', () => {
        expect(convertRomajiInput('たべる', 3)).toEqual({ text: 'たべる', caret: 3 });
        // Backspace after べ of たべる: たる, the caret after た.
        expect(convertRomajiInput('たる', 1)).toEqual({ text: 'たる', caret: 1 });
        expect(convertRomajiInput('きっ', 2)).toEqual({ text: 'きっ', caret: 2 });
    });

    it('passes kana and kanji from a real IME through, in a mixed string', () => {
        expect(typeKeys('beru', '食')).toBe('食べる');
        expect(typeKeys('ga', 'ねこ')).toBe('ねこが');
        expect(convertRomajiInput('コーヒーnomu', 8)).toEqual({ text: 'コーヒーのむ', caret: 6 });
    });

    it('reads capitals as the same keys, and keeps a letter left as a letter as typed', () => {
        expect(typeKeys('Taberu')).toBe('たべる');
        expect(typeKeys('Tshatsu')).toBe('Tしゃつ');
        expect(typeKeys('KAK')).toBe('かK');
    });
});

describe('finishRomajiInput', () => {
    it('reads a final n as ん', () => {
        expect(finishRomajiInput('ほn')).toBe('ほん');
        expect(finishRomajiInput('hon')).toBe('ほん');
        expect(finishRomajiInput('nihon')).toBe('にほん');
    });

    it('converts all of the answer, wherever the caret was', () => {
        expect(finishRomajiInput('かka')).toBe('かか');
        expect(finishRomajiInput('たべる')).toBe('たべる');
    });

    it('leaves an unfinished syllable as typed', () => {
        expect(finishRomajiInput('かk')).toBe('かk');
    });
});

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
        expect(romajiReadingPrefixes('taber').sort()).toEqual(['たべら', 'たべり', 'たべる', 'たべれ', 'たべろ', 'たべりゃ', 'たべりゅ', 'たべりょ', 'たべりぇ', 'たべっ'].sort());
        expect(romajiReadingPrefixes('tabet')).toEqual(expect.arrayContaining(['たべて', 'たべた', 'たべつ', 'たべち', 'たべっ']));
        expect(romajiReadingPrefixes('benky').sort()).toEqual(['べんきゃ', 'べんきゅ', 'べんきょ', 'べんきぇ'].sort());
        expect(romajiReadingPrefixes('nihong')).toEqual(expect.arrayContaining(['にほんご', 'にほんが']));
        expect(romajiReadingPrefixes('chot')).toEqual(expect.arrayContaining(['ちょっ', 'ちょと']));
        expect(romajiReadingPrefixes('gakk')).toEqual(expect.arrayContaining(['がっこ', 'がっか']));
        expect(romajiReadingPrefixes('matc')).toEqual(expect.arrayContaining(['まっちゃ', 'まっち']));
    });

    it('reads a final n as ん or the start of an n syllable, and a final nn as one ん', () => {
        expect(romajiReadingPrefixes('kan').sort()).toEqual(['かん', 'かな', 'かに', 'かぬ', 'かね', 'かの', 'かにゃ', 'かにゅ', 'かにょ', 'かにぇ'].sort());
        expect(romajiReadingPrefixes('kann')).toEqual(['かん']);
        expect(romajiReadingPrefixes('kannj')).toEqual(expect.arrayContaining(['かんじゃ', 'かんじゅ', 'かんじょ', 'かんじ']));
        expect(romajiReadingPrefixes('kannj')).not.toContain('かんにゃ');
        expect(romajiReadingPrefixes('beny')).toEqual(expect.arrayContaining(['べにゃ', 'べんや']));
    });

    it('adds no っ after a っ, or for y or w, which never double', () => {
        for (const romaji of ['kakk', 'tt', 'matc']) {
            expect(romajiReadingPrefixes(romaji).filter(kana => kana.includes('っっ'))).toEqual([]);
        }
        expect(romajiReadingPrefixes('oy').sort()).toEqual(['おや', 'おゆ', 'およ', 'おいぇ'].sort());
        expect(romajiReadingPrefixes('ow')).not.toContain('おっ');
        expect(romajiReadingPrefixes('ny')).not.toContain('んっ');
    });

    it('adds no っ after a ん, which a doubled consonant cannot follow', () => {
        expect(romajiReadingPrefixes('kannj').sort()).toEqual(['かんじ', 'かんじゃ', 'かんじゅ', 'かんじょ', 'かんじぇ'].sort());
        expect(romajiReadingPrefixes('anp').sort()).toEqual(['あんぱ', 'あんぴ', 'あんぷ', 'あんぺ', 'あんぽ', 'あんぴゃ', 'あんぴゅ', 'あんぴょ', 'あんぴぇ'].sort());
        expect(romajiReadingPrefixes('nihong')).not.toContain('にほんっ');
    });

    it('reads an unfinished nny at the end as ん plus an unfinished n syllable', () => {
        expect(romajiReadingPrefixes('konny').sort()).toEqual(['こんにゃ', 'こんにゅ', 'こんにょ', 'こんにぇ'].sort());
        expect(romajiReadingPrefixes('senny').sort()).toEqual(['せんにゃ', 'せんにゅ', 'せんにょ', 'せんにぇ'].sort());
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

    it('spells ん as nn where a single n would join what follows, as an IME is typed', () => {
        expect(kanaToRomaji('かんい')).toBe('kanni');
        expect(kanaToRomaji('こんな')).toBe('konnna');
        expect(kanaToRomaji('ほんや')).toBe('honnya');
        expect(kanaToRomaji('かんじ')).toBe('kanji');
        expect(kanaToRomaji('ほん')).toBe('hon');
    });

    it('spells loanword combos as one syllable', () => {
        expect(kanaToRomaji('ふぁいる')).toBe('fairu');
        expect(kanaToRomaji('ぱーてぃー')).toBe('pa-thi-');
    });

    it('round-trips with romajiToHiragana on plain words', () => {
        for (const word of ['にほん', 'わたし', 'しゃしん', 'きって']) {
            expect(romajiToHiragana(kanaToRomaji(word))).toBe(word);
        }
    });
});

describe('kanaToHepburn', () => {
    it("spells ん as n' before a vowel or y, and n elsewhere", () => {
        expect(kanaToHepburn('げんいん')).toBe("gen'in");
        expect(kanaToHepburn('きんえん')).toBe("kin'en");
        expect(kanaToHepburn('こんや')).toBe("kon'ya");
        expect(kanaToHepburn('こんな')).toBe('konna');
        expect(kanaToHepburn('かんじ')).toBe('kanji');
        expect(kanaToHepburn('ほん')).toBe('hon');
    });

    it('spells everything else as kanaToRomaji does', () => {
        for (const word of ['つむ', 'しゃしん', 'きって', 'まっちゃ', 'こーひー', 'テレビ', 'ふぁいる']) {
            expect(kanaToHepburn(word)).toBe(kanaToRomaji(word));
        }
    });

    // Issue 235: the IME spelling does not survive the Hepburn reader (gennin reads げんにん).
    it('is read back by readRomajiQuery as the same kana: ん before a vowel, a y, a な-row kana and a consonant', () => {
        const readings = [
            'げんいん', 'きんえん', 'かんい', 'たんい', 'はんおん', 'ほんを',
            'こんや', 'ほんや', 'きんゆう', 'しんよう',
            'こんな', 'あんない', 'おんな', 'はんにん', 'こんにちは', 'こんにゃく',
            'かんじ', 'さんぽ', 'しんぶん', 'てんき', 'ほん', 'コンビニ', 'パンや',
        ];
        for (const reading of readings) {
            expect(readRomajiQuery(kanaToHepburn(reading))?.kana, reading).toBe(toHiragana(reading));
        }
        // The IME spelling of the same readings is what the reader takes for another word.
        expect(readRomajiQuery(kanaToRomaji('げんいん'))?.kana).toBe('げんにん');
    });
});
