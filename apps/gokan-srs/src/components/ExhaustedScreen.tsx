import React from "react";
import { BackToStudyLink, CenteredCard } from "./CenteredCard";

export const ExhaustedScreen: React.FC = () => (
    <CenteredCard>
        <h2 className="type-section mb-3">All caught up</h2>
        <p className="type-support mb-6">Come back tomorrow.</p>
        <BackToStudyLink />
    </CenteredCard>
);
