import { useState } from "react";
import type { SetupValues } from "../../models/state.model";
import { DEFAULT_SETTINGS } from "../../models/user.model";
import { WelcomeScreen } from "./WelcomeScreen";
import { SetupScreen } from "./SetupScreen";
import { trackEvent } from "../../services/analytics";
import { setupCompletedEvent, type SetupLink } from "../../utils/setupLink.utils";

interface OnboardingFlowProps {
    /** The link that opened the app: its order and count are the kanji form's, its source the event's. */
    link: SetupLink;
    onComplete: (values: SetupValues) => void;
}

export function OnboardingFlow({ link, onComplete }: OnboardingFlowProps) {
    const [step, setStep] = useState<'welcome' | 'setup'>('welcome');

    // Either path saves a setup; a Drive restore does not, and sends nothing.
    const complete = (values: SetupValues) => {
        trackEvent(setupCompletedEvent(link));
        onComplete(values);
    };

    const handleSelectBeginner = () => {
        // Fast-track for complete beginners
        const values: SetupValues = {
            kanjiKnowledge: {
                // KKLC to learn kanji in order, unless the link named the visitor's own book.
                method: link.order ?? 'kklc',
                step: 0,
                kanjiSet: new Set(),
            },
            settings: { ...DEFAULT_SETTINGS, preferredLearningOrder: 'kanji_coverage' },
        };
        complete(values);
    };

    if (step === 'welcome') {
        return (
            <WelcomeScreen
                onSelectBeginner={handleSelectBeginner}
                onSelectLearner={() => setStep('setup')}
            />
        );
    }

    if (step === 'setup') {
        return (
            <SetupScreen onComplete={complete} />
        );
    }

    return null;
}
