import type { ReactNode } from "react";
import { BackLink } from "./BackLink";

interface PageHeaderProps {
    title: ReactNode;
    subtitle?: ReactNode;
    /**
     * Where Back goes when there is no in-app history to pop (a direct link, a
     * fresh load). Omit to render no Back row at all (a top-level destination).
     */
    parentPath?: string;
    /** Right-aligned next to the title; wraps below it under `md`. */
    actions?: ReactNode;
    className?: string;
}

/**
 * Left-aligned page header: an optional `← Back` row above the title, the
 * title itself, an optional subtitle, and an optional actions slot.
 */
export function PageHeader({ title, subtitle, parentPath, actions, className = '' }: PageHeaderProps) {
    return (
        <header className={`w-full ${className}`}>
            {parentPath !== undefined && <BackLink parentPath={parentPath} />}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="type-page-title">{title}</h1>
                    {subtitle && <p className="type-support mt-1">{subtitle}</p>}
                </div>
                {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
            </div>
        </header>
    );
}
