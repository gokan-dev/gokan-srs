import type { ReactNode } from "react";
import type { LearningStatus } from "../../utils/learningStatus.utils";
import { StatusDot } from "../StatusDot";
import { Button } from "../ui/Button";

type LearnStatusProps =
    | { inStudy: false; learnLabel: string; onLearn: () => void }
    | { inStudy: true; status: LearningStatus; nextReview: string; rings: ReactNode };

/**
 * A detail header's action area. Not in the learner's study yet: the page's one
 * primary button ("Learn this word"). In it: the status, when it is next
 * reviewed, and the labelled rings.
 */
export function LearnStatus(props: LearnStatusProps) {
    if (!props.inStudy) {
        return (
            <div className="flex flex-col items-start md:items-end gap-1.5">
                <Button onClick={props.onLearn}>{props.learnLabel}</Button>
                <span className="type-meta">Not in your study yet</span>
            </div>
        );
    }
    return (
        <div className="flex flex-col items-start md:items-end gap-2">
            <StatusDot status={props.status} />
            <span className="type-support">{props.nextReview}</span>
            <div className="flex gap-4 mt-1">{props.rings}</div>
        </div>
    );
}

/** A ring with its name under it, for the detail header. */
export function LabelledRing({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-1">
            {children}
            <span className="type-meta">{label}</span>
        </div>
    );
}
