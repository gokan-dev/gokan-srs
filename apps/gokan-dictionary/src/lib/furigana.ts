// Example sentences as the pages render them: runs of text, each linked to its word and carrying
// furigana, split so the readings sit over the kanji only (食べる with たべる is 食(た)べる, not
// 食べる(たべる)). Used by the word and grammar pages, at prerender time.

import { segmentInteractiveSentence, toHiragana } from '@gokan/dataset-schema';
import type { SegmentInteractiveSentenceOptions, Sentence } from '@gokan/dataset-schema';

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

export interface SentenceRun {
    parts: RubyPart[];
    /** The word this run links to; absent for plain text and for the page's own word. */
    vocabId?: string;
    /** The page's own word, or part of a grammar point's pattern: the current item. */
    emphasized: boolean;
}

/**
 * A sentence as runs, through the segmenter both apps share (segmentInteractiveSentence): every
 * recognised word with a reading gets furigana and a link, except the word whose page this is,
 * which is emphasised instead of linked to itself.
 */
export function sentenceRuns(sentence: Sentence, options: SegmentInteractiveSentenceOptions = {}): SentenceRun[] {
    return segmentInteractiveSentence(sentence, options).map(segment => ({
        parts: segment.type === 'match' ? rubyParts(segment.content, segment.reading) : [{ text: segment.content }],
        ...(segment.vocabId && !segment.isTarget ? { vocabId: segment.vocabId } : {}),
        emphasized: segment.isTarget || segment.isHighlighted,
    }));
}
