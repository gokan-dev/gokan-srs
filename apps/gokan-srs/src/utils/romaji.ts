/**
 * Lightweight Hepburn romaji -> hiragana converter, used so the search bar can
 * match a hiragana reading (e.g. にち) from a romaji query (e.g. "nichi").
 *
 * It is intentionally lenient: anything it can't map (English letters left over
 * from a meaning search, partial syllables) is passed through unchanged, so
 * feeding it a non-romaji query never breaks the surrounding search.
 */

// Longest keys are tried first, so 3-char combos win over their prefixes.
const ROMAJI_MAP: Record<string, string> = {
    // Y-combos
    kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
    gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
    sha: 'しゃ', shu: 'しゅ', sho: 'しょ', shi: 'し',
    sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
    ja: 'じゃ', ju: 'じゅ', jo: 'じょ', ji: 'じ',
    jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ',
    zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
    cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', chi: 'ち',
    cya: 'ちゃ', cyu: 'ちゅ', cyo: 'ちょ',
    tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ', ti: 'ち',
    dya: 'ぢゃ', dyu: 'ぢゅ', dyo: 'ぢょ', di: 'ぢ', du: 'づ',
    nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
    hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
    bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
    pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
    mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
    rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
    tsu: 'つ', tu: 'つ',
    fu: 'ふ', hu: 'ふ',
    // Basic gojuon + voiced/handakuon (2-char)
    ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
    ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
    sa: 'さ', su: 'す', se: 'せ', so: 'そ', si: 'し',
    za: 'ざ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
    ta: 'た', te: 'て', to: 'と',
    da: 'だ', de: 'で', do: 'ど',
    na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
    ha: 'は', hi: 'ひ', he: 'へ', ho: 'ほ',
    ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
    pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
    ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
    ya: 'や', yu: 'ゆ', yo: 'よ',
    ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
    wa: 'わ', wo: 'を', wi: 'うぃ', we: 'うぇ',
    va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
    // Bare vowels (1-char)
    a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
};

const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);

export function romajiToHiragana(input: string): string {
    const s = input.toLowerCase();
    let result = '';
    let i = 0;

    while (i < s.length) {
        const c = s[i];
        const next = s[i + 1];

        // Sokuon (っ): a doubled consonant, or the "tch" spelling of っち.
        if (c === 't' && next === 'c' && s[i + 2] === 'h') {
            result += 'っ';
            i += 1;
            continue;
        }
        if (c === next && !VOWELS.has(c) && c !== 'n' && /[a-z]/.test(c)) {
            result += 'っ';
            i += 1;
            continue;
        }

        // Syllabic ん.
        if (c === 'n') {
            if (next === "'") { result += 'ん'; i += 2; continue; }
            if (next === 'n') { result += 'ん'; i += 1; continue; }
            const syllable = longestSyllable(s, i, 2);
            if (syllable) { result += syllable.kana; i += syllable.length; continue; }
            // 'n' before a consonant or at the end -> ん.
            result += 'ん';
            i += 1;
            continue;
        }

        // Longest-match against the syllable table.
        const syllable = longestSyllable(s, i, 1);
        if (syllable) { result += syllable.kana; i += syllable.length; continue; }

        // Unconvertible character (e.g. a letter from an English meaning search): pass through.
        result += c;
        i += 1;
    }

    return result;
}

/**
 * Kana -> the romaji a learner types to produce it on an IME, reusing the table
 * above in reverse (first spelling wins: sha over sya, chi over ti, tsu over tu).
 * Used to measure typos in keystrokes rather than in kana (see
 * matchAnswer in utils/answerMatching.ts): つま for つむ is one keystroke (tsuma / tsumu), but
 * やむ for つむ is three (yamu / tsumu), though both are one kana apart.
 *
 * Small kana read as their own keystrokes (ぇ -> "xe"), っ doubles the next
 * consonant, ー is "-", and anything else passes through unchanged.
 */
const KANA_TO_ROMAJI: Record<string, string> = {};
for (const [romaji, kana] of Object.entries(ROMAJI_MAP)) {
    if (!(kana in KANA_TO_ROMAJI)) KANA_TO_ROMAJI[kana] = romaji;
}
Object.assign(KANA_TO_ROMAJI, {
    ん: 'n', ー: '-', を: 'wo',
    ぁ: 'xa', ぃ: 'xi', ぅ: 'xu', ぇ: 'xe', ぉ: 'xo', ゃ: 'xya', ゅ: 'xyu', ょ: 'xyo', ゎ: 'xwa',
});

/** Katakana to hiragana; everything else unchanged. */
export function toHiragana(input: string): string {
    return input.replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

export function kanaToRomaji(input: string): string {
    const s = toHiragana(input);
    let result = '';
    let i = 0;
    while (i < s.length) {
        if (s[i] === 'っ') {
            // Doubles the next syllable's first letter (って -> tte), or stands alone.
            const next = KANA_TO_ROMAJI[s.slice(i + 1, i + 3)] ?? KANA_TO_ROMAJI[s[i + 1]];
            result += next && !VOWELS.has(next[0]) ? next[0] : 'xtsu';
            i += 1;
            continue;
        }
        const pair = KANA_TO_ROMAJI[s.slice(i, i + 2)];
        if (pair !== undefined && i + 1 < s.length) { result += pair; i += 2; continue; }
        result += KANA_TO_ROMAJI[s[i]] ?? s[i];
        i += 1;
    }
    return result;
}

/** True if the string contains any latin letters (i.e. could be a romaji query worth converting). */
export function looksLikeRomaji(input: string): boolean {
    return /[a-z]/i.test(input);
}

/** The longest syllable (3 letters down to `minLength`) starting at `i`, or null. */
function longestSyllable(s: string, i: number, minLength: number): { kana: string; length: number } | null {
    for (let length = 3; length >= minLength; length--) {
        const kana = ROMAJI_MAP[s.slice(i, i + length)];
        if (kana) return { kana, length };
    }
    return null;
}
