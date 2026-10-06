
import React from "react";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { CenteredCard } from "./CenteredCard";
import { useNow } from "../hooks/useNow";
import { formatMinutes, minutesUntil } from "../utils/time.utils";

interface WaitingScreenProps {
    nextReviewAt: Date;
    onLearnMore: () => void;
}

export const WaitingScreen: React.FC<WaitingScreenProps> = ({
    nextReviewAt,
    onLearnMore,
}) => {
    const minutes = minutesUntil(nextReviewAt, useNow());

    return (
        <CenteredCard>
            <h2 className="text-xl mb-4 text-primary font-serif flex items-center justify-center gap-2">
                You’re done for now <Sparkles size={20} className="text-accent" />
            </h2>

            <p className="text-sm mb-6 text-secondary font-serif">
                Your next review will be available in{' '}
                <strong>{formatMinutes(minutes)}</strong>.
            </p>

            <div className="flex flex-col gap-3">
                <button
                    onClick={onLearnMore}
                    className="py-2 px-6 rounded transition-colors bg-accent text-surface font-serif hover:bg-accent-hover"
                >
                    Learn more words
                </button>

                <p className="text-xs text-center text-secondary">
                    Recommended daily limit reached
                </p>

                <Link to="/" className="text-xs text-center text-secondary hover:text-primary transition-colors">
                    Back to activities
                </Link>
            </div>
        </CenteredCard>
    );
};