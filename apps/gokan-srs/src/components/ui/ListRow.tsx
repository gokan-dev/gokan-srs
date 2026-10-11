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
 */
export function ListRow({ to, children, trailing, className = '' }: ListRowProps) {
    return (
        <Link
            to={to}
            className={`
                flex items-center gap-3 rounded-md px-3 py-2 min-w-0
                hover:bg-surface-hover transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                ${className}
            `}
        >
            <div className="flex-1 min-w-0">{children}</div>
            {trailing && <div className="shrink-0">{trailing}</div>}
        </Link>
    );
}
