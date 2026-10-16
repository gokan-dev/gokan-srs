/**
 * Whether an English query is a whole word of a gloss, the test both apps' searches rank by
 * ("car" is a whole word of "car; automobile", not of "cart"). One copy, so the two rankings
 * cannot drift.
 */

const LETTER = /[a-z]/;

/** True if `word` is in `text` with no letter right before or after it. Both are compared as given (lowercase them first). */
export function containsWholeWord(text: string, word: string): boolean {
    if (!word) return false;
    const isLetter = (char: string | undefined) => char !== undefined && LETTER.test(char);
    for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
        if (!isLetter(text[at - 1]) && !isLetter(text[at + word.length])) return true;
    }
    return false;
}
