import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { headwordOf } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { VocabularyService } from "../services/vocabulary.service";

/** Hover dwell before a lookup starts, so sweeping the cursor over a sentence fetches nothing. */
const OPEN_DELAY_MS = 220;
/** Grace period on leave, so moving between adjacent words does not flicker the card away. */
const CLOSE_DELAY_MS = 120;
/** Senses shown before "+N more". Two lines is a glance; the detail page is one click away. */
const MAX_SENSES = 2;
const MAX_GLOSSES_PER_SENSE = 4;

/** Module-level so every tooltip on the page shares one in-flight promise per id. */
const inFlight = new Map<string, Promise<Vocabulary | null>>();

function loadOnce(vocabId: string): Promise<Vocabulary | null> {
    const existing = inFlight.get(vocabId);
    if (existing) return existing;
    // VocabularyService.loadVocab has its own cache, so a repeat hover after
    // resolution is synchronous-ish; this map only collapses concurrent hovers.
    const promise = VocabularyService.loadVocab(vocabId).catch(() => null);
    inFlight.set(vocabId, promise);
    return promise;
}

interface WordGlossTooltipProps {
    vocabId: string;
    /** The word as it appears in the sentence - rendered as-is, tooltip behaviour wrapped around it. */
    children: ReactNode;
    className?: string;
    onClick?: (event: MouseEvent) => void;
    /** Native title to fall back on when the gloss cannot be shown (touch devices). */
    fallbackTitle?: string;
}

/**
 * Shows a word's reading and glosses on hover, without leaving the quiz.
 *
 * The gap this closes: a learner reading an example sentence hits a word they
 * do not know and has to either guess or navigate away mid-review. A 10ten-style
 * inline gloss keeps them in the sentence. Used everywhere an interactive
 * sentence renders - the vocab meaning quiz, vocab sentence lists, the grammar
 * detail examples, and both grammar quiz cards.
 *
 * Deliberately keyed off the per-word vocab record (~1.6 KB, cached by
 * `VocabularyService.loadVocab`) rather than `index/search.json`, which is
 * 3.1 MB and would be an absurd thing to pull on a hover. The fetch is also
 * delayed by OPEN_DELAY_MS, so passing the cursor across a sentence costs
 * nothing at all.
 *
 * Rendered through a portal to `document.body`: quiz cards clip their content
 * (`overflow-hidden` on Card, plus the flex-wrap sentence row), so an in-flow
 * absolute tooltip gets cut off at the card edge.
 *
 * Touch has no hover, so on those devices this degrades to exactly what was
 * there before - the word stays tappable and carries a native `title`.
 */
export function WordGlossTooltip({
    vocabId,
    children,
    className = "",
    onClick,
    fallbackTitle,
}: WordGlossTooltipProps) {
    const [vocab, setVocab] = useState<Vocabulary | null>(null);
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
    const anchorRef = useRef<HTMLSpanElement>(null);
    const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tooltipId = useId();

    const clearTimers = () => {
        if (openTimer.current) clearTimeout(openTimer.current);
        if (closeTimer.current) clearTimeout(closeTimer.current);
        openTimer.current = null;
        closeTimer.current = null;
    };

    useEffect(() => clearTimers, []);

    const show = () => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
        if (open || openTimer.current) return;
        openTimer.current = setTimeout(() => {
            openTimer.current = null;
            const rect = anchorRef.current?.getBoundingClientRect();
            if (rect) setCoords({ left: rect.left + rect.width / 2, top: rect.top });
            setOpen(true);
            if (!vocab) void loadOnce(vocabId).then(setVocab);
        }, OPEN_DELAY_MS);
    };

    const hide = () => {
        if (openTimer.current) {
            clearTimeout(openTimer.current);
            openTimer.current = null;
        }
        closeTimer.current = setTimeout(() => {
            closeTimer.current = null;
            setOpen(false);
        }, CLOSE_DELAY_MS);
    };

    return (
        <>
            <span
                ref={anchorRef}
                className={className}
                onClick={onClick}
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
                aria-describedby={open ? tooltipId : undefined}
                title={fallbackTitle}
            >
                {children}
            </span>
            {open && coords && createPortal(
                <GlossCard id={tooltipId} vocab={vocab} left={coords.left} top={coords.top} />,
                document.body
            )}
        </>
    );
}

/**
 * The floating card. Positioned above the word and horizontally centred on it,
 * then clamped into the viewport - a word at the start or end of a line would
 * otherwise put half the card off-screen. Flips below the word when there is no
 * room above, which is the common case for the first line of a sentence.
 */
function GlossCard({ id, vocab, left, top }: { id: string; vocab: Vocabulary | null; left: number; top: number }) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [placed, setPlaced] = useState<{ left: number; top: number } | null>(null);

    useEffect(() => {
        const card = cardRef.current;
        if (!card) return;
        const { width, height } = card.getBoundingClientRect();
        const margin = 8;
        const clampedLeft = Math.min(
            Math.max(margin, left - width / 2),
            Math.max(margin, window.innerWidth - width - margin)
        );
        const above = top - height - margin;
        setPlaced({ left: clampedLeft, top: above >= margin ? above : top + margin * 3 });
    }, [left, top, vocab]);

    const senses = (vocab?.senses ?? []).slice(0, MAX_SENSES);
    const hiddenSenses = Math.max(0, (vocab?.senses?.length ?? 0) - senses.length);

    return (
        <div
            id={id}
            ref={cardRef}
            role="tooltip"
            // Hidden until measured, so it never flashes at the unclamped position.
            style={{
                left: placed?.left ?? left,
                top: placed?.top ?? top,
                visibility: placed ? 'visible' : 'hidden',
            }}
            className="fixed z-50 pointer-events-none max-w-xs rounded-lg border border-divider bg-surface shadow-lg px-3 py-2"
        >
            {!vocab ? (
                <div className="text-xs text-tertiary font-gothic">Loading...</div>
            ) : (
                <>
                    <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-lg font-mincho text-primary leading-none">
                            {headwordOf(vocab)}
                        </span>
                        {vocab.reading.primary !== headwordOf(vocab) && (
                            <span className="text-xs font-gothic text-tertiary">{vocab.reading.primary}</span>
                        )}
                    </div>
                    <ol className="space-y-0.5">
                        {senses.map((sense, i) => (
                            <li key={i} className="text-xs font-serif text-secondary leading-snug">
                                {senses.length > 1 && <span className="text-tertiary mr-1">{i + 1}.</span>}
                                {sense.pos.length > 0 && (
                                    <span className="text-tertiary italic mr-1">{sense.pos[0]}</span>
                                )}
                                {sense.glosses.slice(0, MAX_GLOSSES_PER_SENSE).join(', ')}
                            </li>
                        ))}
                    </ol>
                    {hiddenSenses > 0 && (
                        <div className="text-xs text-tertiary font-gothic mt-1">
                            +{hiddenSenses} more sense{hiddenSenses > 1 ? 's' : ''}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
