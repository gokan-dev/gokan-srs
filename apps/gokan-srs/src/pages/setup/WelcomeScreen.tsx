import { AlsoInGokan } from "./welcome/AlsoInGokan";
import { HowItWorks } from "./welcome/HowItWorks";
import { WelcomeClosing, WelcomeFooter } from "./welcome/WelcomeClosing";
import { WelcomeHeader, WelcomeHero } from "./welcome/WelcomeHero";
import { WhyKanjiFirst } from "./welcome/WhyKanjiFirst";

interface WelcomeScreenProps {
    onSelectBeginner: () => void;
    onSelectLearner: () => void;
}

/**
 * The homepage, before setup (and what a crawler renders): the way in first, then why kanji
 * first, how it works, what else Gokan does, and the way in again. The sections are full-bleed
 * bands (`welcome/WelcomeSection.tsx`), the one page that marks a section with one.
 * `data-welcome` scopes the reduced-motion rule in index.css.
 */
export function WelcomeScreen({ onSelectBeginner, onSelectLearner }: WelcomeScreenProps) {
    return (
        <div data-welcome className="min-h-screen w-full bg-background">
            <WelcomeHeader />
            <main>
                <WelcomeHero onSelectBeginner={onSelectBeginner} onSelectLearner={onSelectLearner} />
                <WhyKanjiFirst />
                <HowItWorks />
                <AlsoInGokan />
                <WelcomeClosing onSelectLearner={onSelectLearner} />
            </main>
            <WelcomeFooter />
        </div>
    );
}
