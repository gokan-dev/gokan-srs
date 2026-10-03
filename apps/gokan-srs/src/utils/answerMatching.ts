// src/utils/answerMatching.ts
//
// The one place a typed answer is compared with an accepted one, for every quiz:
// reading, meaning, production (both cards), grammar blanks and the conjugation
// drill. Quizzes differ only in WHICH forms they accept (their accept-lists) and,
// where it is warranted, in how lenient the comparison is (`Leniency`). The
// comparison itself is never re-implemented elsewhere, so a given typo is graded
// identically whichever quiz asked the question.
import { hasKanji, kanjiSkeleton } from './kanji.utils';
import { kanaToRomaji } from './romaji';

export type AnswerResult = 'correct' | 'minor_error' | 'wrong' | 'pass';

/**
 * How forgiving the comparison is. `standard` is the default for every quiz.
 * `lenient` is for exercises where the answer is long and the thing being tested
 * is not its spelling: the conjugation drill, whose answers (必要じゃなかった)
 * are whole conjugated forms where a missed っ is plainly a slip of the keyboard.
 */
export type Leniency = 'standard' | 'lenient';

interface Tolerance {
    /**
     * Keystrokes of difference tolerated in a kana answer, by the expected
     * answer's length in kana.
     */
    kanaTypos: (kanaLength: number) => number;
    /**
     * Shortest expected kana answer (in kana) where an answer that is SHORTER
     * than it can still be a typo. Below this, a missing kana usually makes a
     * different word: おばさん for おばあさん, ゆき for ゆうき, きて for きって.
     * In a long answer it does not: ひつようじゃなかた is 必要じゃなかった with one
     * key missed, and nothing else.
     */
    kanaDropFromLength: number;
    /** Letters of difference tolerated in an English answer, by the expected answer's length. */
    latinTypos: (length: number) => number;
}

const TOLERANCE: Record<Leniency, Tolerance> = {
    standard: {
        kanaTypos: () => 1,
        kanaDropFromLength: 6,
        latinTypos: length => (length >= 6 ? 2 : length >= 3 ? 1 : 0),
    },
    lenient: {
        kanaTypos: length => (length >= 8 ? 2 : 1),
        kanaDropFromLength: 4,
        // No English answer is graded leniently today; kept equal to standard so
        // the level stays meaningful for every script rather than kana alone.
        latinTypos: length => (length >= 6 ? 2 : length >= 3 ? 1 : 0),
    },
};

const KANA = /[぀-ヿ]/;

/**
 * English answers are compared after this: case, parenthesised notes,
 * punctuation and a leading "to" / article do not count ("To eat!" is "eat").
 */
export function normalizeLatin(text: string): string {
    let s = text.toLowerCase().trim();

    // Parenthesised content goes first (iteratively, for nesting), before
    // punctuation removal would make the parentheses unidentifiable.
    let prev;
    do {
        prev = s;
        s = s.replace(/\s*\([^()]*\)\s*/g, ' ');
    } while (s !== prev);

    s = s.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
    s = s.replace(/^(to\s+be|to|be|a|an|the)\s+/g, '');
    s = s.replace(/\s+/g, ' ');
    return s.trim();
}

/** Compares one typed answer with one accepted form. */
export function matchAnswer(input: string, expected: string, leniency: Leniency = 'standard'): AnswerResult {
    const tolerance = TOLERANCE[leniency];
    const isLatin = !hasKanji(expected) && !KANA.test(expected);

    const u = isLatin ? normalizeLatin(input) : input.trim().replace(/\s+/g, '');
    const e = isLatin ? normalizeLatin(expected) : expected.trim().replace(/\s+/g, '');

    if (u === 'pass') return 'pass';
    // An empty expected form (a gloss that was only a parenthesised note) would
    // otherwise be "contained" in every answer and match it as a partial.
    if (u.length === 0 || e.length === 0) return 'wrong';
    if (u === e) return 'correct';

    // Once kanji are involved, edit distance stops meaning "typo": 会社 and 会話
    // are one character apart and are different words. So kanji are never fuzzy.
    //
    // The one tolerated difference is a DROPPED OKURIGANA TAIL: 六 for 六つ, 食
    // for 食べる. The learner produced the word and stopped at the kanji, which is
    // a partial answer rather than the wrong word.
    //
    // Deliberately a prefix test, not a distance one: a distance test would also
    // swallow 上がる / 上げる and 始まる / 始める, which differ by one okurigana kana
    // and ARE different words. Nothing is a different word merely by having its
    // tail cut off.
    if (hasKanji(u) || hasKanji(e)) {
        if (kanjiSkeleton(u) !== kanjiSkeleton(e)) return 'wrong';
        return e.startsWith(u) ? 'minor_error' : 'wrong';
    }

    if (isLatin) {
        // A partial English answer ('pain' for 'painful', or the reverse).
        if (u.length >= 3 && (e.includes(u) || u.includes(e)) && Math.abs(u.length - e.length) <= 5) {
            return 'minor_error';
        }
        return levenshtein(u, e) <= tolerance.latinTypos(e.length) ? 'minor_error' : 'wrong';
    }

    // Kana: the distance is counted in ROMAJI, i.e. in the keystrokes a learner
    // makes on an IME. A typo is a mistyped key: つま for つむ is one key off
    // (tsuma / tsumu), while やむ for つむ is one kana but three keys (yamu / tsumu)
    // and, on a word that short, a different word.
    const dist = levenshtein(kanaToRomaji(u), kanaToRomaji(e));
    if (dist > tolerance.kanaTypos(e.length)) return 'wrong';

    // An answer SHORTER than the expected one (in kana) is a typo only in a long
    // enough word - see Tolerance.kanaDropFromLength. こーたえ for こたえ is longer
    // and stays a typo; こえ for こたえ is shorter and three keys off anyway.
    if (u.length < e.length && e.length < tolerance.kanaDropFromLength) return 'wrong';

    return 'minor_error';
}

/**
 * Compares a typed answer with every accepted form and returns the best result
 * (correct > minor_error > wrong), with the form it matched. A literal "pass"
 * short-circuits. `matchedAnswer` falls back to the first accepted form, which is
 * what the feedback reveals on a wrong answer.
 */
export function matchBest(
    input: string,
    accepted: string[],
    leniency: Leniency = 'standard'
): { result: AnswerResult; matchedAnswer: string } {
    let best: { result: AnswerResult; matchedAnswer: string } = { result: 'wrong', matchedAnswer: accepted[0] ?? '' };

    for (const form of accepted) {
        const result = matchAnswer(input, form, leniency);
        if (result === 'pass') return { result: 'pass', matchedAnswer: accepted[0] ?? '' };
        if (result === 'correct') return { result, matchedAnswer: form };
        if (result === 'minor_error' && best.result !== 'minor_error') best = { result, matchedAnswer: form };
    }

    return best;
}

function levenshtein(a: string, b: string): number {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let diagonal = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const above = row[j];
            row[j] = a[i - 1] === b[j - 1]
                ? diagonal
                : 1 + Math.min(diagonal, above, row[j - 1]);
            diagonal = above;
        }
    }
    return row[b.length];
}
