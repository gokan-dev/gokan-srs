// The search index's kanji and grammar rows, one format for both apps: the dictionary writes them
// into its index files at prerender (lib/searchIndex.ts), gokan-srs into a module of its build
// (vite.config.ts), and both read them back through the one matcher (search.ts).

import type { GrammarPoint } from './grammar';
import type { Kanji } from './kanji';

/**
 * One kanji: the character, JLPT level (0 for none), frequency rank (0 for none), its English
 * meanings joined with "; ", and its on and kun readings as KANJIDIC writes them (katakana on,
 * hiragana kun with "." before the okurigana and "-" for an affix), joined with spaces.
 */
export type SearchKanjiRow = [character: string, jlpt: number, frequency: number, meanings: string, readings: string];

/** One grammar point, in teaching order: id, title, romaji ('' for none), short explanation, JLPT level. */
export type SearchGrammarRow = [id: string, title: string, romaji: string, explanation: string, jlpt: number];

/** How long a grammar row's explanation may be: its first words, enough to match a word of it and to show. */
export const SEARCH_EXPLANATION_LENGTH = 60;

/**
 * `text` cut at a word boundary to at most `max` characters, with an ellipsis when cut. A single
 * word longer than `max` is cut mid-word rather than dropped.
 */
export function truncateAtWord(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max - 1);
    const boundary = cut.lastIndexOf(' ');
    return `${(boundary > 0 ? cut.slice(0, boundary) : cut).replace(/[\s;,]+$/, '')}…`;
}

export function searchKanjiRow(kanji: Pick<Kanji, 'character' | 'steps' | 'frequency' | 'meanings' | 'readings'>): SearchKanjiRow {
    return [
        kanji.character,
        kanji.steps.jlpt ?? 0,
        kanji.frequency ?? 0,
        kanji.meanings.join('; '),
        [...kanji.readings.on, ...kanji.readings.kun].join(' '),
    ];
}

export function searchGrammarRow(point: Pick<GrammarPoint, 'id' | 'title' | 'romaji' | 'shortExplanation' | 'jlptLevel'>): SearchGrammarRow {
    return [point.id, point.title, point.romaji ?? '', truncateAtWord(point.shortExplanation, SEARCH_EXPLANATION_LENGTH), point.jlptLevel];
}

/** A kanji row's meanings, the main one first. */
export const kanjiRowMeanings = (row: SearchKanjiRow): string[] => (row[3] ? row[3].split('; ') : []);
