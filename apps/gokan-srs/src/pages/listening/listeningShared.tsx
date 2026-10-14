/** Small pieces shared by the listening library's pages and the Main hub's Listening card. */
import { useState } from "react";
import type { MediaIndexEntry } from "@gokan/dataset-schema";
import { coverSrcSet } from "../../utils/coverImage.utils";

/**
 * Coverage counts Gokan vocabulary only, which leaves out particles, kana-only
 * words and loanwords. Said on every page that shows a figure, so nobody reads
 * it as "I understand 80% of the episode".
 */
export function VocabularyOnlyNote({ className = '' }: { className?: string }) {
    return (
        <p className={`type-meta ${className}`}>
            Figures count kanji vocabulary only. Particles, kana-only words and loanwords are not included yet.
        </p>
    );
}

/**
 * Jiten's derived data is CC BY-SA 4.0, attribution required wherever it is
 * shown. Cover art is the studios', loaded from AniList, and credited to it.
 */
export function JitenCredit({ url = 'https://jiten.moe', className = '' }: { url?: string; className?: string }) {
    return (
        <p className={`type-meta ${className}`}>
            Episode vocabulary from{' '}
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Jiten</a>
            , licensed{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">CC BY-SA 4.0</a>.
            {' '}Cover images from{' '}
            <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">AniList</a>
            , artwork © its respective studio.
        </p>
    );
}

/**
 * Where a cover is placed: its width classes and the `sizes` that says the
 * same widths to the browser, side by side so one cannot change without the
 * other (a mismatch fetches the wrong file and fails nothing). Literal strings,
 * so Tailwind sees the classes; `sm` is Tailwind's 640px breakpoint. Not
 * `sizes="auto"`: browsers without it fall back to 100vw and fetch the 460px
 * file on phones.
 */
const COVER_SIZES = {
    hub: { width: 'w-10', sizes: '40px' },
    library: { width: 'w-14 sm:w-16', sizes: '(min-width: 640px) 64px, 56px' },
    title: { width: 'w-24 sm:w-32', sizes: '(min-width: 640px) 128px, 96px' },
} as const satisfies Record<string, { width: string; sizes: string }>;

export type MediaCoverSize = keyof typeof COVER_SIZES;

/**
 * A title's cover art, loaded from AniList's CDN. The box keeps the poster's
 * 2:3 shape and AniList's dominant colour while the image loads, and stays as
 * that plain colour if the image fails or the title has no cover, so a missing
 * image never collapses or reflows the layout around it.
 *
 * `size` names the placement, which sets both the box's width and the
 * `sizes` the browser uses to pick the smallest of AniList's files that fills
 * it. `className` is for layout only (`self-start`), never a width.
 */
export function MediaCover({ entry, size, className = '' }: {
    entry: Pick<MediaIndexEntry, 'cover' | 'title'>;
    size: MediaCoverSize;
    className?: string;
}) {
    const [failed, setFailed] = useState(false);
    const { cover } = entry;
    const { width, sizes } = COVER_SIZES[size];

    return (
        <div
            className={`aspect-[2/3] shrink-0 overflow-hidden rounded-sm border border-divider bg-surface-hover ${width} ${className}`}
            style={cover?.color ? { backgroundColor: cover.color } : undefined}
        >
            {cover && !failed && (
                <img
                    src={cover.url}
                    srcSet={coverSrcSet(cover)}
                    sizes={sizes}
                    alt={`${entry.title.original} cover`}
                    width={230}
                    height={345}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setFailed(true)}
                    className="h-full w-full object-cover"
                />
            )}
        </div>
    );
}
