import { Link } from "react-router-dom";

interface KanjiTileProps {
    glyph: string;
    /** Its page. A glyph with none (a component such as 氵) is drawn plain, not as a tile. */
    to?: string;
    /** A line under the glyph (beside it when small), e.g. whether the learner knows it. */
    caption?: string;
    /** `sm` (32px, the caption beside it): a word's kanji inline in its page's header. */
    size?: 'md' | 'sm';
}

const BOX = {
    md: 'w-12 h-12 text-2xl',
    sm: 'w-8 h-8 text-lg',
};

/**
 * One glyph as a tile: a word's kanji, a kanji's components. A box only when it is a link, so a
 * glyph with nowhere to go never looks clickable (DESIGN_SYSTEM.md, principle 7).
 */
export function KanjiTile({ glyph, to, caption, size = 'md' }: KanjiTileProps) {
    const layout = size === 'sm' ? 'flex items-center gap-2' : 'flex flex-col items-center gap-1';
    const captionLine = caption && <span className="type-meta">{caption}</span>;
    if (!to) {
        return (
            <span className={layout}>
                <span className={`${BOX[size]} flex items-center justify-center font-mincho text-primary`} lang="ja">{glyph}</span>
                {captionLine}
            </span>
        );
    }
    return (
        <Link to={to} className={`${layout} group focus-visible:outline-none`}>
            <span
                className={`${BOX[size]} flex items-center justify-center rounded-md border border-divider bg-surface font-mincho text-primary group-hover:border-accent group-focus-visible:ring-2 group-focus-visible:ring-accent transition-colors`}
                lang="ja"
            >
                {glyph}
            </span>
            {captionLine}
        </Link>
    );
}
