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
    /** Genre names, e.g. "Comedy", "Slice of Life". */
    genres: string[];
    /** Up to five of Jiten's strongest community tags, e.g. "Cute Girls Doing Cute Things". */
    tags: string[];
    /**
     * Cover art on AniList's CDN (URLs only, the dataset never holds the images).
     * The artwork belongs to its studio; it is shown loaded from AniList and
     * credited, never bundled. `url` ~230px for cards, `urlHiRes` ~460px.
     */
    cover?: { url: string; urlHiRes: string; color?: string; source: 'AniList' };
    source: { name: 'Jiten'; url: string; license: 'CC BY-SA 4.0' };
}

/** `compiled/media/library.json`: each title's whole-series word list, so the library can be ranked without loading every title file. */
export type MediaLibraryWords = Record<string, MediaWordCount[]>;

export interface MediaTitle extends MediaIndexEntry {
    episodes: MediaEpisode[];
}
