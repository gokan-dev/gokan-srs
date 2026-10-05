/** Small pieces shared by the listening library's pages and the Main hub's Listening card. */
import { useState } from "react";
import type { MediaIndexEntry } from "../../models/media.model";

/**
 * Coverage counts Gokan vocabulary only, which leaves out particles, kana-only
 * words and loanwords. Said on every page that shows a figure, so nobody reads
 * it as "I understand 80% of the episode".
 */
export function VocabularyOnlyNote({ className = '' }: { className?: string }) {
    return (
        <p className={`font-gothic text-xs text-tertiary ${className}`}>
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
        <p className={`font-gothic text-xs text-tertiary ${className}`}>
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
 * A title's cover art, loaded from AniList's CDN. The box keeps the poster's
 * 2:3 shape and AniList's dominant colour while the image loads, and stays as
 * that plain colour if the image fails or the title has no cover, so a missing
 * image never collapses or reflows the layout around it.
 */
export function MediaCover({ entry, hiRes = false, className = '' }: {
    entry: Pick<MediaIndexEntry, 'cover' | 'title'>;
    hiRes?: boolean;
    className?: string;
}) {
    const [failed, setFailed] = useState(false);
    const src = entry.cover ? (hiRes ? entry.cover.urlHiRes : entry.cover.url) : null;

    return (
        <div
            className={`aspect-[2/3] shrink-0 overflow-hidden rounded border border-divider bg-surface-hover ${className}`}
            style={entry.cover?.color ? { backgroundColor: entry.cover.color } : undefined}
        >
            {src && !failed && (
                <img
                    src={src}
                    alt={`${entry.title.original} cover`}
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
