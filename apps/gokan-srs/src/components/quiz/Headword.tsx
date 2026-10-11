import { headwordOf } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";

interface HeadwordProps {
    vocab: Pick<Vocabulary, 'writtenForm' | 'reading' | 'usuallyKana'>;
    size: 'md' | 'lg';
    /** Clicking opens the word's page; only offered once the card is answered. */
    onClick?: () => void;
    /** Show the reading as furigana. */
    showReading?: boolean;
}

/**
 * A word's written form on a quiz card. A word learned in kana is shown in kana
 * (headwordOf), and needs no furigana.
 */
export function Headword({ vocab, size, onClick, showReading = false }: HeadwordProps) {
    const large = size === 'lg';
    const headword = headwordOf(vocab);
    return (
        <div
            className={`relative inline-flex items-start leading-none text-primary font-mincho ${large ? 'text-kanji' : 'text-5xl'} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={onClick}
        >
            {showReading && headword !== vocab.reading.primary ? (
                <ruby className="ruby-text">
                    {headword}
                    <rt className="text-sm font-sans text-secondary not-italic">{vocab.reading.primary}</rt>
                </ruby>
            ) : (
                <span>{headword}</span>
            )}
        </div>
    );
}
