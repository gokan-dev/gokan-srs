// The one search matcher, shared by both apps: gokan-srs's header search and vocabulary filter,
// and the dictionary's header panel, /search/ page and build-time acceptance check. Each app only
// loads its index and renders the results; what matches a query, and in which order, is here.
//
// A query is read every way a learner might have meant it: as written (kanji or kana, katakana
// and hiragana compared as equal), as romaji converted to kana ("taberu"), as a conjugated form
// (食べた, when the app gives a deinflector) and against the glosses in the index's language:
// English, or Chinese in a dictionary locale whose glosses are Chinese (#170), each queried in its
// own script. It finds words, kanji (by character, English meaning, on and kun reading) and
// grammar points (by title, romaji and a word of their explanation), each group ranked apart.

import { containsWholeWord } from './wholeWord';
import { kanaToHepburn, readRomajiQuery, toHiragana } from './romaji';

/** The language of an index's word glosses: what a gloss query is read in. */
export type SearchGlossLanguage = 'en' | 'zh-hans';

/** A word's match tiers, best first. Within a tier: see `compareWords`. */
export const WORD_TIER = {
    /** A written form or the reading itself. */
    exact: 1,
    /** The reading the romaji converts to. */
    romaji: 2,
    /** The dictionary form of a conjugated query (食べた). */
    deinflected: 3,
    /** A written form or the reading starts with the query. */
    prefix: 4,
    /** For a query of kanji only, a written form that contains it (生 in 先生). */
    compound: 5,
    /** A sense equal to the query: in English ignoring a leading "to" or article, in Chinese one of its comma-separated glosses. */
    sense: 6,
    /** The query as a whole word in an English gloss. */
    glossWord: 7,
    /**
     * The reading starts with the romaji's kana, its last syllable possibly unfinished
     * (romajiReadingPrefixes: "taber" for たべる). After the English tiers: a Latin query that
     * converts is more often an English word ("house", read ほうせ) than the start of a reading.
     */
    romajiPrefix: 8,
    /** The query anywhere in a written form, the reading or the gloss. */
    substring: 9,
    /** The romaji's kana anywhere in the reading. */
    romajiContains: 10,
} as const;

/** A kanji's match tiers, best first; within one, JLPT kanji (easiest level first), then frequency. */
export const KANJI_TIER = {
    /** The kanji is in the query, in the query's order. */
    character: 1,
    /** One of its English meanings equals the query. */
    meaning: 2,
    /** One of its on or kun readings is the query's kana, typed or read from romaji. */
    reading: 3,
    /** The query as a whole word of one of its meanings. */
    meaningWord: 4,
} as const;

/** A grammar point's match tiers, best first; within one, the index's (teaching) order. */
export const GRAMMAR_TIER = {
    /** The title (with or without its placeholders) or the romaji is the query. */
    exact: 1,
    prefix: 2,
    contains: 3,
    /** A Latin query as whole words of the title read in romaji ("te form" for て-form). */
    titleWords: 4,
    /** The query as a whole word of the short explanation. */
    explanation: 5,
} as const;

export type SearchGroup = 'words' | 'kanji' | 'grammar';

/** What a word is matched on. `forms` and `reading` may be katakana or hiragana: they are compared as hiragana. */
export interface SearchWordInput<W, C extends string = string> {
    row: W;
    /** Its written forms, the one shown first (the kana, for a word learned in kana), then its other spellings. */
    forms: readonly string[];
    /** Its kana reading. */
    reading: string;
    /** Its glosses in the index's language, as one text (English senses separated by "; "). */
    gloss: string;
    jlpt?: boolean;
    common?: boolean;
    /** Its conjugation class, for the deinflector. */
    wordClass?: C | null;
}

export interface SearchKanjiInput<K> {
    row: K;
    character: string;
    /** English, the main meaning first. */
    meanings: readonly string[];
    /** As KANJIDIC writes them: on in katakana, kun in hiragana with "." before the okurigana, "-" for an affix. */
    readings: readonly string[];
    /** JLPT level, 0 for none. */
    jlpt: number;
    /** Frequency rank, 0 for none. */
    frequency: number;
}

export interface SearchGrammarInput<G> {
    row: G;
    title: string;
    romaji: string;
    explanation: string;
}

/** The dictionary forms a conjugated query may come from, and whether a word's class fits a rule's. */
export interface Deinflector<C extends string> {
    candidates(text: string): readonly { form: string; wordClass: C }[];
    fits(wordClass: C | null, ruleClass: C): boolean;
}

export interface SearchOptions<C extends string> {
    /** The words' gloss language; English by default. */
    glosses?: SearchGlossLanguage;
    /**
     * Words come in frequency order (a word's position is its rank), so within a tier they keep
     * it. Otherwise (gokan-srs's index, in kanji-spelling order) a shorter matching form ranks
     * first, then position: in file order する (為る) came after every compound containing it.
     */
    frequencyOrdered?: boolean;
    deinflector?: Deinflector<C>;
}

interface PreparedWord<W, C extends string> {
    row: W;
    position: number;
    /** Lowercased, for a Latin spelling (Tシャツ). */
    forms: string[];
    /** The shown form in hiragana. */
    shownKana: string;
    /** In hiragana, so katakana and hiragana compare equal. */
    reading: string;
    gloss: string;
    senses: string[];
    wordClass: C | null;
    jlpt: boolean;
    common: boolean;
}

interface PreparedKanji<K> {
    row: K;
    position: number;
    character: string;
    meanings: string[];
    meaningKeys: string[];
    /** Every reading in hiragana: on, kun with and without its okurigana. */
    readings: Set<string>;
    jlpt: number;
    frequency: number;
}

interface PreparedGrammar<G> {
    row: G;
    position: number;
    title: string;
    /** The title's Japanese alone, without its English placeholders ("Verb てから～" is てから); '' for none. */
    pattern: string;
    romaji: string;
    /** The title read in romaji, as words ("te form na adjective de"). */
    romanized: string;
    explanation: string;
}

export interface PreparedSearch<W, K, G, C extends string = string> {
    glosses: SearchGlossLanguage;
    frequencyOrdered: boolean;
    deinflector: Deinflector<C> | null;
    words: PreparedWord<W, C>[];
    kanji: PreparedKanji<K>[];
    kanjiByCharacter: Map<string, PreparedKanji<K>>;
    grammar: PreparedGrammar<G>[];
}

export interface WordHit<W> {
    row: W;
    tier: number;
    /** The conjugated form the query was read as, for "食べる, from 食べた". */
    via?: string;
}

export interface SearchResults<W, K, G> {
    /** The normalised query. */
    query: string;
    /** The kana a romaji query was read as, or null. */
    kana: string | null;
    words: WordHit<W>[];
    kanji: K[];
    grammar: G[];
    /** The order the groups are shown in: words first, unless the query is one kanji or a grammar title. */
    groups: SearchGroup[];
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
    return text.normalize('NFKC').toLowerCase().replace(/[～〜~、。,.・/()（）+:：\s]/g, '');
}

const JAPANESE = /[぀-ヿ㐀-鿿々]/;
const KANJI_ONLY = /^[㐀-鿿々]+$/;
const KANJI_CHAR = /[㐀-鿿々]/;
const KANA_ONLY = /^[ぁ-ゖー]+$/;

/**
 * A Chinese gloss as compared, after NFKC (as the query is): its glosses, split at the dataset's
 * separators (，；、 and a closing 。, NFKC turning the full-width comma and semicolon into ASCII),
 * each without its parenthesised notes ("(行为)过火").
 */
function chineseSenses(gloss: string): string[] {
    return gloss.replace(/\([^)]*\)/g, '').split(/[,;、。]/).map(part => part.trim()).filter(part => part !== '');
}

/** Whether a query is in the script of the index's glosses: Latin for English, Han for Chinese. */
function inGlossScript(query: string, glosses: SearchGlossLanguage): boolean {
    switch (glosses) {
        case 'en': return /[a-z]/.test(query);
        case 'zh-hans': return KANJI_CHAR.test(query);
    }
}

function prepareWord<W, C extends string>(word: SearchWordInput<W, C>, position: number, glosses: SearchGlossLanguage): PreparedWord<W, C> {
    const gloss = glosses === 'en' ? word.gloss.toLowerCase() : word.gloss.normalize('NFKC').toLowerCase();
    const forms = [...new Set(word.forms.map(form => form.toLowerCase()))];
    return {
        row: word.row,
        position,
        forms,
        shownKana: toHiragana(forms[0] ?? ''),
        reading: toHiragana(word.reading.toLowerCase()),
        gloss,
        senses: glosses === 'en' ? word.gloss.split('; ').map(senseKey) : chineseSenses(gloss),
        wordClass: word.wordClass ?? null,
        jlpt: word.jlpt ?? false,
        common: word.common ?? false,
    };
}

/** A kun reading's forms in hiragana: whole (まなぶ for まな.ぶ) and its stem (まな), without affix marks. */
function readingForms(reading: string): string[] {
    const plain = toHiragana(reading.replace(/-/g, ''));
    const [stem] = plain.split('.');
    return [plain.replace(/\./g, ''), stem];
}

function prepareGrammar<G>(point: SearchGrammarInput<G>, position: number): PreparedGrammar<G> {
    const title = grammarKey(point.title);
    return {
        row: point.row,
        position,
        title,
        pattern: JAPANESE.test(title) ? title.replace(/[a-z0-9-]/g, '') : '',
        romaji: grammarKey(point.romaji),
        romanized: kanaToHepburn(point.title.normalize('NFKC')).toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim(),
        explanation: point.explanation.toLowerCase(),
    };
}

/** Words in the index's order; the kanji (one row each) and the grammar points, in theirs. */
export function prepareSearch<W, K, G, C extends string = string>(
    input: { words: Iterable<SearchWordInput<W, C>>; kanji?: Iterable<SearchKanjiInput<K>>; grammar?: Iterable<SearchGrammarInput<G>> },
    options: SearchOptions<C> = {},
): PreparedSearch<W, K, G, C> {
    const glosses = options.glosses ?? 'en';
    const words: PreparedWord<W, C>[] = [];
    for (const word of input.words) words.push(prepareWord(word, words.length, glosses));
    const kanjiByCharacter = new Map<string, PreparedKanji<K>>();
    for (const entry of input.kanji ?? []) {
        if (kanjiByCharacter.has(entry.character)) continue;
        kanjiByCharacter.set(entry.character, {
            row: entry.row,
            position: kanjiByCharacter.size,
            character: entry.character,
            meanings: entry.meanings.map(meaning => meaning.toLowerCase()),
            meaningKeys: entry.meanings.map(senseKey),
            readings: new Set(entry.readings.flatMap(readingForms).filter(reading => reading !== '')),
            jlpt: entry.jlpt,
            frequency: entry.frequency,
        });
    }
    const grammar: PreparedGrammar<G>[] = [];
    for (const point of input.grammar ?? []) grammar.push(prepareGrammar(point, grammar.length));
    return {
        glosses,
        frequencyOrdered: options.frequencyOrdered ?? false,
        deinflector: options.deinflector ?? null,
        words,
        kanji: [...kanjiByCharacter.values()],
        kanjiByCharacter,
        grammar,
    };
}

/** A query as every group reads it. */
export interface SearchQuery {
    /** Normalised (normalizeQuery). */
    text: string;
    /** As typed, in hiragana. */
    typedKana: string;
    japanese: boolean;
    /** Has a Latin letter. */
    latin: boolean;
    kanjiOnly: boolean;
    /** The kana the query reads as romaji, when all of it converts; null otherwise. */
    romajiKana: string | null;
    /** What a reading may start with when the romaji stops partway through a syllable ("taber"). */
    romajiPrefixes: string[];
}

/** The query every search reads, or null when it is blank. */
export function readSearchQuery(raw: string): SearchQuery | null {
    const text = normalizeQuery(raw);
    if (!text) return null;
    // Read as every search reads romaji (spaces dropped, "-" as ー, "'" only after n).
    const romaji = readRomajiQuery(text);
    return {
        text,
        typedKana: toHiragana(text),
        japanese: JAPANESE.test(text),
        latin: /[a-z]/.test(text),
        kanjiOnly: KANJI_ONLY.test(text),
        romajiKana: romaji && KANA_ONLY.test(romaji.kana) ? romaji.kana : null,
        romajiPrefixes: romaji?.prefixes ?? [],
    };
}

interface WordContext<C extends string> {
    query: SearchQuery;
    glossQuery: boolean;
    sense: string;
    glossWholeWord: boolean;
    /** Candidate dictionary forms, keyed by form, from the query as typed and as romaji read. */
    deinflected: Map<string, C[]>;
    deinflector: Deinflector<C> | null;
}

function wordContext<C extends string>(query: SearchQuery, glosses: SearchGlossLanguage, deinflector: Deinflector<C> | null): WordContext<C> {
    const deinflected = new Map<string, C[]>();
    if (deinflector) {
        const { text, typedKana, japanese, romajiKana } = query;
        for (const form of [japanese ? typedKana : null, japanese && typedKana !== text ? text : null, romajiKana]) {
            if (!form) continue;
            for (const candidate of deinflector.candidates(form)) {
                const classes = deinflected.get(candidate.form) ?? [];
                classes.push(candidate.wordClass);
                deinflected.set(candidate.form, classes);
            }
        }
    }
    return {
        query,
        glossQuery: inGlossScript(query.text, glosses),
        sense: glosses === 'en' ? senseKey(query.text) : query.text,
        glossWholeWord: glosses === 'en' && query.latin,
        deinflected,
        deinflector,
    };
}

interface WordMatch {
    tier: number;
    /** The length of the shortest form that earned the tier, 0 for a gloss match. */
    length: number;
}

const shortest = (forms: string[]): number => Math.min(...forms.map(form => form.length));

function matchWord<W, C extends string>(word: PreparedWord<W, C>, context: WordContext<C>): WordMatch | null {
    const { text, typedKana, japanese, kanjiOnly, romajiKana, romajiPrefixes } = context.query;
    const { forms, reading } = word;
    const match = (tier: number, matched: string[]): WordMatch => ({ tier, length: shortest(matched) });

    const exact = forms.filter(form => form === text || toHiragana(form) === typedKana);
    if (exact.length > 0 || reading === typedKana) return match(WORD_TIER.exact, reading === typedKana ? [...exact, reading] : exact);
    if (romajiKana && reading === romajiKana) return match(WORD_TIER.romaji, [reading]);
    if (context.deinflector && context.deinflected.size > 0) {
        const { deinflector } = context;
        const fromConjugated = (form: string) => context.deinflected.get(form)?.some(rule => deinflector.fits(word.wordClass, rule)) ?? false;
        const headword = forms[0] ?? '';
        if (fromConjugated(headword) || fromConjugated(reading)) return match(WORD_TIER.deinflected, [headword]);
    }
    if (japanese) {
        const prefixed = forms.filter(form => form.startsWith(text));
        if (reading.startsWith(typedKana)) prefixed.push(reading);
        if (prefixed.length > 0) return match(WORD_TIER.prefix, prefixed);
    }
    if (kanjiOnly) {
        const containing = forms.filter(form => form.includes(text));
        if (containing.length > 0) return match(WORD_TIER.compound, containing);
    }
    if (context.glossQuery && word.senses.includes(context.sense)) return { tier: WORD_TIER.sense, length: 0 };
    if (context.glossWholeWord && containsWholeWord(word.gloss, text)) return { tier: WORD_TIER.glossWord, length: 0 };
    if (romajiPrefixes.some(prefix => reading.startsWith(prefix))) return match(WORD_TIER.romajiPrefix, [reading]);
    if (japanese) {
        const containing = forms.filter(form => form.includes(text));
        if (reading.includes(typedKana)) containing.push(reading);
        if (containing.length > 0) return match(WORD_TIER.substring, containing);
    }
    if (context.glossQuery && word.gloss.includes(text)) return { tier: WORD_TIER.substring, length: 0 };
    if (romajiKana && reading.includes(romajiKana)) return match(WORD_TIER.romajiContains, [reading]);
    return null;
}

/** Whether the word is shown as the query: its headword, typed or read from romaji. */
function isShownAs<W, C extends string>(word: PreparedWord<W, C>, query: SearchQuery): boolean {
    return word.forms[0] === query.text || word.shownKana === query.typedKana || (query.romajiKana !== null && word.shownKana === query.romajiKana);
}

/**
 * Whether a word is found by the query at all, at any tier: gokan-srs's vocabulary list filters
 * by it, keeping its own order.
 */
export function matchesSearchWord<W, C extends string = string>(word: SearchWordInput<W, C>, query: SearchQuery, options: SearchOptions<C> = {}): boolean {
    const glosses = options.glosses ?? 'en';
    return matchWord(prepareWord(word, 0, glosses), wordContext(query, glosses, options.deinflector ?? null)) !== null;
}

function searchWords<W, K, G, C extends string>(index: PreparedSearch<W, K, G, C>, query: SearchQuery, raw: string): WordHit<W>[] {
    const context = wordContext(query, index.glosses, index.deinflector);
    const hits: { word: PreparedWord<W, C>; shown: boolean; match: WordMatch }[] = [];
    for (const word of index.words) {
        const match = matchWord(word, context);
        if (match) hits.push({ word, shown: isShownAs(word, query), match });
    }
    // Within a tier: JLPT words, then common words, then the word shown as the query (する for
    // 為る), then (in an index not in frequency order) the shorter form, then the index's order.
    hits.sort((a, b) =>
        a.match.tier - b.match.tier
        || Number(b.word.jlpt) - Number(a.word.jlpt)
        || Number(b.word.common) - Number(a.word.common)
        || Number(b.shown) - Number(a.shown)
        || (index.frequencyOrdered ? 0 : a.match.length - b.match.length)
        || a.word.position - b.word.position);
    const via = raw.trim();
    return hits.map(({ word, match }) => (match.tier === WORD_TIER.deinflected ? { row: word.row, tier: match.tier, via } : { row: word.row, tier: match.tier }));
}

function matchKanji<K>(kanji: PreparedKanji<K>, query: SearchQuery, sense: string): number {
    const { text, typedKana, latin, romajiKana } = query;
    if (latin && kanji.meaningKeys.includes(sense)) return KANJI_TIER.meaning;
    if ((KANA_ONLY.test(typedKana) && kanji.readings.has(typedKana)) || (romajiKana !== null && kanji.readings.has(romajiKana))) return KANJI_TIER.reading;
    if (latin && kanji.meanings.some(meaning => containsWholeWord(meaning, text))) return KANJI_TIER.meaningWord;
    return 0;
}

function searchKanji<W, K, G, C extends string>(index: PreparedSearch<W, K, G, C>, query: SearchQuery): K[] {
    // The kanji of the query first, in its order.
    const own: PreparedKanji<K>[] = [];
    for (const character of new Set(query.text)) {
        const entry = KANJI_CHAR.test(character) ? index.kanjiByCharacter.get(character) : undefined;
        if (entry) own.push(entry);
    }
    const ownSet = new Set(own);
    const sense = senseKey(query.text);
    const hits: { kanji: PreparedKanji<K>; tier: number }[] = [];
    for (const kanji of index.kanji) {
        if (ownSet.has(kanji)) continue;
        const tier = matchKanji(kanji, query, sense);
        if (tier) hits.push({ kanji, tier });
    }
    const frequency = (kanji: PreparedKanji<K>) => kanji.frequency || Number.MAX_SAFE_INTEGER;
    hits.sort((a, b) =>
        a.tier - b.tier
        || Number(b.kanji.jlpt > 0) - Number(a.kanji.jlpt > 0)
        || b.kanji.jlpt - a.kanji.jlpt
        || frequency(a.kanji) - frequency(b.kanji)
        || a.kanji.position - b.kanji.position);
    return [...own, ...hits.map(hit => hit.kanji)].map(kanji => kanji.row);
}

function searchGrammar<W, K, G, C extends string>(index: PreparedSearch<W, K, G, C>, query: SearchQuery): { rows: G[]; exactTitle: boolean } {
    const key = grammarKey(query.text);
    if (!key) return { rows: [], exactTitle: false };
    const { japanese, latin, romajiKana: kana } = query;
    const kanaKey = kana ?? (japanese ? toHiragana(key) : null);
    const titleIs = (point: PreparedGrammar<G>, value: string) => point.title === value || point.pattern === value;

    const hits: { row: G; tier: number; position: number }[] = [];
    for (const point of index.grammar) {
        let tier = 0;
        if (titleIs(point, key) || (kanaKey !== null && titleIs(point, kanaKey)) || point.romaji === key) tier = GRAMMAR_TIER.exact;
        else if (
            (japanese && (point.title.startsWith(key) || point.pattern.startsWith(key)))
            || (kana !== null && (point.title.startsWith(kana) || point.pattern.startsWith(kana)))
            || (!japanese && point.romaji.startsWith(key))
        ) tier = GRAMMAR_TIER.prefix;
        else if ((japanese && point.title.includes(key)) || (kana !== null && kana.length > 1 && point.title.includes(kana))) tier = GRAMMAR_TIER.contains;
        else if (latin && containsWholeWord(point.romanized, query.text)) tier = GRAMMAR_TIER.titleWords;
        else if (latin && containsWholeWord(point.explanation, query.text)) tier = GRAMMAR_TIER.explanation;
        if (tier) hits.push({ row: point.row, tier, position: point.position });
    }
    hits.sort((a, b) => a.tier - b.tier || a.position - b.position);
    return { rows: hits.map(hit => hit.row), exactTitle: hits[0]?.tier === GRAMMAR_TIER.exact };
}

/** Every match for `raw`, best first, grouped as words, kanji and grammar, with the order to show the groups in. */
export function runSearch<W, K, G, C extends string = string>(index: PreparedSearch<W, K, G, C>, raw: string): SearchResults<W, K, G> {
    const query = readSearchQuery(raw);
    if (!query) return { query: '', kana: null, words: [], kanji: [], grammar: [], groups: ['words', 'kanji', 'grammar'] };
    const words = searchWords(index, query, raw);
    const kanji = searchKanji(index, query);
    const grammar = searchGrammar(index, query);
    const groups: SearchGroup[] = query.kanjiOnly && query.text.length === 1 && kanji.length > 0
        ? ['kanji', 'words', 'grammar']
        : grammar.exactTitle ? ['grammar', 'words', 'kanji'] : ['words', 'kanji', 'grammar'];
    return { query: query.text, kana: query.romajiKana, words, kanji, grammar: grammar.rows, groups };
}
