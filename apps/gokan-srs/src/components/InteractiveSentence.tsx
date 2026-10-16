import type { Sentence } from "@gokan/dataset-schema";
import { WordGlossTooltip, type WordLinkProps } from "./WordGlossTooltip";
import { segmentInteractiveSentence, type HighlightRange } from "@gokan/dataset-schema";

interface InteractiveSentenceProps {
    sentence: Sentence;
    targetVocabId?: string; // The specific vocab we are currently studying/viewing
    onVocabClick?: (vocabId: string) => void;
    className?: string;
    showFurigana?: boolean;
    allowTargetClickable?: boolean;
    /**
     * Show a reading/gloss card on hover over a matched word. On by default: a
     * learner reading a sentence should not have to navigate away to find out
     * what a word means. Turn it off where the surrounding UI is itself a
     * definition and the card would only repeat it.
     */
    showGlossOnHover?: boolean;
    /**
     * Character-offset ranges into `sentence.original` to render with the same
     * target styling as `targetVocabId` (accent, bold, underline) - e.g. a
     * grammar point's pattern markers (`patternHighlightRanges`), which are
     * often not a vocab word at all (から, のに). A range overlapping a vocab
     * match flags that match's whole segment rather than splitting it, so its
     * click/gloss behaviour stays intact.
     */
    highlightRanges?: HighlightRange[];
    /**
     * Makes each clickable word a link reachable with Tab and opened with Enter.
     * For reading pages (a word's or grammar point's examples); off on quiz cards,
     * where Tab moves between the answer and Submit.
     */
    keyboardLinks?: boolean;
}

export function InteractiveSentence({
    sentence,
    targetVocabId,
    onVocabClick,
    className = "",
    showFurigana = false,
    allowTargetClickable = false,
    showGlossOnHover = true,
    highlightRanges,
    keyboardLinks = false,
}: InteractiveSentenceProps) {
    const segments = segmentInteractiveSentence(sentence, { targetVocabId, highlightRanges });

    return (
        <span data-sentence className={`font-mincho leading-loose md:leading-relaxed break-words ${className}`}>
            {segments.map((segment, i) => {
                // The target class (accent, bold, underline) applies whether the
                // segment is the studied vocab word (isTarget) or falls inside a
                // highlighted range (e.g. a grammar pattern marker) - the two are
                // rendered identically, per issue #89.
                const emphasized = segment.isTarget || segment.isHighlighted;

                if (segment.type === 'text') {
                    if (!emphasized) return <span key={i}>{segment.content}</span>;
                    return (
                        <span key={i} className="text-accent font-semibold border-b-2 border-accent/30 px-0.5">
                            {segment.content}
                        </span>
                    );
                }

                const isClickable = onVocabClick && (!segment.isTarget || allowTargetClickable);

                const rawReading = showFurigana ? segment.reading : null;
                const isKanaOnly = /^[\u3040-\u309F\u30A0-\u30FF]+$/.test(segment.content);
                const reading = rawReading && rawReading !== segment.content && !isKanaOnly ? rawReading : null;

                const renderContent = () => {
                    if (reading) {
                        return (
                            <ruby>
                                {segment.content}
                                <rt className="text-[0.6em] select-none opacity-80" style={{ transform: "translateY(-10%)" }}>{reading}</rt>
                            </ruby>
                        );
                    }
                    return segment.content;
                };

                // The word being studied is excluded from the gloss card - the
                // surrounding card already shows its meaning, so the tooltip
                // would only restate it.
                const glossed = showGlossOnHover && !segment.isTarget;

                const targetClass = `text-accent font-semibold border-b-2 border-accent/30 px-0.5 ${isClickable ? 'cursor-pointer hover:border-accent transition-colors' : ''}`;
                // No permanent underline: a sentence full of underlines reads as noise. A word
                // shows it is a link on hover and on keyboard focus. No word has a side margin,
                // the studied one included (its padding frames it): Japanese has no spaces between
                // words, and with most words linked (kana ones too) a margin read as a space at
                // nearly every word boundary (実在 する もの と).
                const clickableClass = "cursor-pointer text-primary border-b border-transparent hover:text-accent hover:border-accent focus-visible:outline-none focus-visible:text-accent focus-visible:border-accent transition-colors";
                const matchClassName = emphasized ? targetClass : isClickable ? clickableClass : "";

                if (!isClickable && !glossed && !emphasized) return <span key={i}>{renderContent()}</span>;

                const handleClick = isClickable
                    ? (e: React.MouseEvent) => {
                        e.stopPropagation();
                        onVocabClick?.(segment.vocabId!);
                    }
                    : undefined;

                const linkProps: WordLinkProps | undefined = isClickable && keyboardLinks
                    ? {
                        role: 'link',
                        tabIndex: 0,
                        onKeyDown: e => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            onVocabClick?.(segment.vocabId!);
                        },
                    }
                    : undefined;

                if (!glossed) {
                    return (
                        <span key={i} onClick={handleClick} className={matchClassName} title={isClickable ? "Click to view details" : undefined} {...linkProps}>
                            {renderContent()}
                        </span>
                    );
                }

                return (
                    <WordGlossTooltip
                        key={i}
                        vocabId={segment.vocabId!}
                        className={matchClassName}
                        onClick={handleClick}
                        fallbackTitle={isClickable ? "Click to view details" : undefined}
                        linkProps={linkProps}
                    >
                        {renderContent()}
                    </WordGlossTooltip>
                );
            })}
        </span>
    );
}
