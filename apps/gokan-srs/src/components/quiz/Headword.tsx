import { Combine } from "lucide-react";
import type { Vocabulary } from "@gokan/dataset-schema";

interface HeadwordProps {
    vocab: Pick<Vocabulary, 'writtenForm' | 'reading' | 'mergedVocabs'>;
    size: 'md' | 'lg';
    /** Clicking opens the word's page; only offered once the card is answered. */
    onClick?: () => void;
    /** Show the reading as furigana. */
    showReading?: boolean;
}

/**
 * A word's written form on a quiz card, marked when it is a merged entry (several
 * JMdict homographs sharing one written form).
 */
export function Headword({ vocab, size, onClick, showReading = false }: HeadwordProps) {
    const merged = !!vocab.mergedVocabs && vocab.mergedVocabs.length > 1;
    const large = size === 'lg';
    return (
        <div
            className={`relative inline-flex items-start leading-none text-primary font-mincho ${large ? 'text-kanji' : 'text-5xl'} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={onClick}
            title={merged ? "Merged Entry (combines multiple JMDict words)" : undefined}
        >
            {showReading ? (
                <ruby className="ruby-text">
                    {vocab.writtenForm.kanji}
                    <rt className="text-sm font-sans text-secondary not-italic">{vocab.reading.primary}</rt>
                </ruby>
            ) : (
                <span>{vocab.writtenForm.kanji}</span>
            )}
            {merged && (
                <span className={`absolute top-0 ${large ? '-right-8' : '-right-6'}`}>
                    <Combine size={large ? 24 : 18} className={`text-divider ${large ? 'opacity-30' : 'opacity-40'}`} />
                </span>
            )}
        </div>
    );
}
