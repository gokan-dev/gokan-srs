import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface DisclosureProps {
    title: ReactNode;
    children: ReactNode;
    defaultOpen?: boolean;
    /** Controlled open state, for a caller that closes it from inside (setup's "Done marking"). */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    className?: string;
}

/**
 * A collapsible section, collapsed by default: dataset internals and long
 * tails (dictionary details, review history, rare senses) stay out of the
 * way until asked for, rather than competing with the learner's own content.
 */
export function Disclosure({ title, children, defaultOpen = false, open: controlledOpen, onOpenChange, className = '' }: DisclosureProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const open = controlledOpen ?? uncontrolledOpen;
    const toggle = () => {
        if (controlledOpen === undefined) setUncontrolledOpen(!open);
        onOpenChange?.(!open);
    };

    return (
        <div className={className}>
            <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className="flex items-center gap-2 w-full text-left type-label py-2 cursor-pointer"
            >
                <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
                {title}
            </button>
            {open && <div className="pt-1">{children}</div>}
        </div>
    );
}
