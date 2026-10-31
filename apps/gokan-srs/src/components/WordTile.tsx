import { headwordOf, type Vocabulary } from "@gokan/dataset-schema";
import { SecondaryForm } from "./SecondaryForm";
import { LookupLink } from "./lookup/LookupLink";
import { vocabPath } from "../utils/navigation.utils";

interface WordTileProps {
    /** The word: the tile links to its page and shows its lookup card on hover and focus. */
    vocabId: string;
    vocab: Pick<Vocabulary, 'writtenForm' | 'reading' | 'usuallyKana'>;
    /** A sign before the word (= or ≈), with the words it stands for for a screen reader. */
    sign?: { sign: string; label: string };
}

/**
 * One word as a boxed link: a word page's closest synonyms. A box because it links, as a
 * `KanjiTile` is (principle 7): surface, divider border, accent on hover and focus.
 */
export function WordTile({ vocabId, vocab, sign }: WordTileProps) {
    return (
        <LookupLink
            to={vocabPath(vocabId)}
            target={{ kind: 'word', vocabId }}
            className="inline-flex items-baseline gap-2 max-w-full min-w-0 rounded-md border border-divider bg-surface px-3 py-2 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
        >
            {sign && (
                <span className="font-sans text-sm text-secondary">
                    <span aria-hidden="true">{sign.sign}</span>
                    <span className="sr-only">{sign.label}:</span>
                </span>
            )}
            <span lang="ja" className="font-mincho text-lg text-primary">{headwordOf(vocab)}</span>
            <SecondaryForm vocab={vocab} truncate={false} />
        </LookupLink>
    );
}
