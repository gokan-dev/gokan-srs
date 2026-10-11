import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { QuizCardFrame } from "./quiz/QuizCardFrame";
import { CardDivider } from "./ui/CardSection";
import { Button } from "./ui/Button";
import { useResponsive } from "../context/Responsive/useResponsive";

interface IntroCardShellProps {
    /** The activity-specific content sections (kanji/readings/senses, or title/explanation/formation). */
    children: ReactNode;
    onLearn: () => void;
    onSkip: () => void;
    /** Desktop label for the primary "Learn" button, e.g. "Learn this word" / "Learn this grammar point". */
    learnLabel: string;
    /** Mobile label for the primary button (default "Learn"). */
    learnLabelMobile?: string;
    /** Desktop label for the secondary "Skip" button (default "I already know this"). */
    skipLabel?: string;
    /** Mobile label for the secondary button (default "Skip"). */
    skipLabelMobile?: string;
}

/**
 * Shared frame for both activities' intro cards (VocabIntroCard, GrammarIntroCard):
 * the session card frame (QuizCardFrame), the divider, and the Learn/Skip form - including the
 * submit-is-Learn behavior and the focus-the-last-child-on-mount effect that
 * lands keyboard focus on the primary button. Each card supplies only its own
 * content sections as children (and any activity-specific chrome like a
 * MasteryRing or JlptChip, which differ between the two).
 */
export function IntroCardShell({
    children,
    onLearn,
    onSkip,
    learnLabel,
    learnLabelMobile = 'Learn',
    skipLabel = 'I already know this',
    skipLabelMobile = 'Skip',
}: IntroCardShellProps) {
    const formRef = useRef<HTMLFormElement | null>(null);
    const { isMobile } = useResponsive();

    useEffect(() => {
        const lastChild = formRef.current?.lastElementChild as HTMLElement | undefined;
        lastChild?.focus();
    }, []);

    return (
        <QuizCardFrame>
            {children}

            <CardDivider />

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onLearn();
                }}
                className="flex gap-4"
                ref={formRef}
            >
                <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={onSkip}
                    type="button"
                >
                    {isMobile ? skipLabelMobile : skipLabel}
                </Button>

                <Button variant="primary" className="flex-1" type="submit">
                    {isMobile ? learnLabelMobile : learnLabel}
                </Button>
            </form>
        </QuizCardFrame>
    );
}
