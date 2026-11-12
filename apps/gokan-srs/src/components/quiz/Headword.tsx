import { headwordOf } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { DisplayHeadword } from "../DisplayHeadword";
import { Ruby } from "../Ruby";

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
    const clickable = onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : '';
    const text = <Ruby text={headword} reading={showReading ? vocab.reading.primary : null} tone="text-secondary" />;
    // At display size the headword is scaled to its card's width (DisplayHeadword, issue 239).
    if (large) return <DisplayHeadword headword={headword} className={clickable} onClick={onClick}>{text}</DisplayHeadword>;
    return (
        <div
            className={`relative inline-flex items-start leading-none text-primary font-mincho text-5xl ${clickable}`}
            onClick={onClick}
        >
            <span>{text}</span>
        </div>
    );
}
