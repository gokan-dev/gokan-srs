import type { ReactNode } from "react";
import { BackToStudyLink, CenteredCard } from "./CenteredCard";

interface ActivityStatusCardProps {
    title: string;
    /** Message body (may include markup, e.g. a bolded ETA). */
    children: ReactNode;
}

/**
 * Between-work status card for an activity's waiting / exhausted states: a
 * centered title, message and "Back to Study" link. Currently used by the
 * Grammar screen (whose waiting/exhausted copy is generic); vocab keeps its own
 * WaitingScreen/ExhaustedScreen since their copy is word-specific and
 * WaitingScreen carries a "Learn more" action this card has no place for.
 */
export function ActivityStatusCard({ title, children }: ActivityStatusCardProps) {
    return (
        <CenteredCard>
            <h2 className="type-section mb-3">{title}</h2>
            <p className="type-support mb-6">{children}</p>
            <BackToStudyLink />
        </CenteredCard>
    );
}
