import type { Vocabulary } from "@gokan/dataset-schema";

interface KanjiSpellingNoteProps {
    vocab: Pick<Vocabulary, 'writtenForm' | 'usuallyKana'>;
    className?: string;
}

/**
 * For a word learned in kana (ここ), a quiet line naming its kanji spelling (此処):
 * the learner should recognise it when met, without having to learn it. Renders
 * nothing for any other word. The spelling wraps only as a whole (為 / る is no spelling).
 */
export function KanjiSpellingNote({ vocab, className = '' }: KanjiSpellingNoteProps) {
    if (!vocab.usuallyKana) return null;
    return (
        <div className={`text-sm font-gothic text-tertiary ${className}`}>
            Usually written in kana. Kanji spelling: <span lang="ja" className="inline-block max-w-full font-mincho text-secondary">{vocab.writtenForm.kanji}</span>
        </div>
    );
}
