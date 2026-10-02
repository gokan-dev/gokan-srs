/**
 * CJK ideographs plus the iteration mark 々, which belongs to the skeleton:
 * 日 and 日々 are different words, so 々 must not read as an omittable tail
 * the way kana does.
 */
const KANJI = /[々㐀-䶿一-鿿]/;
const KANA_ONLY = /^[぀-ゟ゠-ヿ]+$/;

export function hasKanji(s: string): boolean {
    return KANJI.test(s);
}

/** The kanji of a form, in order, with all kana dropped. */
export function kanjiSkeleton(s: string): string {
    return [...s].filter(c => KANJI.test(c)).join('');
}

/** True for a non-empty string made only of hiragana/katakana. */
export function isKanaOnly(s: string): boolean {
    return KANA_ONLY.test(s);
}
