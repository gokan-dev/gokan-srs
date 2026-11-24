// The search index's rows, one format for both apps: the dictionary writes them into its index
// files at prerender (lib/searchIndex.ts), gokan-srs into a module of its build (vite.config.ts),
// and both read them back through the one matcher (search.ts) with the same options
// (`prepareRowSearch`, rowSearch.ts), so a query finds the same rows in the same order in both.
// What reads a row here imports neither the matcher nor the conjugation rules, so the dictionary's
// page-wide script can draw a row without bundling them (they load with its query engine).

import { WORD_CLASSES, wordClassOf } from './conjugation';
import type { GrammarPoint } from './grammar';
import { headwordOf, secondaryForm } from './headword';
import { kunReadingLabel, type Kanji } from './kanji';
import type { SearchGrammarInput, SearchKanjiInput } from './search';
import type { Vocabulary } from './vocabulary';

/**
 * One word of the search index, as a compact array (it is downloaded, ~36k times over):
 * id, headword (headwordOf), secondary form (the reading, or a word learned in kana's kanji
 * spelling), the short gloss, JLPT level (0 for none) and flags (common, learned in kana,
 * conjugation class). Rows are in frequency order, so a row's position is its frequency rank.
 */
export type SearchWordRow = [id: string, headword: string, secondary: string, gloss: string, jlpt: number, flags: number];

/**
 * The words of an index file, one array per field (id, headword, secondary form, gloss, JLPT
 * level, flags), position i of each describing word i. Column by column compresses far better
 * than row by row: the dictionary's core file is 292 KB gzipped this way, 379 KB as one array per word.
 */
export type SearchWordColumns = [ids: string[], headwords: string[], secondary: string[], glosses: string[], jlpt: number[], flags: number[]];

/**
 * The kanji of an index file (SearchKanjiRow), one array per field like the words: by column the
 * dictionary's core file is 12 KB smaller gzipped than by row (#264).
 */
export type SearchKanjiColumns = [characters: string[], jlpt: number[], frequency: number[], meanings: string[], readings: string[]];

/** An index's rows as stored: words and kanji by column, grammar points by row. */
export interface SearchIndexColumns {
    w: SearchWordColumns;
    k?: SearchKanjiColumns;
    g?: SearchGrammarRow[];
}

export const FLAG_COMMON = 1;
export const FLAG_USUALLY_KANA = 2;
/** The conjugation class is stored above the two flags, as its WORD_CLASSES position plus one. */
export const CLASS_SHIFT = 2;

export const isCommonRow = (row: SearchWordRow): boolean => (row[5] & FLAG_COMMON) !== 0;

/** The kana reading of a row: the headword itself for a word learned in kana. */
export const readingOfRow = (row: SearchWordRow): string => ((row[5] & FLAG_USUALLY_KANA) !== 0 ? row[1] : row[2]);

/** Whether the row's word is learned in kana: its headword is its kana, its secondary form its kanji spelling. */
export const isUsuallyKanaRow = (row: SearchWordRow): boolean => (row[5] & FLAG_USUALLY_KANA) !== 0;

/** The row's class code: 0 for a word that does not conjugate. */
export const classCodeOfRow = (row: SearchWordRow): number => row[5] >> CLASS_SHIFT;

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

/** The first sense's glosses joined with "; ", cut as a grammar row's explanation is: one line of a list row or a search result. */
export function shortGloss(vocab: Pick<Vocabulary, 'senses'>): string {
    return truncateAtWord(vocab.senses[0]?.glosses.join('; ') ?? '', SEARCH_EXPLANATION_LENGTH);
}

export function searchWordRow(vocab: Vocabulary): SearchWordRow {
    const wordClass = wordClassOf(vocab.senses.flatMap(sense => sense.pos));
    const flags = (vocab.isCommon ? FLAG_COMMON : 0)
        | (vocab.usuallyKana ? FLAG_USUALLY_KANA : 0)
        | ((wordClass ? WORD_CLASSES.indexOf(wordClass) + 1 : 0) << CLASS_SHIFT);
    return [vocab.id, headwordOf(vocab), secondaryForm(vocab), shortGloss(vocab), vocab.jlptLevel ?? 0, flags];
}

/** Rows to the columnar file layout (SearchWordColumns). */
export function toColumns(rows: SearchWordRow[]): SearchWordColumns {
    const columns: SearchWordColumns = [[], [], [], [], [], []];
    for (const [id, headword, secondary, gloss, jlpt, flags] of rows) {
        columns[0].push(id);
        columns[1].push(headword);
        columns[2].push(secondary);
        columns[3].push(gloss);
        columns[4].push(jlpt);
        columns[5].push(flags);
    }
    return columns;
}

/** The columnar file layout back to rows. */
export function fromColumns([ids, headwords, secondary, glosses, jlpt, flags]: SearchWordColumns): SearchWordRow[] {
    return ids.map((id, i) => [id, headwords[i], secondary[i], glosses[i], jlpt[i], flags[i]]);
}

/** Kanji rows to the columnar file layout (SearchKanjiColumns). */
export function kanjiToColumns(rows: SearchKanjiRow[]): SearchKanjiColumns {
    const columns: SearchKanjiColumns = [[], [], [], [], []];
    for (const [character, jlpt, frequency, meanings, readings] of rows) {
        columns[0].push(character);
        columns[1].push(jlpt);
        columns[2].push(frequency);
        columns[3].push(meanings);
        columns[4].push(readings);
    }
    return columns;
}

/** The kanji's columnar file layout back to rows. */
export function kanjiFromColumns([characters, jlpt, frequency, meanings, readings]: SearchKanjiColumns): SearchKanjiRow[] {
    return characters.map((character, i) => [character, jlpt[i], frequency[i], meanings[i], readings[i]]);
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

/**
 * A kanji row's main readings, as a search row shows them beside the glyph: its first on readings
 * (katakana), then its first kun readings written as a kun reading is shown (まな(ぶ),
 * kunReadingLabel), affix forms (みず-) left out, `perKind` of each.
 */
export function kanjiRowMainReadings(row: SearchKanjiRow, perKind = 2): string[] {
    const readings = row[4] ? row[4].split(' ').filter(reading => !reading.includes('-')) : [];
    const on = readings.filter(reading => /^[ァ-ヿ]/.test(reading));
    const kun = readings.filter(reading => !/^[ァ-ヿ]/.test(reading)).map(kunReadingLabel);
    return [...new Set(on)].slice(0, perKind).concat([...new Set(kun)].slice(0, perKind));
}

/** A kanji row as the matcher reads it. */
export function kanjiRowInput(row: SearchKanjiRow): SearchKanjiInput<SearchKanjiRow> {
    return { row, character: row[0], meanings: kanjiRowMeanings(row), readings: row[4] ? row[4].split(' ') : [], jlpt: row[1], frequency: row[2] };
}

/** A grammar row as the matcher reads it. */
export function grammarRowInput(row: SearchGrammarRow): SearchGrammarInput<SearchGrammarRow> {
    return { row, title: row[1], romaji: row[2], explanation: row[3] };
}
