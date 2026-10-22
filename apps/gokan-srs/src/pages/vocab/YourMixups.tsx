import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DetailSection } from "../../components/detail/DetailSection";
import { useQuiz } from "../../context/useQuiz";
import type { MixupRecord } from "../../models/mixup.model";
import { mixupsAsked } from "../../utils/mixups.utils";
import { formatShortDate } from "../../utils/time.utils";

const INITIAL_COUNT = 5;

/** How the answer was graded, in words. */
function gradedAs({ outcome, meaning }: MixupRecord): string {
    switch (outcome) {
        case 'accepted': return meaning ? `accepted as "${meaning}"` : 'accepted';
        case 'neutral': return 'no penalty';
        case 'wrong': return 'marked wrong';
    }
}

/**
 * What the learner typed on this word's cards instead of it, with the card, newest
 * first. Only records where this word was asked: one of it typed on another word's
 * card belongs to that word's history. Absent when there are none.
 */
export function YourMixups({ vocabId }: { vocabId: string }) {
    const { state } = useQuiz();
    const records = state.progress?.mixups;
    const mine = useMemo(() => mixupsAsked(records, vocabId), [records, vocabId]);
    // Expansion belongs to one word: keyed by it, so another word starts collapsed.
    const [expandedFor, setExpandedFor] = useState<string | null>(null);
    const expanded = expandedFor === vocabId;

    if (mine.length === 0) return null;
    const shown = expanded ? mine : mine.slice(0, INITIAL_COUNT);

    return (
        <DetailSection title="Your mix-ups" count={mine.length}>
            <ul className="space-y-4">
                {shown.map(record => (
                    <li key={`${record.date}-${record.answer}`} className="min-w-0">
                        {/* The answer is free text: a Latin token the IME left alone has no break point. */}
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            {record.typed ? (
                                <Link to={`/vocab/${record.typed}`} lang="ja" className="min-w-0 break-all font-gothic text-base text-accent hover:underline">
                                    {record.answer}
                                </Link>
                            ) : (
                                <span lang="ja" className="min-w-0 break-all font-gothic text-base text-primary">{record.answer}</span>
                            )}
                            <span className="type-support">{gradedAs(record)}</span>
                        </div>
                        <p className="type-support break-words">
                            {record.cue ?? 'From its English meanings'}
                        </p>
                        <p className="type-meta">{formatShortDate(new Date(record.date))}</p>
                    </li>
                ))}
            </ul>
            {mine.length > INITIAL_COUNT && (
                <button
                    type="button"
                    onClick={() => setExpandedFor(expanded ? null : vocabId)}
                    className="mt-3 font-sans text-sm text-accent hover:underline cursor-pointer"
                >
                    {expanded ? 'Show fewer mix-ups' : 'Show all mix-ups'}
                </button>
            )}
        </DetailSection>
    );
}
