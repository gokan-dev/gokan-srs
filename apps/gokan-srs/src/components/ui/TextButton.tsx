import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

interface TextButtonProps {
    onClick: () => void;
    children: ReactNode;
    /** An arrow after the label: the action takes the learner somewhere else on the page ("All 1,030 sentences →"). */
    arrow?: boolean;
    className?: string;
    ariaPressed?: boolean;
}

/** An action written as text ("Show 5 more", "Compare all 12 →"): accent, underlined on hover. */
export function TextButton({ onClick, children, arrow = false, className = '', ariaPressed }: TextButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={ariaPressed}
            className={`inline-flex items-center gap-1 font-sans text-sm text-accent hover:underline cursor-pointer ${className}`}
        >
            {children}
            {arrow && <ArrowRight size={14} aria-hidden="true" className="shrink-0" />}
        </button>
    );
}
