import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LookupTarget } from "../../utils/lookup.utils";
import { useLookup } from "../lookup/useLookup";

interface ListRowProps {
    to: string;
    children: ReactNode;
    trailing?: ReactNode;
    className?: string;
    /** The word the row names, for its lookup card on hover and focus (the row still opens on click). */
    lookup?: LookupTarget;
}

/**
 * The one clickable row. Always a `<Link>`, never a `div` with `onClick`, so
 * a row is a real link: middle-click, open-in-new-tab and screen readers all
 * work without extra handling.
 *
 * The link is stretched over the whole row (`after:inset-0`) rather than
 * wrapping it, so the trailing slot can hold its own button (a "Learn") without
 * nesting an interactive element inside an `<a>`. The trailing slot sits above
 * the stretched link; text in it still opens the row.
 */
export function ListRow({ to, children, trailing, className = '', lookup }: ListRowProps) {
    const { triggerProps, card } = useLookup(lookup, 'link');
    return (
        <>
        <div
            {...triggerProps}
            // Marks the row for check:layout, which keeps the Japanese in it to one line each.
            data-list-row
            className={`
                relative flex items-center gap-3 rounded-md px-3 py-2 min-w-0
                hover:bg-surface-hover transition-colors
                has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent
                ${className}
            `}
        >
            <Link to={to} className="flex-1 min-w-0 focus-visible:outline-none after:absolute after:inset-0 after:content-['']">
                {children}
            </Link>
            {trailing && <div className="shrink-0 relative pointer-events-none [&_button]:pointer-events-auto">{trailing}</div>}
        </div>
        {card}
        </>
    );
}
