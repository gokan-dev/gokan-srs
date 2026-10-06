/**
 * Full-width characters: kana, CJK ideographs, full-width punctuation and forms.
 *
 * These occupy a full em of advance width in every font the app ships, where a
 * Latin digit occupies roughly half of one. That difference is the whole reason
 * this module exists.
 */
// Written as escapes: the first range starts at U+3000, an invisible ideographic space.
const FULL_WIDTH = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF00-\uFF60\uFFE0-\uFFE6]/;

/** Advance width of a half-width character, as a fraction of one em. */
const HALF_WIDTH_EM = 0.55;

/**
 * Trailing slack, in em. One full-width slot, so the caret and the next
 * keystroke have somewhere to go instead of the text jumping as it overflows.
 */
const CARET_SLACK_EM = 1;

/**
 * Minimum width, in em, of an empty blank.
 *
 * Deliberately a CONSTANT rather than derived from the expected answer: sizing a
 * blank to its answer tells the learner how many characters to produce, which is
 * a hint they did not ask for and cannot decline. Every blank starts the same
 * width whatever is going in it.
 */
const MIN_WIDTH_EM = 3.5;

/**
 * The width a cloze blank should have to hold `text`, in em.
 *
 * The bug this fixes: the width was `${text.length + 1}ch`, and `ch` is the
 * advance of the "0" glyph - a HALF-width unit. Japanese input is full-width, so
 * every character needed about twice the space it was given and answers spilled
 * out of the underline. Typing もどる (3 characters) got 4ch of room, which is
 * about two kana wide.
 *
 * Returned in em because in CJK typography one em IS the full-width advance, so
 * the arithmetic below is exact for kana and kanji rather than a fudge factor.
 */
export function blankWidthEm(text: string): number {
    let width = 0;
    for (const char of text) {
        width += FULL_WIDTH.test(char) ? 1 : HALF_WIDTH_EM;
    }
    return Math.max(MIN_WIDTH_EM, width + CARET_SLACK_EM);
}
