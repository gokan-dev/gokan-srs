import type { ReactNode } from "react";
import { Check } from "lucide-react";

interface SelectableOptionProps {
    selected: boolean;
    onSelect: () => void;
    className?: string;
    children: ReactNode;
}

/**
 * The one selected style for every single-choice option (option grids, the
 * learning-order picker, the theme picker, onboarding). Before this, Settings
 * showed two different "selected" looks, and one of them (a grey tint) read
 * as disabled rather than chosen.
 */
export function SelectableOption({ selected, onSelect, className = '', children }: SelectableOptionProps) {
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={`
                relative border rounded-md text-left transition-colors
                ${selected ? 'border-accent bg-accent/10' : 'border-divider bg-surface hover:border-accent/50'}
                ${className}
            `}
        >
            {selected && (
                <Check size={16} className="absolute top-2 right-2 text-accent" aria-hidden="true" />
            )}
            {children}
        </button>
    );
}
