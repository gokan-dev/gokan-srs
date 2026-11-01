import type { Sentence } from "@gokan/dataset-schema";
import { LookupText } from "./lookup/LookupText";
import { Ruby } from "./Ruby";
import { segmentInteractiveSentence, type HighlightRange } from "@gokan/dataset-schema";

interface InteractiveSentenceProps {
    sentence: Sentence;
    targetVocabId?: string; // The specific vocab we are currently studying/viewing
    onVocabClick?: (vocabId: string) => void;
    className?: string;
    showFurigana?: boolean;
    allowTargetClickable?: boolean;
    /**
     * Give each matched word its lookup card (hover, focus, click or tap; see
     * `components/lookup/`). On by default: a learner reading a sentence should
     * not have to navigate away to find out what a word means. Turn it off where
     * the surrounding UI is itself a definition and the card would only repeat it.
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
     * Puts each word in the Tab order, Enter pinning its card (or opening the word,
     * for one without a card). For reading pages (a word's or grammar point's
     * examples); off on quiz cards, where Tab moves between the answer and Submit.
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

                const vocabId = segment.vocabId!;
                const isClickable = onVocabClick && (!segment.isTarget || allowTargetClickable);

                const renderContent = () => (
                    <Ruby text={segment.content} reading={showFurigana ? segment.reading : null} tone="opacity-80" />
                );

                // The word being studied has no card: the surrounding card already shows its
                // meaning, so the card would only restate it.
                const lookedUp = showGlossOnHover && !segment.isTarget;

                const targetClass = `text-accent font-semibold border-b-2 border-accent/30 px-0.5 ${isClickable || lookedUp ? 'cursor-pointer hover:border-accent transition-colors' : ''}`;
                // No permanent underline: a sentence full of underlines reads as noise. A word
                // shows it is a link on hover and on keyboard focus. No word has a side margin,
                // the studied one included (its padding frames it): Japanese has no spaces between
                // words, and with most words linked (kana ones too) a margin read as a space at
                // nearly every word boundary (実在 する もの と).
                const clickableClass = "cursor-pointer text-primary border-b border-transparent hover:text-accent hover:border-accent focus-visible:outline-none focus-visible:text-accent focus-visible:border-accent transition-colors";

                // A word with a card opens it (a click pins it, a tap opens it as a sheet); its
                // page is the card's "Open word page".
                if (lookedUp) {
                    return (
                        <LookupText key={i} target={{ kind: 'word', vocabId }} className={emphasized ? targetClass : clickableClass} focusable={keyboardLinks}>
                            {renderContent()}
                        </LookupText>
                    );
                }

                const matchClassName = emphasized ? targetClass : isClickable ? clickableClass : "";
                if (!isClickable) {
                    return emphasized ? <span key={i} className={matchClassName}>{renderContent()}</span> : <span key={i}>{renderContent()}</span>;
                }

                return (
                    <span
                        key={i}
                        className={matchClassName}
                        title="Click to view details"
                        onClick={e => {
                            e.stopPropagation();
                            onVocabClick(vocabId);
                        }}
                        {...(keyboardLinks ? {
                            role: 'link',
                            tabIndex: 0,
                            onKeyDown: (e: React.KeyboardEvent) => {
                                if (e.key !== 'Enter') return;
                                e.preventDefault();
                                onVocabClick(vocabId);
                            },
                        } : {})}
                    >
                        {renderContent()}
                    </span>
                );
            })}
        </span>
    );
}
