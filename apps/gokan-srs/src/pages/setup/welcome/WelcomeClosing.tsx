import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { buttonClassName } from "../../../components/ui/buttonStyles";
import { ForwardArrow, WelcomeBand, WelcomeWrap } from "./WelcomeSection";

const FOOT_LINK = "text-secondary transition-colors duration-200 hover:text-primary";

/** The last call: the way in again, and the dictionary for a visitor not ready to set up. */
export function WelcomeClosing({ onSelectLearner }: { onSelectLearner: () => void }) {
    return (
        <WelcomeBand labelledBy="welcome-end" className="text-center">
            <h2 id="welcome-end" className="type-display mx-auto mb-5 max-w-[16em]">Start with the kanji you already know</h2>
            <p className="type-body text-secondary mx-auto mb-8 max-w-[34em]">
                Setup takes about a minute. It's free, and your progress stays in your browser unless you choose to sync it to your own Google Drive.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
                <Button size="lg" onClick={onSelectLearner} className="group w-full sm:w-auto">
                    Set up Gokan
                    <ForwardArrow />
                </Button>
                <a href="/dictionary/" className={buttonClassName("secondary", "lg", "w-full sm:w-auto")}>
                    Browse the dictionary first
                </a>
            </div>
        </WelcomeBand>
    );
}

export function WelcomeFooter() {
    return (
        <WelcomeWrap>
            <footer className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-divider pt-7 pb-10 text-sm text-tertiary">
                <span>Gokan <span lang="ja" className="font-mincho">語感</span></span>
                <Link to="/about" className={FOOT_LINK}>About</Link>
                <a href="/dictionary/" className={FOOT_LINK}>Dictionary</a>
                <a href="https://github.com/gokan-dev/gokan-dataset" className={FOOT_LINK}>Open dataset</a>
            </footer>
        </WelcomeWrap>
    );
}
