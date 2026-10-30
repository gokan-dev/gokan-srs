import { Page } from "../../components/Page";
import { PageHeader } from "../../components/PageHeader";
import { Link } from "react-router-dom";
import { APP_VERSION } from "../../services/release.service";
import { WHATS_NEW } from "../../utils/navigation.utils";
import { useAsyncData } from "../../hooks/useAsyncData";
import { loadAudioIndex } from "../../services/audio.service";
import { VoiceCredit } from "./VoiceCredit";

export function AboutScreen() {
    // Lenient on purpose: #178's player treats a failed loadAudioIndex as fatal (ARCHITECTURE.md, Audio).
    const audio = useAsyncData("audio-index", () => loadAudioIndex()).data;

    return (
        <Page width="narrow">
            <PageHeader title="About Gokan SRS" parentPath="/" className="mb-8" />

            <article className="w-full space-y-8">
                {/* Introduction */}
                <section className="animate-slide-up">
                    <h2 className="type-section mb-3">
                        Why I Built This
                    </h2>
                    <p className="type-body mb-3">
                        I'm learning Japanese, and I kept running into the same frustrating problem: I'd be reading something, understand the kanji, but completely blank on the vocabulary. I knew the individual characters, but the words themselves? Gone.
                    </p>
                    <p className="type-body">
                        I'm too lazy to manually track all these words in a notebook or spreadsheet. I just wanted something simple that would help me remember the vocabulary I encounter while reading. So I built Gokan.
                    </p>
                </section>

                {/* What It Does */}
                <section className="animate-slide-up" style={{ animationDelay: "100ms" }}>
                    <h2 className="type-section mb-3">
                        What It Does
                    </h2>
                    <p className="type-body mb-3">
                        Gokan uses spaced repetition to help you learn Japanese vocabulary based on the kanji you already know. You set your kanji level, and it shows you words you can actually read. Review them when they're due, and the app handles the rest.
                    </p>
                    <p className="type-body">
                        I use it every day myself. It's free, no ads, no premium tiers. Just a tool I made to solve my own problem, and I'm sharing it in case it helps you too.
                    </p>
                </section>

                {/* Data Sources */}
                <section className="animate-slide-up" style={{ animationDelay: "150ms" }}>
                    <h2 className="type-section mb-3">
                        Data Sources
                    </h2>
                    <p className="type-body">
                        Words and definitions come from{" "}
                        <a
                            href="https://www.edrdg.org/jmdict/j_jmdict.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            JMdict
                        </a>
                        , how common each word is from{" "}
                        <a
                            href="https://jpdb.io"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            JPDB
                        </a>
                        , and example sentences from{" "}
                        <a
                            href="https://tatoeba.org"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            Tatoeba
                        </a>
                        . All three are open and widely trusted in the Japanese learning community.
                    </p>
                    <p className="type-body mt-3">
                        Grammar points and example sentences are from{" "}
                        <a
                            href="https://hanabira.org"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            hanabira.org
                        </a>
                        , used under its Creative Commons license.
                    </p>
                    {audio && <VoiceCredit audio={audio} />}
                </section>

                {/* Version: on a phone the footer is hidden, so this is the way to What's new. */}
                <section className="animate-slide-up" style={{ animationDelay: "200ms" }}>
                    <h2 className="type-section mb-3">
                        Version
                    </h2>
                    <p className="type-body">
                        <span data-app-version>You are on version {APP_VERSION}.</span>{" "}
                        <Link to={WHATS_NEW.to} className="text-accent underline">See what's new</Link>
                    </p>
                </section>
            </article>
        </Page>
    );
}
