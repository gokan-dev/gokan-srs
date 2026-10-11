import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

interface PageHeaderProps {
    title: ReactNode;
    subtitle?: ReactNode;
    /**
     * Where Back goes when there is no in-app history to pop (a direct link, a
     * fresh load). Omit to render no Back row at all (the hub).
     */
    parentPath?: string;
    /** Right-aligned next to the title; wraps below it under `md`. */
    actions?: ReactNode;
    className?: string;
}

/**
 * Left-aligned page header: an optional `← Back` row in accent above the
 * title, the title itself, an optional subtitle, and an optional actions
 * slot. Back calls `navigate(-1)` when the previous history entry is inside
 * this app, and only falls back to `parentPath` for a page opened directly
 * (so Back never lands somewhere the learner didn't come from).
 */
export function PageHeader({ title, subtitle, parentPath, actions, className = '' }: PageHeaderProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const handleBack = () => {
        if (location.key !== 'default') void navigate(-1);
        else if (parentPath) void navigate(parentPath);
    };

    return (
        <header className={`w-full ${className}`}>
            {parentPath !== undefined && (
                <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-1 type-support text-accent mb-2 cursor-pointer"
                >
                    <ArrowLeft size={14} aria-hidden="true" />
                    Back
                </button>
            )}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                <div className="min-w-0">
                    <h1 className="type-page-title">{title}</h1>
                    {subtitle && <p className="type-support mt-1">{subtitle}</p>}
                </div>
                {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
            </div>
        </header>
    );
}
