import { describe, expect, it } from 'vitest';
import { coverSrcSet, type MediaCoverUrls } from './coverImage.utils';

const CDN = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover';

function cover(overrides: Partial<MediaCoverUrls> = {}): MediaCoverUrls {
    return { urlSmall: `${CDN}/small/a.jpg`, url: `${CDN}/medium/a.jpg`, urlHiRes: `${CDN}/large/a.jpg`, source: 'AniList', ...overrides };
}

describe('coverSrcSet', () => {
    it("lists AniList's three widths, smallest first", () => {
        expect(coverSrcSet(cover())).toBe(`${CDN}/small/a.jpg 100w, ${CDN}/medium/a.jpg 230w, ${CDN}/large/a.jpg 460w`);
    });

    it('leaves out a size AniList lacks instead of listing the 230px file at another width', () => {
        const only = `${CDN}/medium/b.jpg`;
        expect(coverSrcSet(cover({ urlSmall: only, url: only, urlHiRes: only }))).toBe(`${only} 230w`);
        expect(coverSrcSet(cover({ urlHiRes: `${CDN}/medium/a.jpg` }))).toBe(`${CDN}/small/a.jpg 100w, ${CDN}/medium/a.jpg 230w`);
    });
});
