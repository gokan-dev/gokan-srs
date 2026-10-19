import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface ListRowProps {
    to: string;
    children: ReactNode;
    trailing?: ReactNode;
    className?: string;
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
export function ListRow({ to, children, trailing, className = '' }: ListRowProps) {
    return (
        <div
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
    );
}
