/**
 * The listening library's compiled data (`compiled/media/`), built by the
 * dataset's scripts/build-media.ts from Jiten snapshots. Mirrors the dataset's
 * own src/models/media.model.ts; see its docs/SCHEMA.md for the full contract.
 *
 * Only words that are Gokan vocabulary are listed (no particles, kana-only words
 * or loanwords yet), so every figure computed from `words` is coverage of an
 * episode's kanji vocabulary, not of everything said.
 */

/** A Gokan vocab id and how many times the episode uses it. */
export type MediaWordCount = [vocabId: string, occurrences: number];

export interface MediaEpisode {
    number: number;
    title: string;
    /** Morae per minute. 0 when unknown. */
    speechSpeed: number;
    /** Every word Jiten counted in the episode, Gokan vocabulary or not. */
    sourceUniqueWords: number;
    /** Gokan vocabulary only, most frequent first. */
    words: MediaWordCount[];
}

export interface MediaIndexEntry {
    id: string;
    kind: 'anime';
    title: { original: string; romaji?: string; english?: string };
    releaseYear?: number;
    episodeCount: number;
    /** Morae per minute across the series. 0 when unknown. */
    speechSpeed: number;
    /** Jiten's difficulty estimate, roughly 0 (easiest) to 5. */
    difficulty: number;
    links: { anilist?: string; myanimelist?: string };
    source: { name: 'Jiten'; url: string; license: 'CC BY-SA 4.0' };
}

export interface MediaTitle extends MediaIndexEntry {
    episodes: MediaEpisode[];
}

/**
 * The learner's own mark on one episode, stored in `UserProgress.watchedEpisodes`
 * under `episodeKey(mediaId, number)`.
 */
export interface WatchedEpisode {
    watched: boolean;
    /** Epoch ms of the last change; the newer side wins a Drive merge. */
    updatedAt: number;
    /** Share of the episode's vocabulary occurrences known when it was marked watched, 0..1. */
    coverageAtWatch?: number;
}
