// Furigana as both apps render it: each reading over its run of kanji only, so the okurigana
// carry none (食べる with たべる is 食(た)べる, not 食べる(たべる)) and a wide reading spreads
// as few base characters as possible.

import { toHiragana } from './romaji';

export interface RubyPart {
    text: string;
    /** The reading over `text`, absent for kana that need none. */
    ruby?: string;
}

const KANJI_RUN = /[㐀-鿿々〆ヶ]+/g;
const HAS_KANJI = /[㐀-鿿々〆ヶ]/;

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The ruby runs of `text` read as `reading`. Kana in the word are matched against the reading,
 * so each run of kanji gets its own part of it (引き出し: 引(ひ)き出(だ)し). When they cannot be
 * matched (an irregular reading, a reading of another form), the whole word carries the whole
 * reading rather than a wrong split. A word without kanji, or without a reading, has no ruby.
 */
export function rubyParts(text: string, reading: string | undefined): RubyPart[] {
    if (!reading || !HAS_KANJI.test(text)) return [{ text }];

    const parts: RubyPart[] = [];
    let pattern = '^';
    let cursor = 0;
    for (const run of text.matchAll(KANJI_RUN)) {
        if (run.index > cursor) {
            const kana = text.slice(cursor, run.index);
            parts.push({ text: kana });
            pattern += escapeRegExp(toHiragana(kana));
        }
        parts.push({ text: run[0], ruby: '' });
        pattern += '(.+?)';
        cursor = run.index + run[0].length;
    }
    if (cursor < text.length) {
        const kana = text.slice(cursor);
        parts.push({ text: kana });
        pattern += escapeRegExp(toHiragana(kana));
    }

    const match = new RegExp(`${pattern}$`).exec(toHiragana(reading));
    if (!match) return [{ text, ruby: reading }];

    let group = 1;
    return parts.map(part => (part.ruby === undefined ? part : { text: part.text, ruby: match[group++] }));
}
