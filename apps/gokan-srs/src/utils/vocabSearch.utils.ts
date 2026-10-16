import type { RomajiQuery, SearchIndex, SearchIndexEntry, Vocabulary } from '@gokan/dataset-schema';
import { containsWholeWord, readRomajiQuery, searchHeadword, toHiragana } from '@gokan/dataset-schema';

/** How many hits the header search shows. */
const VOCAB_SEARCH_LIMIT = 50;

/**
 * Lower ranks first: the word as shown, then an exact spelling, a prefix and a substring of the
 * query as typed, an English whole word in the gloss, a reading the romaji starts or contains,
 * and last a gloss containing the query. The romaji tiers come after the whole-word gloss: a
 * Latin query is more often an English word ("house", read ほうせ, the start of 宝石) than the
 * start of a reading. An exact romaji reading (Exact) stays first.
 */
const Rank = { Headword: 0, Exact: 1, Prefix: 2, Contains: 3, GlossWord: 4, RomajiPrefix: 5, RomajiContains: 6, Gloss: 7 } as const;
type Rank = typeof Rank[keyof typeof Rank];

type Hit = { entry: SearchIndexEntry; rank: Rank; length: number; position: number };
type FormRank = { rank: Rank; length: number };

/** A vocabulary search query: as typed (lowercase, trimmed), and as romaji read (readRomajiQuery). */
export interface VocabQuery {
    text: string;
    romaji: RomajiQuery | null;
}

/** The query every vocabulary search reads, or null when it is empty. */
export function readVocabQuery(query: string): VocabQuery | null {
    const text = query.toLowerCase().trim();
    return text ? { text, romaji: readRomajiQuery(text) } : null;
}

/** The best rank of the written form against the query as typed, with the length of the form that earned it. */
function writtenRank(form: string, q: string): FormRank | null {
    if (form === q) return { rank: Rank.Exact, length: form.length };
    if (form.startsWith(q)) return { rank: Rank.Prefix, length: form.length };
    if (form.includes(q)) return { rank: Rank.Contains, length: form.length };
    return null;
}

/** The best rank of the reading against the query as typed and as romaji read (in hiragana: コーヒー for "ko-hi-"). */
function readingRank(reading: string, q: string, romaji: RomajiQuery | null): FormRank | null {
    const typed = writtenRank(reading, q);
    if (typed || !romaji) return typed;
    const kana = toHiragana(reading);
    if (kana === romaji.kana) return { rank: Rank.Exact, length: reading.length };
    if (romaji.prefixes.some(prefix => kana.startsWith(prefix))) return { rank: Rank.RomajiPrefix, length: reading.length };
    if (kana.includes(romaji.kana)) return { rank: Rank.RomajiContains, length: reading.length };
    return null;
}

function rankEntry(entry: SearchIndexEntry, q: string, romaji: RomajiQuery | null): Omit<Hit, 'entry' | 'position'> | null {
    // The romaji's kana is a reading query: it is matched against the reading (and the
    // headword, which is the reading for a word learned in kana), never the written form.
    const headword = searchHeadword(entry);
    if (headword === q || toHiragana(headword) === romaji?.kana) return { rank: Rank.Headword, length: headword.length };

    const forms = [writtenRank(entry.w, q), readingRank(entry.r.toLowerCase(), q, romaji)]
        .filter((form): form is FormRank => form !== null);
    const gloss = entry.m.toLowerCase();
    // A Japanese match as typed beats the gloss; a whole-word gloss beats a romaji partial match.
    const best = forms.reduce<FormRank | null>((current, form) =>
        !current || form.rank < current.rank || (form.rank === current.rank && form.length < current.length) ? form : current, null);
    if (best && best.rank <= Rank.Contains) return best;
    if (containsWholeWord(gloss, q)) return { rank: Rank.GlossWord, length: 0 };
    if (best) return best;
    return gloss.includes(q) ? { rank: Rank.Gloss, length: 0 } : null;
}

/**
 * The header search's hits, best first. search.json is in kanji-spelling order, so slicing it
 * in file order buried する (為る, entry 18,213) behind every compound containing it. Japanese
 * matches rank by how closely the word matches (see Rank), then shorter forms first, then index
 * order; English gloss matches rank in index order.
 */
export function rankVocabSearch(index: SearchIndex, query: string, limit = VOCAB_SEARCH_LIMIT): SearchIndex {
    const read = readVocabQuery(query);
    if (!read) return [];

    const hits: Hit[] = [];
    index.forEach((entry, position) => {
        const ranked = rankEntry(entry, read.text, read.romaji);
        if (ranked) hits.push({ entry, position, ...ranked });
    });
    hits.sort((a, b) => a.rank - b.rank || a.length - b.length || a.position - b.position);
    return hits.slice(0, limit).map(hit => hit.entry);
}

/**
 * The vocabulary list's filter (/vocab): a word the header search would find for the same
 * query (written form, reading as typed or as romaji read, gloss), kept in the list's own order.
 */
export function matchesVocabQuery(word: Pick<Vocabulary, 'writtenForm' | 'reading' | 'senses'>, query: VocabQuery): boolean {
    return writtenRank(word.writtenForm.kanji, query.text) !== null
        || readingRank(word.reading.primary.toLowerCase(), query.text, query.romaji) !== null
        || word.senses.some(sense => sense.glosses.some(gloss => gloss.toLowerCase().includes(query.text)));
}
