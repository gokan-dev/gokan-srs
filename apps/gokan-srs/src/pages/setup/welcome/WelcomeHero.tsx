import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { GoogleLoginButton } from "./GoogleLoginButton";
import { ForwardArrow, WelcomeWrap } from "./WelcomeSection";

const NAV_LINK = "text-sm text-secondary transition-colors duration-200 hover:text-primary";

/** Restored progress is read at start-up, so the app reloads into it. */
const reload = () => window.location.reload();

interface WelcomeHeroProps {
    onSelectBeginner: () => void;
    onSelectLearner: () => void;
}

/** The brand (plain text: this is the homepage), and the two links a visitor from search may want instead. */
export function WelcomeHeader() {
    return (
        <WelcomeWrap>
            <header className="flex items-center justify-between gap-4 py-5 sm:py-7">
                <div className="flex items-baseline gap-2 font-serif text-[22px] font-semibold text-primary">
                    Gokan <span lang="ja" className="font-mincho text-[15px] font-normal text-tertiary">語感</span>
                </div>
                <nav aria-label="Site" className="flex gap-4 sm:gap-6">
                    {/* A plain <a>: the dictionary is a separate static app on this origin's /dictionary prefix (it 404s under `bun run dev`). */}
                    <a href="/dictionary/" className={NAV_LINK}>Dictionary</a>
                    <Link to="/about" className={NAV_LINK}>About</Link>
                </nav>
            </header>
        </WelcomeWrap>
    );
}

/**
 * The way in. The <h1> says what the page is: it is the homepage a crawler renders, and it never
 * has a setup.
 */
export function WelcomeHero({ onSelectBeginner, onSelectLearner }: WelcomeHeroProps) {
    return (
        <WelcomeWrap>
            <div className="grid grid-cols-1 items-center gap-20 pt-6 pb-[72px] sm:pt-10 sm:pb-[88px] lg:grid-cols-[minmax(0,1fr)_auto] lg:pt-16 lg:pb-28">
                <div className="min-w-0">
                    <h1 className="type-hero max-w-[13em] mb-6">Japanese vocabulary for the kanji you know</h1>
                    <p className="type-body text-secondary sm:text-lg max-w-[31em] mb-8 sm:mb-10">
                        Gokan finds words made from the kanji you've already studied, then helps you remember them with spaced repetition. It follows the kanji book you're working through, whether that's KKLC, RTK or another one.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        <Button size="lg" onClick={onSelectLearner} className="group w-full sm:w-auto">
                            I already know some kanji
                            <ForwardArrow />
                        </Button>
                        <Button size="lg" variant="secondary" onClick={onSelectBeginner} className="w-full sm:w-auto">
                            I'm just starting out
                        </Button>
                    </div>
                    <p className="type-support mt-5">
                        It's free, and you don't need an account. Used Gokan on another device?{" "}
                        <GoogleLoginButton onSyncComplete={reload} />
                    </p>
                </div>

                {/* The name, set as it is written: static decoration, so hidden from assistive tech. */}
                <div aria-hidden="true" className="hidden lg:flex flex-col items-center gap-4 pr-6">
                    <div lang="ja" className="font-mincho text-[148px] leading-none text-primary [writing-mode:vertical-rl]">語感</div>
                    <div className="text-[13px] text-tertiary text-center">
                        <span lang="ja" className="font-gothic">ごかん</span>, a feel for words
                    </div>
                </div>
            </div>
        </WelcomeWrap>
    );
}
