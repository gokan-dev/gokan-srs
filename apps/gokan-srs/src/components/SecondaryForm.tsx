import { secondaryForm, type Vocabulary } from "@gokan/dataset-schema";

interface Props {
    vocab: Pick<Vocabulary, 'writtenForm' | 'reading' | 'usuallyKana'>;
    /**
     * Cut with an ellipsis when the row is narrow (the default). Off, the form never breaks
     * either: it is one unit beside its headword, so the row wraps around it instead.
     */
    truncate?: boolean;
}

/**
 * The form beside a word's headword (secondaryForm): its reading in gothic, or for a word
 * learned in kana its kanji spelling (ここ 此処), in mincho like any other kanji headword.
 * Every list draws it here, so the spelling looks the same wherever the word is named.
 */
export function SecondaryForm({ vocab, truncate = true }: Props) {
    const font = vocab.usuallyKana ? 'font-mincho' : 'font-gothic';
    return (
        <span lang="ja" className={`${font} text-sm text-secondary ${truncate ? 'truncate' : 'whitespace-nowrap'}`}>
            {secondaryForm(vocab)}
        </span>
    );
}
