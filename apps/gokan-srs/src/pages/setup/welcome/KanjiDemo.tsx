import { useState } from "react";
import { DEMO_START_KNOWN, DEMO_TILES, DEMO_WORDS } from "./welcomeExamples";

/**
 * "Try it": tap the kanji you know, and the words made only of them come into focus. A kanji not
 * known yet is an outline; knowing it inks it in, with one bloom behind the tile just marked.
 */
export function KanjiDemo() {
    const [known, setKnown] = useState<ReadonlySet<string>>(() => new Set(DEMO_START_KNOWN));
    // The tile just marked known, the only one that blooms; unmarking blooms nothing.
    const [justKnown, setJustKnown] = useState<string | null>(null);

    const toggle = (ch: string) => {
        const next = new Set(known);
        if (next.delete(ch)) setJustKnown(null);
        else {
            next.add(ch);
            setJustKnown(ch);
        }
        setKnown(next);
    };

    const readable = DEMO_WORDS.filter(({ word }) => [...word].every(ch => known.has(ch))).length;

    return (
        <figure className="m-0 rounded-md border border-divider bg-background px-4 py-5 sm:p-7">
            <figcaption className="mb-4 text-[15px] font-semibold text-primary">
                Try it
                <span className="mt-0.5 block text-[13px] font-normal text-secondary">Tap the kanji you know and see which words you can read.</span>
            </figcaption>

            <div className="mb-6 flex flex-wrap gap-2">
                {DEMO_TILES.map(ch => {
                    const isKnown = known.has(ch);
                    return (
                        <button
                            key={ch}
                            type="button"
                            aria-pressed={isKnown}
                            aria-label={`${ch}, ${isKnown ? "known" : "not known yet"}`}
                            onClick={() => toggle(ch)}
                            className={`relative grid size-11 sm:size-13 cursor-pointer place-items-center rounded-md border bg-surface transition-colors duration-200 ${isKnown ? "border-accent" : "border-divider hover:border-accent/45"}`}
                        >
                            {isKnown && justKnown === ch && (
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute -inset-2 rounded-full opacity-0 bg-[radial-gradient(circle,var(--color-primary)_0%,transparent_62%)] animate-[welcome-ink_520ms_ease-out]"
                                />
                            )}
                            <span
                                lang="ja"
                                className={`relative font-mincho text-2xl sm:text-[28px] leading-none transition-[color,-webkit-text-stroke-color] duration-[220ms] ease-in-out [-webkit-text-stroke-width:0.8px] ${isKnown ? "text-primary [-webkit-text-stroke-color:transparent]" : "text-transparent [-webkit-text-stroke-color:var(--color-tertiary)]"}`}
                            >
                                {ch}
                            </span>
                        </button>
                    );
                })}
            </div>

            <ul className="m-0 grid list-none grid-cols-1 gap-x-6 p-0 sm:grid-cols-2">
                {DEMO_WORDS.map(({ word, kana, gloss }, i) => {
                    const isReadable = [...word].every(ch => known.has(ch));
                    return (
                        <li key={word} className="flex min-w-0 items-center gap-3 border-t border-divider py-[9px]">
                            <span lang="ja" className="flex-none whitespace-nowrap font-mincho text-2xl leading-[1.25] text-primary">
                                {[...word].map((ch, j) => (
                                    <span
                                        key={j}
                                        style={{ transitionDelay: `${i * 45 + j * 30}ms` }}
                                        className={`inline-block transition-[filter,opacity] duration-[240ms] ease-in-out ${known.has(ch) ? "" : "blur-[2.6px] opacity-[0.38]"}`}
                                    >
                                        {ch}
                                    </span>
                                ))}
                            </span>
                            <span
                                aria-hidden={!isReadable}
                                style={{ transitionDelay: `${i * 45 + 90}ms` }}
                                className={`flex min-w-0 flex-col transition-[opacity,transform] duration-[220ms] ease-in-out ${isReadable ? "opacity-100" : "translate-y-1 opacity-0"}`}
                            >
                                <span lang="ja" className="font-gothic text-xs text-secondary">{kana}</span>
                                <span className="truncate text-[13px] text-primary">{gloss}</span>
                            </span>
                        </li>
                    );
                })}
            </ul>

            <p aria-live="polite" className="type-support mt-[18px] mb-0">
                {known.size} kanji known, {readable} {readable === 1 ? "word" : "words"} you can read
            </p>
        </figure>
    );
}
