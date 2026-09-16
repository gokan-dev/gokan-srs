import React from "react";
import { Link } from "react-router-dom";
import { CenteredCard } from "./CenteredCard";

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
        <h2 className="text-xl mb-4 text-primary font-serif">
            Session complete
        </h2>

        <p className="text-sm mb-2 text-secondary font-serif">
            You cleared <strong>{completed}</strong> card{completed === 1 ? '' : 's'}.
        </p>

        <p className="text-sm mb-6 text-secondary font-serif">
            <strong>{waiting}</strong> more word{waiting === 1 ? '' : 's'} {waiting === 1 ? 'is' : 'are'} still due. Take a break, or start another session now.
        </p>

        <div className="flex flex-col gap-3">
            <button
                onClick={onStartAnother}
                className="py-2 px-6 rounded transition-colors bg-accent text-surface font-serif hover:bg-accent-hover"
            >
                Start another session
            </button>

            <Link to="/" className="text-xs text-center text-secondary hover:text-primary transition-colors">
                Back to activities
            </Link>
        </div>
    </CenteredCard>
);
