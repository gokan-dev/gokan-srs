import { PageHeader } from "../../components/PageHeader";

interface AboutScreenProps {
    onBack: () => void;
}

export function AboutScreen({ onBack }: AboutScreenProps) {
    return (
        <div className="w-full max-w-2xl md:max-w-3xl flex flex-col animate-fade-in">
            {/* Header */}
            <PageHeader title="About Gokan SRS" onBack={onBack} className="mb-8" />

            {/* Content */}
            <article className="w-full space-y-8">
                {/* Introduction */}
                <section className="animate-slide-up">
                    <h2 className="text-lg font-serif text-primary mb-3">
                        Why I Built This
                    </h2>
                    <p className="text-secondary leading-relaxed mb-3">
                        I'm learning Japanese, and I kept running into the same frustrating problem: I'd be reading something, understand the kanji, but completely blank on the vocabulary. I knew the individual characters, but the words themselves? Gone.
                    </p>
                    <p className="text-secondary leading-relaxed">
                        I'm too lazy to manually track all these words in a notebook or spreadsheet. I just wanted something simple that would help me remember the vocabulary I encounter while reading. So I built Gokan.
                    </p>
                </section>

                {/* What It Does */}
                <section className="animate-slide-up" style={{ animationDelay: "100ms" }}>
                    <h2 className="text-lg font-serif text-primary mb-3">
                        What It Does
                    </h2>
                    <p className="text-secondary leading-relaxed mb-3">
                        Gokan uses spaced repetition to help you learn Japanese vocabulary based on the kanji you already know. You set your kanji level, and it shows you words you can actually read. Review them when they're due, and the app handles the rest.
                    </p>
                    <p className="text-secondary leading-relaxed">
                        I use it every day myself. It's free, no ads, no premium tiers. Just a tool I made to solve my own problem, and I'm sharing it in case it helps you too.
                    </p>
                </section>

                {/* Data Sources */}
                <section className="animate-slide-up" style={{ animationDelay: "150ms" }}>
                    <h2 className="text-lg font-serif text-primary mb-3">
                        Data Sources
                    </h2>
                    <p className="text-secondary leading-relaxed">
                        Vocabulary data comes from{" "}
                        <a
                            href="https://jpdb.io"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline hover:no-underline"
                        >
                            JPDB
                        </a>
                        {" "}and definitions from{" "}
                        <a
                            href="https://www.edrdg.org/jmdict/j_jmdict.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline hover:no-underline"
                        >
                            JMDict
                        </a>
                        . Both are open-source and widely trusted in the Japanese learning community.
                    </p>
                    <p className="text-secondary leading-relaxed mt-3">
                        Grammar points and example sentences are from{" "}
                        <a
                            href="https://hanabira.org"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline hover:no-underline"
                        >
                            hanabira.org
                        </a>
                        , used under its Creative Commons license.
                    </p>
                </section>
            </article>
        </div>
    );
}
