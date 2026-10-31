import type { ReactNode } from "react";
import type { LookupTarget } from "../../utils/lookup.utils";
import { useLookup } from "./useLookup";

interface LookupTextProps {
    target: LookupTarget;
    children: ReactNode;
    className?: string;
    /** In the Tab order, Enter pinning the card: on reading pages, not on a quiz card, where Tab goes from the answer to Submit. */
    focusable?: boolean;
    lang?: string;
}

/**
 * Japanese text that is not a link of its own (a sentence's word, a kanji of a word page's
 * headword) as a lookup trigger: hover or focus shows its card, a click pins it, a tap opens it
 * as a sheet.
 */
export function LookupText({ target, children, className = '', focusable = false, lang }: LookupTextProps) {
    const { triggerProps, card } = useLookup(target, 'inline');
    return (
        <>
            <span
                {...triggerProps}
                // A span in the Tab order is a button that opens a dialog; one out of it (a quiz card's word) is only text with a card.
                aria-haspopup={focusable ? triggerProps['aria-haspopup'] : undefined}
                aria-expanded={focusable ? triggerProps['aria-expanded'] : undefined}
                lang={lang}
                className={className}
                data-lookup-trigger
                tabIndex={focusable ? 0 : undefined}
                role={focusable ? 'button' : undefined}
            >
                {children}
            </span>
            {card}
        </>
    );
}
