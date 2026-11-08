// Text tools the titles and descriptions are written with (lib/messages): shortening, casing, and
// a grammar pattern or explanation as a learner searches it. Kept apart from the catalogs so each
// is tested once, whatever locale writes with it.

/** `value` cut to `maxLength`, an ellipsis marking the cut. */
export function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Entry titles are sentence case: "causative (させる)" -> "Causative (させる)". "i-adjective" and
 * "na-adjective" stay lowercase, as learners write them ("I-adjective" reads as a typo), and a
 * title starting with Japanese has no case to change.
 */
export function sentenceCase(text: string): string {
    if (/^(?:i|na)-/.test(text)) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// Slot placeholders the dataset writes into patterns ("Noun を余儀なくされる", "い-Adjective く",
// "Verb-te kureru"). Nobody types them into a search box.
const PATTERN_PLACEHOLDER = /(?:[いな]-)?\b(?:i-Adjective|na-Adjective|Adjective|Noun|Verb)\d?/g;

/**
 * A grammar pattern as a learner searches it: "～を問わず" -> "を問わず", "Noun から Noun に至る"
 * -> "からに至る", "Verb-te kureru" -> "te kureru". Japanese is written without spaces, so the
 * gaps a removed placeholder leaves between Japanese characters close up; romaji keeps its own.
 */
export function searchablePattern(pattern: string): string {
    return pattern
        .replace(PATTERN_PLACEHOLDER, ' ')
        .replace(/[～〜~+]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/(?<=[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}ー、。]) (?=[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}ー、。])/gu, '')
        .replace(/^[\s\-:、,]+|[\s\-:、,]+$/g, '');
}

/**
 * The quoted English equivalents in a short explanation ("Means 'regardless of' or
 * 'irrespective of'." -> "regardless of, irrespective of"), at most two. The lookarounds keep
 * an apostrophe inside a word ("isn't") from closing a quote.
 */
export function quotedGlosses(explanation: string): string | undefined {
    const glosses = [...explanation.matchAll(/(?<![A-Za-z])'(.+?)'(?![A-Za-z])/g)]
        .map(match => match[1].trim())
        .filter(gloss => gloss.length > 0)
        .slice(0, 2);
    return glosses.length > 0 ? glosses.join(', ') : undefined;
}
















