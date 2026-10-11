import type { ReactNode } from "react";

/**
 * The one chip style, for metadata only (JLPT level, part of speech, register,
 * status). Always neutral: accent is reserved for links and actions, so a
 * chip never competes with the thing on the page that is actually clickable.
 */
export function Chip({ children, size = 'md', className = '' }: { children: ReactNode; size?: 'sm' | 'md'; className?: string }) {
    const sizing = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs';
    return (
        <span className={`${sizing} inline-block max-w-full rounded-md border border-divider text-secondary font-sans font-medium ${className}`}>
            {children}
        </span>
    );
}
