import type { Sentence } from "../models/sentence.model";
import { WordGlossTooltip } from "./WordGlossTooltip";
import { segmentInteractiveSentence, type HighlightRange } from "../utils/interactiveSentence.utils";

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
}

export function InteractiveSentence({
    sentence,
    targetVocabId,
    onVocabClick,
    className = "",
    showFurigana = false,
    allowTargetClickable = false,
    showGlossOnHover = true,
    highlightRanges
}: InteractiveSentenceProps) {
    const segments = segmentInteractiveSentence(sentence, { targetVocabId, highlightRanges });

    return (
        <span className={`font-mincho leading-loose md:leading-relaxed break-words ${className}`}>
            {segments.map((segment, i) => {
                // The target class (accent, bold, underline) applies whether the
                // segment is the studied vocab word (isTarget) or falls inside a
                // highlighted range (e.g. a grammar pattern marker) - the two are
                // rendered identically, per issue #89.
                const emphasized = segment.isTarget || segment.isHighlighted;

                if (segment.type === 'text') {
                    if (!emphasized) return <span key={i}>{segment.content}</span>;
                    return (
                        <span key={i} className="text-accent font-bold border-b-2 border-accent/30 mx-0.5 px-0.5">
                            {segment.content}
                        </span>
                    );
                }

                const isClickable = onVocabClick && (!segment.isTarget || allowTargetClickable);

                const rawReading = showFurigana ? segment.reading : null;
                const isKanaOnly = /^[぀-ゟ゠-ヿ]+$/.test(segment.content);
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

                const targetClass = `text-accent font-bold border-b-2 border-accent/30 mx-0.5 px-0.5 ${isClickable ? 'cursor-pointer hover:border-accent transition-colors' : ''}`;
                const clickableClass = "cursor-pointer text-primary border-b border-dashed border-tertiary/50 hover:text-accent hover:border-accent transition-colors mx-0.5";
                const matchClassName = emphasized ? targetClass : isClickable ? clickableClass : "";

                if (!isClickable && !glossed && !emphasized) return <span key={i}>{renderContent()}</span>;

                const handleClick = isClickable
                    ? (e: React.MouseEvent) => {
                        e.stopPropagation();
                        onVocabClick?.(segment.vocabId!);
                    }
                    : undefined;

                if (!glossed) {
                    return (
                        <span key={i} onClick={handleClick} className={matchClassName} title={isClickable ? "Click to view details" : undefined}>
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
                    >
                        {renderContent()}
                    </WordGlossTooltip>
                );
            })}
        </span>
    );
}
