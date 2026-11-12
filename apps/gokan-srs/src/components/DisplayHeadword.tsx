import type { CSSProperties, ReactNode } from "react";

interface DisplayHeadwordProps {
    /** The headword as shown: its character count sets the size it is drawn at. */
    headword: string;
    children: ReactNode;
    className?: string;
    onClick?: () => void;
}

/** The custom property `.text-kanji` divides its container's width by (index.css). */
type FitStyle = CSSProperties & { '--headword-chars': number };

/**
 * A headword at display size (`text-kanji`: 4rem on a phone, 8rem from md), scaled down so it
 * fits its card on one line (issue 239). Its parts are inline text, never flex items: a flex item
 * shrinks to its min-content width, which for kana is one character, so a headword wider than
 * its card stacked its trailing kana one per line (乗り換える). The size is the card's width
 * over the character count, each Japanese character being one em wide.
 */
export function DisplayHeadword({ headword, children, className = '', onClick }: DisplayHeadwordProps) {
    const style: FitStyle = { '--headword-chars': Math.max(1, [...headword].length) };
    return (
        <div className="headword-fit text-center">
            <span
                lang="ja"
                data-display-headword
                style={style}
                className={`text-kanji text-primary font-mincho ${className}`}
                onClick={onClick}
            >
                {children}
            </span>
        </div>
    );
}
