import { Link } from "react-router-dom";

interface KanjiTileProps {
    glyph: string;
    /** Its page. A glyph with none (a component such as 氵) is drawn plain, not as a tile. */
    to?: string;
    /** A line under the glyph, e.g. whether the learner knows it. */
    caption?: string;
}

/**
 * One glyph as a tile: a word's kanji, a kanji's components. A box only when it is a link, so a
 * glyph with nowhere to go never looks clickable (DESIGN_SYSTEM.md, principle 7).
 */
export function KanjiTile({ glyph, to, caption }: KanjiTileProps) {
    const captionLine = caption && <span className="type-meta">{caption}</span>;
    if (!to) {
        return (
            <span className="flex flex-col items-center gap-1">
                <span className="w-12 h-12 flex items-center justify-center font-mincho text-2xl text-primary" lang="ja">{glyph}</span>
                {captionLine}
            </span>
        );
    }
    return (
        <Link to={to} className="flex flex-col items-center gap-1 group focus-visible:outline-none">
            <span
                className="w-12 h-12 flex items-center justify-center rounded-md border border-divider bg-surface font-mincho text-2xl text-primary group-hover:border-accent group-focus-visible:ring-2 group-focus-visible:ring-accent transition-colors"
                lang="ja"
            >
                {glyph}
            </span>
            {captionLine}
        </Link>
    );
}
