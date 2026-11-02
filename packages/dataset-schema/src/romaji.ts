/**
 * Lightweight Hepburn romaji -> hiragana converter, used so both apps' search can
 * match a hiragana reading (e.g. にち) from a romaji query (e.g. "nichi").
 *
 * It is intentionally lenient: anything it can't map (English letters left over
 * from a meaning search, partial syllables) is passed through unchanged, so
 * feeding it a non-romaji query never breaks the surrounding search.
 */

/** "a あ b い" as [a, あ], [b, い]: the table below is written as such lists, being shipped in the dictionary's search engine, which has a size budget. */
function pairs(list: string): [string, string][] {
    const words = list.split(' ');
    return words.flatMap((word, i): [string, string][] => (i % 2 === 0 ? [[word, words[i + 1] ?? '']] : []));
}

// Romaji -> kana, as Google and Microsoft IMEs type it. Longest keys are tried first, so
// 3-char combos win over their prefixes. Order matters only to kanaToRomaji, which spells a
// kana the first way listed: Hepburn first (しゃ is sha, not sya; ち chi, not ti).
const ROMAJI_MAP: Record<string, string> = {};
// Contracted sounds: a consonant's a, u, o and e (sha しゃ, kye きぇ).
for (const [consonant, kana] of pairs('sh し ch ち j じ ky き gy ぎ ny に hy ひ by び py ぴ my み ry り sy し zy じ jy じ cy ち ty ち dy ぢ')) {
    for (const [vowel, small] of pairs('a ゃ u ゅ o ょ e ぇ')) ROMAJI_MAP[consonant + vowel] = kana + small;
}
for (const [romaji, kana] of pairs('shi し chi ち tsu つ fu ふ ji じ')) ROMAJI_MAP[romaji] = kana;
// The rows: a consonant and its kana for a, i, u, e, o (ti is ち, tu つ, as an IME reads them).
for (const [consonant, kana] of [['', 'あいうえお'], ...pairs('k かきくけこ g がぎぐげご s さしすせそ z ざじずぜぞ t たちつてと d だぢづでど n なにぬねの h はひふへほ b ばびぶべぼ p ぱぴぷぺぽ m まみむめも r らりるれろ')]) {
    [...kana].forEach((k, i) => { ROMAJI_MAP[consonant + 'aiueo'[i]] = k; });
}
// Everything else: y and w, v, loanword combos, small kana (x, and l below).
for (const [romaji, kana] of pairs(
    'ya や yu ゆ yo よ ye いぇ wa わ wo を wi うぃ we うぇ wu う who うぉ wyi ゐ wye ゑ '
    + 'va ゔぁ vi ゔぃ vu ゔ ve ゔぇ vo ゔぉ vya ゔゃ vyu ゔゅ vyo ゔょ fa ふぁ fi ふぃ fe ふぇ fo ふぉ fyu ふゅ '
    + 'thi てぃ thu てゅ dhi でぃ dhu でゅ twu とぅ dwu どぅ tsa つぁ tsi つぃ tse つぇ tso つぉ kwa くぁ gwa ぐぁ '
    + 'xa ぁ xi ぃ xu ぅ xe ぇ xo ぉ xya ゃ xyu ゅ xyo ょ xtsu っ xtu っ xwa ゎ xka ゕ xke ゖ',
)) ROMAJI_MAP[romaji] = kana;
for (const key of Object.keys(ROMAJI_MAP)) {
    if (key.startsWith('x')) ROMAJI_MAP['l' + key.slice(1)] = ROMAJI_MAP[key];
}

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
            // "nn" is one ん at the end or before a consonant ("kannji"), as an IME reads it;
            // before a vowel or y the second n begins a syllable ("konnichiha", "konnyaku").
            if (next === 'n') {
                const after = s[i + 2];
                result += 'ん';
                i += after !== undefined && (VOWELS.has(after) || after === 'y') ? 1 : 2;
                continue;
            }
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

const ROMAJI_KEYS = Object.keys(ROMAJI_MAP);
const HIRAGANA_ONLY = /^[ぁ-ゖー]+$/;

/** The kana of every syllable `start` begins without completing it ("ky" -> きゃ きゅ きょ). */
function syllablesStartingWith(start: string): string[] {
    return ROMAJI_KEYS.filter(key => key.length > start.length && key.startsWith(start)).map(key => ROMAJI_MAP[key]);
}

/**
 * The kana a reading can start with when the romaji stops partway through a syllable, so
 * search narrows letter by letter instead of losing the word: "taber" -> たべら, たべり,
 * たべる... on the way to "taberu". Complete syllables convert as romajiToHiragana does; an
 * unfinished one at the end stands for every syllable it begins, and a single consonant also
 * for っ (the first of a doubled one: "chot" on the way to "chotto"). A final "n" is ん or
 * the start of an n syllable ("kan" on the way to "kana"); a final "nn" is one ん.
 * Expects the query as readRomajiQuery normalizes it.
 *
 * Only for "the reading starts with": an exact match still needs the whole romaji converted.
 * Empty when the query is not romaji (a letter no syllable starts with, a digit, a space).
 */
export function romajiReadingPrefixes(input: string): string[] {
    const s = input.toLowerCase();
    const converted = romajiToHiragana(s);
    const [, typedHead, typedTail] = /^(.*?)([a-z]*)$/.exec(converted) ?? ['', converted, ''];
    // "matc" on the way to "matcha": the t of "tch" is already the っ.
    const [head, tail] = typedTail === 'tc' ? [typedHead + 'っ', 'c'] : [typedHead, typedTail];
    // An "n" the converter read as ん may instead begin the unfinished syllable ("kan", "beny");
    // a final "nn" is one ん ("kann").
    const nSyllables = head.endsWith('ん') && s.endsWith('n' + tail) && !(tail === '' && s.endsWith('nn'))
        ? syllablesStartingWith('n' + tail).map(kana => head.slice(0, -1) + kana)
        : [];
    // "konny": the converter read "nn" as ん plus an n that the unfinished syllable then left
    // as a second ん; only the n syllables can follow (こんにゃ, never こんんや).
    if (tail !== '' && head.endsWith('んん') && s.endsWith('nn' + tail)) return kanaOnly(nSyllables);
    const prefixes = tail === '' ? [head] : syllablesStartingWith(tail).map(kana => head + kana);
    // Not after a っ ("kakk", "matc") or a ん ("kannj", "anp"), and not for y or w, which never
    // double ("oy" on the way to "oya").
    if (tail.length === 1 && prefixes.length > 0 && !/[っん]$/.test(head) && !'yw'.includes(tail)) prefixes.push(head + 'っ');
    return kanaOnly([...prefixes, ...nSyllables]);
}

function kanaOnly(candidates: string[]): string[] {
    return [...new Set(candidates.filter(kana => HIRAGANA_ONLY.test(kana)))];
}

/** A search query read as romaji: its whole kana, and the kana a reading can start with (romajiReadingPrefixes). */
export interface RomajiQuery {
    kana: string;
    prefixes: string[];
}

/**
 * The romaji of a search query as an IME reads it, so every search reads a query one way:
 * spaces dropped ("tabe ru"), "-" as ー ("ko-hi-" for コーヒー), and "'" kept only where it
 * separates ん from what follows ("kan'i" is かんい, not かに).
 */
export function normalizeRomajiQuery(query: string): string {
    return query.toLowerCase().replace(/\s+/g, '').replace(/-/g, 'ー').replace(/(^|[^n])'+/g, '$1');
}

/** A search query read as romaji, or null when it has no Latin letter. */
export function readRomajiQuery(query: string): RomajiQuery | null {
    if (!looksLikeRomaji(query)) return null;
    const romaji = normalizeRomajiQuery(query);
    return { kana: romajiToHiragana(romaji), prefixes: romajiReadingPrefixes(romaji) };
}

/**
 * Kana -> the romaji a learner types to produce it on an IME, reusing the table
 * above in reverse (first spelling wins: sha over sya, chi over ti, tsu over tu).
 * Used to measure typos in keystrokes rather than in kana (see
 * gokan-srs's matchAnswer, utils/answerMatching.ts): つま for つむ is one keystroke (tsuma / tsumu), but
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
        if (s[i] === 'ん') {
            // "nn" where a single n would join what follows (かんい is kan'i, not かに), as an IME is typed.
            const after = kanaToRomaji(s.slice(i + 1, i + 3))[0] ?? '';
            result += after !== '' && (VOWELS.has(after) || after === 'y' || after === 'n') ? 'nn' : 'n';
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

/** A text field's value and its caret, as `convertRomajiInput` reads and returns them. */
export interface RomajiInput {
    text: string;
    caret: number;
}

const LETTER = /[a-z]/;

/**
 * Romaji typed into a Japanese answer field, converted as an IME converts it: every
 * complete syllable becomes hiragana, an unfinished one stays as typed until the next
 * letter decides it ("kak" is かk), and anything that is not an ASCII letter, "-" or
 * "'" (kana or kanji from a real IME, a space) passes through untouched.
 *
 * Only the text before the caret is converted, and the caret stays right after what
 * was typed, so editing in the middle of an answer works and the text after the caret
 * is never rewritten. Idempotent: converted text converts to itself, so Backspace
 * removes one kana and nothing is converted twice.
 *
 * ん follows the IME: "n" waits for the next letter ("kana" is かな, "kanji" かんじ),
 * "nn" and "n'" are ん, and a final "n" waits too (finishRomajiInput settles it).
 * っ is a doubled consonant ("kitte") or "tch" ("matcha"); "-" is ー.
 */
export function convertRomajiInput(text: string, caret: number): RomajiInput {
    const head = convertRomaji(text.slice(0, caret), false);
    return { text: head + text.slice(caret), caret: head.length };
}

/** The answer as submitted: all of it converted, and a final "n" read as ん ("hon" is ほん). */
export function finishRomajiInput(text: string): string {
    return convertRomaji(text, true);
}

function convertRomaji(input: string, finished: boolean): string {
    // Matched in lowercase (a capital typed by a phone keyboard is the same key), but a letter
    // left as a letter keeps its case: the T of Tシャツ.
    const s = input.replace(/[A-Z]/g, c => c.toLowerCase());
    let result = '';
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        const next = s[i + 1];
        if (c === '-') { result += 'ー'; i += 1; continue; }
        if (!LETTER.test(c)) { result += c; i += 1; continue; }

        if (c === 'n') {
            if (next === "'" || next === 'n') { result += 'ん'; i += 2; continue; }
            if (next === undefined) { result += finished ? 'ん' : input[i]; i += 1; continue; }
            if (VOWELS.has(next) || next === 'y') {
                const syllable = longestSyllable(s, i, 2);
                if (syllable) { result += syllable.kana; i += syllable.length; continue; }
                // "ny" at the end: the syllable is still being typed.
                result += input[i]; i += 1; continue;
            }
            // Anything else after it decides it: ん ("kanji", "hon-", "honか").
            result += 'ん'; i += 1; continue;
        }

        if ((c === next && !VOWELS.has(c)) || (c === 't' && next === 'c' && s[i + 2] === 'h')) {
            result += 'っ'; i += 1; continue;
        }

        const syllable = longestSyllable(s, i, 1);
        if (syllable) { result += syllable.kana; i += syllable.length; continue; }
        // Not a syllable (yet): kept as typed, so the next letter can complete it.
        result += input[i];
        i += 1;
    }
    return result;
}

/** True if the string contains any latin letters (i.e. could be a romaji query worth converting). */
export function looksLikeRomaji(input: string): boolean {
    return /[a-z]/i.test(input);
}

/** The longest syllable (4 letters, as "xtsu", down to `minLength`) starting at `i`, or null. */
function longestSyllable(s: string, i: number, minLength: number): { kana: string; length: number } | null {
    for (let length = 4; length >= minLength; length--) {
        const kana = ROMAJI_MAP[s.slice(i, i + length)];
        if (kana) return { kana, length };
    }
    return null;
}
