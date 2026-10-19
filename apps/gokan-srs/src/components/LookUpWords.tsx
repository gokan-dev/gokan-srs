import { Link } from "react-router-dom";
import { mixupsPath } from "../utils/navigation.utils";

interface LookUpWord {
    vocabId: string;
    written: string;
}

interface LookUpWordsProps {
    words: LookUpWord[];
    onVocabClick?: (vocabId: string) => void;
    /** The word asked, when another word was typed for it: links to its groups on the Mix-ups page. */
    mixupsOf?: string;
}

/**
 * A row of words a quiz card's feedback offers to open, e.g. the tested word and
 * the near-synonym the learner typed instead, and under it a link to the asked
 * word's groups on the Mix-ups page. Opening either pauses the session rather than
 * ending it (see context/quiz/sessionRoutes.ts), so the learner comes back to the
 * same card. The words are buttons, since they sit inside the card's form and the
 * navigation is owned by the caller's onVocabClick; the Mix-ups link is a link.
 */
export function LookUpWords({ words, onVocabClick, mixupsOf }: LookUpWordsProps) {
    const unique = words.filter((word, index) => words.findIndex(w => w.vocabId === word.vocabId) === index);
    if (!onVocabClick || unique.length === 0) return null;

    return (
        <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2 text-sm font-gothic">
                <span className="text-secondary">Look up:</span>
                {unique.map(word => (
                    <button
                        key={word.vocabId}
                        type="button"
                        onClick={() => onVocabClick(word.vocabId)}
                        title={`Open the page for ${word.written}`}
                        className="inline-flex items-center min-h-9 px-3 rounded-md border border-divider text-accent font-mincho text-base hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                    >
                        {word.written}
                    </button>
                ))}
            </div>
            {/* Its own line, so it does not read as a third word to look up. */}
            {mixupsOf && (
                <div className="mt-2">
                    <Link to={mixupsPath(mixupsOf)} className="font-sans text-sm text-accent hover:underline">
                        Compare in Mix-ups
                    </Link>
                </div>
            )}
        </div>
    );
}
