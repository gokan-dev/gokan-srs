import type { ReactNode } from "react";
import { DrillLink } from "../../components/DrillLink";

/**
 * A grammar point's header actions: its main action (`children`, the LearnStatus) and, under it,
 * the drill against its siblings. The drill is a way to practise this point, so it sits with the
 * point's main action, not only in the Related tab where a learner never found it. The space
 * above the drill is on the link itself: most points have no drill (or it is still loading), and
 * an empty element in a gapped column would leave a blank band under the main action.
 */
export function PointHeaderActions({ grammarId, children }: { grammarId: string; children: ReactNode }) {
    return (
        <div className="flex flex-col items-start" data-point-actions>
            {children}
            <DrillLink set={{ kind: 'point', grammarId }} label="Drill against its siblings" className="mt-4" />
        </div>
    );
}
