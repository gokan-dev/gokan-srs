
import React from "react";
import { BackToStudyLink, CenteredCard } from "./CenteredCard";
import { Button } from "./ui/Button";
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
            <h2 className="type-section mb-3">You’re done for now</h2>

            <p className="type-support mb-6">
                Your next review will be available in{' '}
                <strong>{formatMinutes(minutes)}</strong>.
            </p>

            <div className="flex flex-col gap-3">
                <Button onClick={onLearnMore} className="w-full">Learn more words</Button>
                <p className="type-meta">Recommended daily limit reached</p>
                <BackToStudyLink />
            </div>
        </CenteredCard>
    );
};