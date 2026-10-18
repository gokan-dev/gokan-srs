import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/** The welcome page's content column: 1120px, a 20px gutter on phones and 40px from `sm`. */
export function WelcomeWrap({ className = "", children }: { className?: string; children: ReactNode }) {
    return <div className={`mx-auto w-full max-w-[1120px] px-5 sm:px-10 ${className}`}>{children}</div>;
}

interface WelcomeBandProps {
    /** The heading's id, which names the section for assistive tech. */
    labelledBy: string;
    /** On `surface`: the bands alternate with `background`, the one page where a band marks a section. */
    alt?: boolean;
    className?: string;
    children: ReactNode;
}

/** A full-bleed section of the welcome page. */
export function WelcomeBand({ labelledBy, alt = false, className = "", children }: WelcomeBandProps) {
    return (
        <section aria-labelledby={labelledBy} className={`py-[72px] sm:py-24 ${alt ? "bg-surface" : ""}`}>
            <WelcomeWrap className={className}>{children}</WelcomeWrap>
        </section>
    );
}

/** A section's start, the same in every band: its label, then its heading. */
export function SectionHead({ id, label, title }: { id: string; label: string; title: string }) {
    return (
        <>
            <span className="type-label block mb-3">{label}</span>
            <h2 id={id} className="type-display mb-5">{title}</h2>
        </>
    );
}

/** The arrow on the filled ways in, nudged right as the button is hovered (the button is the `group`). */
export function ForwardArrow() {
    return (
        <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" className="transition-transform duration-[180ms] ease-in-out group-hover:translate-x-[3px]" />
    );
}
