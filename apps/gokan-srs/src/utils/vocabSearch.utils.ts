import type { SearchIndex, SearchIndexEntry } from '@gokan/dataset-schema';
import { looksLikeRomaji, romajiToHiragana, searchHeadword } from '@gokan/dataset-schema';

/** How many hits the header search shows. */
const VOCAB_SEARCH_LIMIT = 50;

/** Lower ranks first: the word as shown, then an exact spelling, a prefix, a substring, and last the gloss. */
const Rank = { Headword: 0, Exact: 1, Prefix: 2, Contains: 3, Gloss: 4 } as const;
type Rank = typeof Rank[keyof typeof Rank];

type Hit = { entry: SearchIndexEntry; rank: Rank; length: number; position: number };

/** The best rank of a Japanese form against the queries, with the length of the form that earned it. */
function formRank(form: string, queries: readonly string[]): { rank: Rank; length: number } | null {
    if (queries.includes(form)) return { rank: Rank.Exact, length: form.length };
    if (queries.some(q => form.startsWith(q))) return { rank: Rank.Prefix, length: form.length };
    if (queries.some(q => form.includes(q))) return { rank: Rank.Contains, length: form.length };
    return null;
}

function rankEntry(entry: SearchIndexEntry, q: string, kanaQuery: string | null): Omit<Hit, 'entry' | 'position'> | null {
    // The romaji's kana is a reading query: it is matched against the reading (and the
    // headword, which is the reading for a word learned in kana), never the written form.
    const readingQueries = kanaQuery !== null && kanaQuery !== q ? [q, kanaQuery] : [q];
    const headword = searchHeadword(entry);
    if (readingQueries.includes(headword)) return { rank: Rank.Headword, length: headword.length };

    const forms = [formRank(entry.w, [q]), formRank(entry.r.toLowerCase(), readingQueries)]
        .filter((form): form is { rank: Rank; length: number } => form !== null);
    if (forms.length > 0) {
        return forms.reduce((best, form) =>
            form.rank < best.rank || (form.rank === best.rank && form.length < best.length) ? form : best);
    }
    return entry.m.toLowerCase().includes(q) ? { rank: Rank.Gloss, length: 0 } : null;
}

/**
 * The header search's hits, best first. search.json is in kanji-spelling order, so slicing it
 * in file order buried する (為る, entry 18,213) behind every compound containing it. Japanese
 * matches rank by how closely the word matches (shown form, exact, prefix, substring), then
 * shorter forms first, then index order; English gloss matches follow in index order.
 */
export function rankVocabSearch(index: SearchIndex, query: string, limit = VOCAB_SEARCH_LIMIT): SearchIndex {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const kanaQuery = looksLikeRomaji(q) ? romajiToHiragana(q) : null;

    const hits: Hit[] = [];
    index.forEach((entry, position) => {
        const ranked = rankEntry(entry, q, kanaQuery);
        if (ranked) hits.push({ entry, position, ...ranked });
    });
    hits.sort((a, b) => a.rank - b.rank || a.length - b.length || a.position - b.position);
    return hits.slice(0, limit).map(hit => hit.entry);
}
