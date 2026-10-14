import type { MediaIndexEntry } from '@gokan/dataset-schema';

export type MediaCoverUrls = NonNullable<MediaIndexEntry['cover']>;

/**
 * A cover's `srcset`: AniList's three fixed widths, so the browser fetches the
 * smallest one that fills the box at the screen's pixel density (a 40px hub
 * thumbnail takes the 100px file, not the 230px one). A size AniList lacks
 * repeats `url` in the dataset; it is left out rather than listed at a width
 * the file does not have.
 */
export function coverSrcSet(cover: MediaCoverUrls): string {
    const sources: [url: string, width: number][] = [
        [cover.urlSmall, 100],
        [cover.url, 230],
        [cover.urlHiRes, 460],
    ];
    return sources
        .filter(([url, width]) => width === 230 || url !== cover.url)
        .map(([url, width]) => `${url} ${width}w`)
        .join(', ');
}
