// Query matching and ranking for the dictionary's search: pure, shared by the header panel, the
// /search/ results page (client/search.ts) and the build-time acceptance check
// (scripts/check-build.ts), so all three rank the same way.
//
// A query is read every way a learner might have meant it: as written (kanji or kana, katakana
// and hiragana compared as equal), as romaji converted to kana ("taberu"), as a conjugated form
// (食べた, through conjugation.ts) and as English against the glosses.

import { looksLikeRomaji, romajiToHiragana, toHiragana } from '@gokan/dataset-schema';
import { deinflect, type WordClass } from './conjugation';
import { fromColumns, wordClassOfRow } from './searchIndex';
import { isCommonRow, readingOfRow } from './searchRow';
import type { SearchGrammarRow, SearchIndexFile, SearchKanjiRow, SearchWordRow } from './types';

/** Match tiers, best first. Within a tier: JLPT words, then common words, then frequency. */
export const TIER = {
    /** The headword or reading itself. */
    exact: 1,
    /** The reading the romaji converts to. */
    romaji: 2,
    /** The dictionary form of a conjugated query (食べた). */
    deinflected: 3,
    /** Headword or reading starts with the query; or, for a kanji query, the headword contains it. */
    prefix: 4,
    /** An English sense equal to the query, ignoring a leading "to" or article. */
    sense: 5,
    /** The query as a whole word in the gloss. */
    glossWord: 6,
    /**
     * The reading starts with the romaji's kana. After the English tiers: a Latin query that
     * converts is more often an English word ("house", read ほうせ) than the start of a reading.
     */
    romajiPrefix: 7,
    /** The query anywhere in headword, reading or gloss. */
    substring: 8,
} as const;

interface PreparedWord {
    row: SearchWordRow;
    rank: number;
    headword: string;
    /** In hiragana, so katakana and hiragana compare equal. */
    reading: string;
    gloss: string;
    senses: string[];
    wordClass: WordClass | null;
    jlpt: boolean;
    common: boolean;
}

interface PreparedGrammar {
    row: SearchGrammarRow;
    title: string;
    romaji: string;
    explanation: string;
}

export interface PreparedIndex {
    words: PreparedWord[];
    kanji: Map<string, SearchKanjiRow>;
    grammar: PreparedGrammar[];
}

export interface WordHit {
    row: SearchWordRow;
    tier: number;
    /** The conjugated form the query was read as, for "食べる, from 食べた". */
    via?: string;
}

export interface SearchResults {
    /** The normalised query. */
    query: string;
    /** The kana a romaji query was read as, or null. */
    kana: string | null;
    words: WordHit[];
    kanji: SearchKanjiRow[];
    grammar: SearchGrammarRow[];
}

/** NFKC (full-width Latin to half-width, half-width kana to full-width), trimmed, lowercase Latin. */
export function normalizeQuery(raw: string): string {
    return raw.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** An English sense as compared: lowercase, without parentheticals, a leading "to" or an article. */
function senseKey(sense: string): string {
    return sense.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(to|a|an|the) /, '');
}

/** A grammar title or romaji as compared: without the ～ placeholders and punctuation. */
function grammarKey(text: string): string {
    return text.normalize('NFKC').toLowerCase().replace(/[～〜~、。,.・/()（）\s]/g, '');
}

const JAPANESE = /[぀-ヿ㐀-鿿々]/;
const KANJI_ONLY = /^[㐀-鿿々]+$/;
const KANJI_CHAR = /[㐀-鿿々]/;
const KANA_ONLY = /^[ぁ-ゖー]+$/;

/** Words from every file, in order (core, then full); the kanji and grammar of whichever carries them. */
export function prepareIndex(files: SearchIndexFile[]): PreparedIndex {
    const words: PreparedWord[] = [];
    const kanji = new Map<string, SearchKanjiRow>();
    const grammar: PreparedGrammar[] = [];
    for (const file of files) {
        for (const row of fromColumns(file.w)) {
            const gloss = row[3].toLowerCase();
            words.push({
                row,
                rank: words.length,
                headword: row[1],
                reading: toHiragana(readingOfRow(row)),
                gloss,
                senses: row[3].split('; ').map(senseKey),
                wordClass: wordClassOfRow(row),
                jlpt: row[4] > 0,
                common: isCommonRow(row),
            });
        }
        for (const row of file.k ?? []) kanji.set(row[0], row);
        for (const row of file.g ?? []) {
            grammar.push({ row, title: grammarKey(row[1]), romaji: grammarKey(row[2]), explanation: row[3].toLowerCase() });
        }
    }
    return { words, kanji, grammar };
}

/** A conjugated form's candidates may name a regular godan rule for 行く or 問う, whose other forms are regular. */
function classFits(wordClass: WordClass | null, ruleClass: WordClass): boolean {
    if (wordClass === ruleClass) return true;
    return ruleClass === 'godan' && (wordClass === 'godan-iku' || wordClass === 'godan-tou');
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Every match for `raw`, best first, grouped as words, kanji and grammar. */
export function search(index: PreparedIndex, raw: string): SearchResults {
    const query = normalizeQuery(raw);
    const empty: SearchResults = { query, kana: null, words: [], kanji: [], grammar: [] };
    if (!query) return empty;

    const queryKana = toHiragana(query);
    const japanese = JAPANESE.test(query);
    const converted = looksLikeRomaji(query) ? romajiToHiragana(query.replace(/[\s'-]/g, '')) : null;
    const kana = converted && KANA_ONLY.test(converted) ? converted : null;
    const english = /[a-z]/.test(query);
    const sense = senseKey(query);
    const wholeWord = english ? new RegExp(`(^|[^a-z])${escapeRegExp(query)}($|[^a-z])`) : null;
    const kanjiOnly = KANJI_ONLY.test(query);

    // Candidate dictionary forms, keyed by form, from the query as typed and as romaji read.
    const deinflected = new Map<string, WordClass[]>();
    for (const text of [japanese ? queryKana : null, japanese && queryKana !== query ? query : null, kana]) {
        if (!text) continue;
        for (const candidate of deinflect(text)) {
            const classes = deinflected.get(candidate.form) ?? [];
            classes.push(candidate.wordClass);
            deinflected.set(candidate.form, classes);
        }
    }
    const fromConjugated = (form: string, wordClass: WordClass | null) =>
        deinflected.get(form)?.some(ruleClass => classFits(wordClass, ruleClass)) ?? false;

    const hits: { word: PreparedWord; tier: number }[] = [];
    for (const word of index.words) {
        let tier = 0;
        if (word.headword === query || word.reading === queryKana) tier = TIER.exact;
        else if (kana && word.reading === kana) tier = TIER.romaji;
        else if (deinflected.size > 0 && (fromConjugated(word.headword, word.wordClass) || fromConjugated(word.reading, word.wordClass))) tier = TIER.deinflected;
        else if (
            (japanese && (word.headword.startsWith(query) || word.reading.startsWith(queryKana)))
            || (kanjiOnly && word.headword.includes(query))
        ) tier = TIER.prefix;
        else if (english && word.senses.includes(sense)) tier = TIER.sense;
        else if (wholeWord?.test(word.gloss)) tier = TIER.glossWord;
        else if (kana && word.reading.startsWith(kana)) tier = TIER.romajiPrefix;
        else if (
            (japanese && (word.headword.includes(query) || word.reading.includes(queryKana)))
            || (english && word.gloss.includes(query))
        ) tier = TIER.substring;
        if (tier) hits.push({ word, tier });
    }
    hits.sort((a, b) =>
        a.tier - b.tier
        || Number(b.word.jlpt) - Number(a.word.jlpt)
        || Number(b.word.common) - Number(a.word.common)
        || a.word.rank - b.word.rank);

    const via = raw.trim();
    const words: WordHit[] = hits.map(({ word, tier }) => (tier === TIER.deinflected ? { row: word.row, tier, via } : { row: word.row, tier }));

    const kanji: SearchKanjiRow[] = [];
    for (const character of new Set(query)) {
        const row = KANJI_CHAR.test(character) ? index.kanji.get(character) : undefined;
        if (row) kanji.push(row);
    }

    return { query, kana, words, kanji, grammar: searchGrammar(index.grammar, query, kana, japanese, wholeWord) };
}

function searchGrammar(points: PreparedGrammar[], query: string, kana: string | null, japanese: boolean, wholeWord: RegExp | null): SearchGrammarRow[] {
    const key = grammarKey(query);
    if (!key) return [];
    const kanaKey = kana ?? (japanese ? toHiragana(key) : null);

    const hits: { row: SearchGrammarRow; tier: number; position: number }[] = [];
    points.forEach((point, position) => {
        let tier = 0;
        if (point.title === key || (kanaKey && point.title === kanaKey) || point.romaji === key) tier = 1;
        else if ((japanese && point.title.startsWith(key)) || (kana && point.title.startsWith(kana)) || (!japanese && point.romaji.startsWith(key))) tier = 2;
        else if ((japanese && point.title.includes(key)) || (kana && kana.length > 1 && point.title.includes(kana))) tier = 3;
        else if (wholeWord?.test(point.explanation)) tier = 4;
        if (tier) hits.push({ row: point.row, tier, position });
    });
    return hits.sort((a, b) => a.tier - b.tier || a.position - b.position).map(hit => hit.row);
}
