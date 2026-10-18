import { useState, type ReactNode } from "react";
import { kanjiOrder } from "@gokan/dataset-schema";
import { Ruby } from "../../../components/Ruby";
import { ReviewDemo } from "./ReviewDemo";
import { SectionHead, WelcomeBand } from "./WelcomeSection";
import { WELCOME_EXAMPLES, WELCOME_ORDER_IDS, type WelcomeOrderId } from "./welcomeExamples";

interface StepProps {
    numeral: string;
    title: string;
    text: ReactNode;
    visual: ReactNode;
    /** The line down to the next step; the last step has none. */
    last?: boolean;
    /** The accent stroke's delay down this step's line when the order changes; none, no stroke. */
    run?: "early" | "late";
    /** Settles in with the new word when the order changes, after the given delay. */
    settle?: "early" | "late";
    /** Changes with every pick of a new order: remounting the animated parts replays them. */
    swaps: number;
}

const RUN = { early: "animate-[welcome-run_380ms_ease-in-out]", late: "animate-[welcome-run_380ms_ease-in-out_240ms]" };
const SETTLE = { early: "animate-[welcome-settle_220ms_ease-in-out_200ms_both]", late: "animate-[welcome-settle_220ms_ease-in-out_440ms_both]" };

/**
 * One step: its numeral on the line, its text, and its visual (beside the text from `lg`, under
 * it below). Nothing animates on first load (`swaps` is 0); each new order replays the stroke
 * and the settle, by key, so one keyframe set serves every change.
 */
function Step({ numeral, title, text, visual, last = false, run, settle, swaps }: StepProps) {
    const settleClass = settle && swaps > 0 ? SETTLE[settle] : "";
    // Only a settling step remounts: step one keeps its chips, and the focus on the one just picked.
    const settleKey = settle ? swaps : 0;
    return (
        <li className={`relative grid grid-cols-[40px_minmax(0,1fr)] gap-x-4 sm:grid-cols-[48px_minmax(0,1fr)] sm:gap-x-8 lg:grid-cols-[48px_minmax(0,5fr)_minmax(0,6fr)] [--run-from:44px] sm:[--run-from:52px] ${last ? "" : "pb-14 sm:pb-16"}`}>
            {!last && <span aria-hidden="true" className="absolute top-11 bottom-1.5 left-[19px] w-px bg-divider sm:top-[52px] sm:left-[23px]" />}
            {run && swaps > 0 && (
                <span key={swaps} aria-hidden="true" className={`pointer-events-none absolute top-(--run-from) left-[19px] h-9 w-px bg-accent opacity-0 sm:left-[23px] ${RUN[run]}`} />
            )}
            <span lang="ja" aria-hidden="true" className="relative grid size-10 place-items-center rounded-full border border-divider bg-background font-mincho text-[17px] text-primary sm:size-12 sm:text-xl">
                {numeral}
            </span>
            <div key={`text-${settleKey}`} className={`min-w-0 pt-1 sm:pt-2 ${settleClass}`}>
                <h3 className="type-section mb-2">{title}</h3>
                <p className="type-body text-secondary max-w-[26em] m-0">{text}</p>
            </div>
            <div key={`visual-${settleKey}`} className={`col-start-2 min-w-0 pt-6 lg:col-start-3 lg:pt-2 ${settleClass}`}>{visual}</div>
        </li>
    );
}

/** One example word carried through three steps; picking another order carries its own word down. */
export function HowItWorks() {
    const [orderId, setOrderId] = useState<WelcomeOrderId>("kklc");
    const [swaps, setSwaps] = useState(0);
    const example = WELCOME_EXAMPLES[orderId];
    const word = <span lang="ja" className="font-mincho">{example.word}</span>;

    const pick = (id: WelcomeOrderId) => {
        if (id === orderId) return;
        setOrderId(id);
        setSwaps(n => n + 1);
    };

    return (
        <WelcomeBand labelledBy="welcome-how">
            <SectionHead id="welcome-how" label="How it works" title="From your kanji book to your first review" />
            <ol className="m-0 mt-12 list-none p-0">
                <Step
                    numeral="一"
                    title="Tell Gokan where you are"
                    text={<>Pick the kanji book you're following and how far you've got. Say you're 300 kanji into {example.inText}.</>}
                    run="early"
                    swaps={swaps}
                    visual={
                        <>
                            <div role="group" aria-label="Kanji book" className="mb-4 flex flex-wrap items-center gap-1.5">
                                {WELCOME_ORDER_IDS.map(id => (
                                    <button
                                        key={id}
                                        type="button"
                                        aria-pressed={id === orderId}
                                        onClick={() => pick(id)}
                                        className={`min-h-10 cursor-pointer rounded-md border bg-surface px-3 py-2 text-sm transition-colors duration-[180ms] ease-in-out ${id === orderId ? "border-accent text-accent" : "border-divider text-secondary hover:border-accent/40"}`}
                                    >
                                        {kanjiOrder(id).label}
                                    </button>
                                ))}
                                <span className="pl-1 text-sm text-tertiary">and five more</span>
                            </div>
                            <div className="flex items-baseline gap-2 text-sm text-secondary">
                                <span>{kanjiOrder(orderId).label}</span>
                                <strong className="font-serif text-[28px] font-semibold text-primary">300</strong>
                                <span>kanji in</span>
                            </div>
                        </>
                    }
                />
                <Step
                    numeral="二"
                    title="Get words you can read"
                    text={<>Gokan gives you words made from those kanji, the common ones first, each with a real sentence. {word} is one of them.</>}
                    run="late"
                    settle="early"
                    swaps={swaps}
                    visual={
                        <div aria-hidden="true" className="flex flex-wrap items-center gap-3 text-tertiary">
                            <ExampleKanjiBox {...example.kanji[0]} />
                            <span className="text-lg">+</span>
                            <ExampleKanjiBox {...example.kanji[1]} />
                            <svg width="28" height="14" viewBox="0 0 28 14" className="flex-none">
                                <path d="M1 7h24M19 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="ml-1 flex flex-col">
                                <span lang="ja" className="font-mincho text-[36px] leading-[1.3] text-primary">
                                    <Ruby text={example.word} reading={example.kana} tone="text-secondary" />
                                </span>
                                <span className="text-sm text-primary">{example.gloss}</span>
                            </span>
                        </div>
                    }
                />
                <Step
                    numeral="三"
                    title="Review them when they're due"
                    text={<>Next time, it asks what {word} means in a sentence. Get it right and it waits longer before asking again. Miss it and it comes back soon.</>}
                    settle="late"
                    swaps={swaps}
                    last
                    visual={<ReviewDemo key={orderId} example={example} />}
                />
            </ol>
        </WelcomeBand>
    );
}

/** A kanji of the example word, boxed in accent as a known kanji is in the demo above, with its position in the order. */
function ExampleKanjiBox({ character, position }: { character: string; position: number }) {
    return (
        <span className="flex flex-col items-center gap-1">
            <span lang="ja" className="grid size-13 place-items-center rounded-md border border-accent bg-surface font-mincho text-[28px] text-primary">
                {character}
            </span>
            <span className="text-xs text-tertiary">#{position}</span>
        </span>
    );
}
