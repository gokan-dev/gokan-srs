import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface DisclosureProps {
    title: ReactNode;
    children: ReactNode;
    defaultOpen?: boolean;
    className?: string;
}

/**
 * A collapsible section, collapsed by default: dataset internals and long
 * tails (dictionary details, review history, rare senses) stay out of the
 * way until asked for, rather than competing with the learner's own content.
 */
export function Disclosure({ title, children, defaultOpen = false, className = '' }: DisclosureProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className={className}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
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
