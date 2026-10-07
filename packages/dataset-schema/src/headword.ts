import type { SearchIndexEntry } from './indexes';
import type { Vocabulary } from './vocabulary';

/**
 * The spelling a word is shown and learned by. A word learned in kana
 * (`usuallyKana`) is shown by its reading: ここ, never its rare kanji spelling 此処,
 * which stays in `writtenForm.kanji` for an "also written" note. Every place that
 * names a word to the learner goes through this, so the two apps cannot disagree.
 */
export function headwordOf(vocab: Pick<Vocabulary, 'writtenForm' | 'reading' | 'usuallyKana'>): string {
    return vocab.usuallyKana ? vocab.reading.primary : vocab.writtenForm.kanji;
}

/**
 * The spelling shown beside the headword: its reading (日本 にほん), or for a word
 * learned in kana, whose headword already is its reading, its kanji spelling
 * (ここ 此処), so the learner still meets that spelling.
 */
export function secondaryForm(vocab: Pick<Vocabulary, 'writtenForm' | 'reading' | 'usuallyKana'>): string {
    return vocab.usuallyKana ? vocab.writtenForm.kanji : vocab.reading.primary;
}

/** secondaryForm for a compact search-index row. */
export function searchSecondaryForm(entry: Pick<SearchIndexEntry, 'w' | 'r' | 'u'>): string {
    return entry.u ? entry.w : entry.r;
}

/** The headword with its reading in parentheses, "日本 (にほん)", or the reading alone when they are the same word ("ここ"). */
export function headwordWithReading(vocab: Pick<Vocabulary, 'writtenForm' | 'reading' | 'usuallyKana'>): string {
    const headword = headwordOf(vocab);
    return headword === vocab.reading.primary ? headword : `${headword} (${vocab.reading.primary})`;
}

/** headwordOf for a compact search-index row. */
export function searchHeadword(entry: Pick<SearchIndexEntry, 'w' | 'r' | 'u'>): string {
    return entry.u ? entry.r : entry.w;
}
