import type { ReactNode } from "react";
import type { LearningStatus } from "../utils/learningStatus.utils";
import { STATUS_LABEL } from "../utils/learningStatus.utils";

const DOT_STYLE: Record<LearningStatus, string> = {
    mastered: 'bg-accent border-accent',
    learning: 'bg-accent/35 border-accent/35',
    new: 'bg-transparent border-divider',
};

interface StatusDotProps {
    status: LearningStatus;
    /** Defaults to the status's own name (New / Learning / Mastered); pass null to show only the dot. */
    label?: ReactNode | null;
    className?: string;
}

/**
 * The one learning-state language: a solid accent dot is mastered, a 35%
 * accent dot is learning, a hollow divider ring is new. Used in every list
 * row, search result and detail header so status reads the same way
 * everywhere, with a second cue (the label) alongside the colour.
 */
export function StatusDot({ status, label, className = '' }: StatusDotProps) {
    const shownLabel = label === null ? null : label ?? STATUS_LABEL[status];
    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
            <span className={`inline-block w-2.5 h-2.5 rounded-full border ${DOT_STYLE[status]}`} aria-hidden="true" />
            {shownLabel !== null
                ? <span className="type-support">{shownLabel}</span>
                : <span className="sr-only">{STATUS_LABEL[status]}</span>}
        </span>
    );
}
