import React from "react";
import { BackToStudyLink, CenteredCard } from "./CenteredCard";
import { Button } from "./ui/Button";

interface SessionCompleteScreenProps {
    /** Tasks this session committed to and cleared. */
    completed: number;
    /** Distinct words still due that this session's cap left out, picked up by the next one. */
    waiting: number;
    onStartAnother: () => void;
}

/**
 * Shown when a session clears its whole committed workload while the per-session
 * quiz cap (CONSTANTS.srs.sessionQuizCap) still holds reviews back. Starting
 * another session is deliberately an explicit choice: auto-continuing would make
 * the cap invisible and hand the user the same unbounded backlog it exists to break up.
 */
export const SessionCompleteScreen: React.FC<SessionCompleteScreenProps> = ({
    completed,
    waiting,
    onStartAnother,
}) => (
    <CenteredCard>
        <h2 className="type-section mb-3">Session complete</h2>

        <p className="type-support mb-2">
            You cleared <strong>{completed}</strong> card{completed === 1 ? '' : 's'}.
        </p>

        <p className="type-support mb-6">
            <strong>{waiting}</strong> more word{waiting === 1 ? '' : 's'} {waiting === 1 ? 'is' : 'are'} still due. Take a break, or start another session now.
        </p>

        <div className="flex flex-col gap-3">
            <Button onClick={onStartAnother} className="w-full">Start another session</Button>
            <BackToStudyLink />
        </div>
    </CenteredCard>
);
