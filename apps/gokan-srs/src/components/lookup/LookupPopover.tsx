import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { placePopover, type PopoverPlace } from "../../utils/lookup.utils";

interface LookupPopoverProps {
    id: string;
    label: string;
    anchorRef: RefObject<HTMLElement | null>;
    cardRef: RefObject<HTMLDivElement | null>;
    focusOnOpen: boolean;
    onEnter: () => void;
    onLeave: () => void;
    /** Esc, or Tab past either end of the card: it closes and focus goes back to the trigger. */
    onExit: () => void;
    children: ReactNode;
}

/** The pointer's card, beside its trigger, kept there as the page scrolls and the card's data arrives. */
export function LookupPopover({ id, label, anchorRef, cardRef, focusOnOpen, onEnter, onLeave, onExit, children }: LookupPopoverProps) {
    const [placed, setPlaced] = useState<PopoverPlace | null>(null);

    useLayoutEffect(() => {
        const place = () => {
            const anchor = anchorRef.current;
            const card = cardRef.current;
            if (!anchor || !card) return;
            const { width, height } = card.getBoundingClientRect();
            setPlaced(placePopover(anchor.getBoundingClientRect(), { width, height }, { width: window.innerWidth, height: window.innerHeight }));
        };
        place();
        const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
        if (cardRef.current) resize?.observe(cardRef.current);
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);
        return () => {
            resize?.disconnect();
            window.removeEventListener('scroll', place, true);
            window.removeEventListener('resize', place);
        };
    }, [anchorRef, cardRef]);

    useEffect(() => {
        if (focusOnOpen) cardRef.current?.focus();
    }, [focusOnOpen, cardRef]);

    return (
        <div
            id={id}
            ref={cardRef}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            data-lookup-card
            onPointerEnter={e => { if (e.pointerType !== 'touch') onEnter(); }}
            onPointerLeave={e => { if (e.pointerType !== 'touch') onLeave(); }}
            // Out of the portal, a click or a key would reach the trigger's parents (a quiz card's Enter).
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Escape') onExit();
                // The card sits at the end of the page (a portal): Tab past it would lose the learner's place.
                if (e.key === 'Tab') {
                    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
                    const active = document.activeElement;
                    const leaving = e.shiftKey ? active === e.currentTarget || active === items[0] : items.length === 0 || active === items.at(-1);
                    if (leaving) {
                        e.preventDefault();
                        onExit();
                    }
                }
            }}
            // Hidden until measured, so it never flashes at an unclamped place. Pinned by the edge
            // facing its trigger, so growing as its data arrives never covers the trigger (placePopover).
            style={placed === null ? { left: 0, top: 0, visibility: 'hidden' } : { ...placed, visibility: 'visible' }}
            className="fixed z-50 w-72 max-w-[calc(100vw-1rem)] rounded-md border border-divider bg-surface shadow-lg p-3 focus-visible:outline-none"
        >
            {children}
        </div>
    );
}
