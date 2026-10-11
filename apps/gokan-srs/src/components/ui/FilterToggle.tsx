import type { ReactNode } from "react";

interface FilterToggleProps {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
    className?: string;
}

/**
 * The one multi-select pill style (list filters, genre pills, grammar browse
 * toggles). Unlike `SelectableOption` (one choice at a time), any number of
 * these can be active together.
 */
export function FilterToggle({ active, onClick, children, className = '' }: FilterToggleProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`
                text-xs font-gothic rounded-md px-2 py-1 border transition-colors
                ${active ? 'border-accent text-accent bg-accent/10' : 'border-divider text-secondary hover:bg-surface-hover'}
                ${className}
            `}
        >
            {children}
        </button>
    );
}
