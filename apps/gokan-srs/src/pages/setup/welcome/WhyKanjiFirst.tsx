import { KanjiDemo } from "./KanjiDemo";
import { SectionHead, WelcomeBand } from "./WelcomeSection";

const PARAGRAPH = "type-body max-w-[34em] mb-4";

/** The story behind Gokan, and the demo that shows it. */
export function WhyKanjiFirst() {
    return (
        <WelcomeBand labelledBy="welcome-why" alt className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-[72px]">
            <div className="min-w-0">
                <SectionHead id="welcome-why" label="Why kanji first" title="I kept knowing the kanji and blanking on the word" />
                <p className={PARAGRAPH}>
                    I'd be reading something, recognise every character, and still have no idea what the word meant. Keeping a notebook of words felt like a chore, so I built Gokan instead.
                </p>
                <p className={PARAGRAPH}>
                    It starts you on words made of kanji you've already learned. Those are much easier to remember, because you know what the pieces mean. <span lang="ja" className="font-mincho whitespace-nowrap">学生</span> is study and life, a student. Once you know that, it stops blurring into every other two-kanji word.
                </p>
                <p className={`${PARAGRAPH} text-secondary`}>
                    You can still learn any word you want. Gokan just starts with the ones you're ready for.
                </p>
            </div>
            <KanjiDemo />
        </WelcomeBand>
    );
}
