import type { LearningStatus } from "../../utils/learningStatus.utils";
import { StatusDot } from "../StatusDot";
import { Button } from "../ui/Button";

type LearnStatusProps =
    | { inStudy: false; learnLabel: string; onLearn: () => void }
    | { inStudy: true; status: LearningStatus; nextReview: string };

/**
 * A detail header's action area. Not in the learner's study yet: the page's one
 * primary button ("Learn this word"). In it: the status and when it is next
 * reviewed. The rings are in "Your progress" only, never repeated here.
 */
export function LearnStatus(props: LearnStatusProps) {
    if (!props.inStudy) {
        return (
            <div className="flex flex-col items-start gap-1.5">
                <Button onClick={props.onLearn}>{props.learnLabel}</Button>
                <span className="type-meta">Not in your study yet</span>
            </div>
        );
    }
    return (
        <div className="flex flex-col items-start gap-1">
            <StatusDot status={props.status} />
            <span className="type-support">{props.nextReview}</span>
        </div>
    );
}
