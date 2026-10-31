import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LookupTarget } from "../../utils/lookup.utils";
import { useLookup } from "./useLookup";

interface LookupLinkProps {
    to: string;
    /** No target, no card: a plain link. */
    target: LookupTarget | undefined;
    children: ReactNode;
    className?: string;
    lang?: string;
}

/**
 * A link naming a word or a kanji (a tile, a mix-up's answer) that shows its lookup card on
 * hover and focus. A click or a tap still follows the link; on touch there is no card, its
 * page being the card's content.
 */
export function LookupLink({ to, target, children, className, lang }: LookupLinkProps) {
    const { triggerProps, card } = useLookup(target, 'link');
    return (
        <>
            <Link {...triggerProps} to={to} className={className} lang={lang}>{children}</Link>
            {card}
        </>
    );
}
