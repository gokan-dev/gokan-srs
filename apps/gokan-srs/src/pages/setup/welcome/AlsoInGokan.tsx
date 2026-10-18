import type { ReactNode } from "react";
import { supportedOrdersList } from "@gokan/dataset-schema";
import { SectionHead, WelcomeBand } from "./WelcomeSection";

function Item({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <h3 className="type-section mb-2">{title}</h3>
            <p className="type-body text-secondary max-w-[30em] m-0">{children}</p>
        </div>
    );
}

/** What else Gokan does, for a visitor who wants more than vocabulary. */
export function AlsoInGokan() {
    return (
        <WelcomeBand labelledBy="welcome-also" alt>
            <SectionHead id="welcome-also" label="Also in Gokan" title="A few other things it does" />
            <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-x-16 sm:gap-y-10">
                <Item title="Words you run into">
                    Heard a word in a game or on a stream? Search it and add it to your reviews right there.
                </Item>
                <Item title="Grammar">
                    Over 700 grammar points from N5 to N1. You practise them by filling the gap in real sentences, and the words in those sentences count as review too.
                </Item>
                <Item title="A dictionary">
                    Every word, kanji and grammar point has its own page, nearly 36,000 words in all. You don't need to set anything up. <a href="/dictionary/">Browse the dictionary</a>
                </Item>
                {/* Every order the picker offers, named from the shared package, so the list cannot fall behind it. */}
                <Item title="Your kanji book">{supportedOrdersList()}.</Item>
            </div>
        </WelcomeBand>
    );
}
