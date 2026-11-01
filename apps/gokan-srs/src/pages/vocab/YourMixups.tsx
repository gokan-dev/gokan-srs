import { useState } from "react";
import { LookupLink } from "../../components/lookup/LookupLink";
import { Marked } from "../../components/ui/Marked";
import { TextButton } from "../../components/ui/TextButton";
import { resultTextClass } from "../../components/quiz/quizStyles";
import type { MixupRecord } from "../../models/mixup.model";
import type { ShownResult } from "../../services/exercise/effects";
import { englishRanges, type ExploreQuery } from "../../utils/exploreSearch.utils";
import { formatShortDate } from "../../utils/time.utils";
import { vocabPath } from "../../utils/navigation.utils";

const INITIAL_COUNT = 5;

/** How the answer was graded, in words. */
function gradedAs({ outcome, meaning }: MixupRecord): string {
    switch (outcome) {
        case 'accepted': return meaning ? `accepted as "${meaning}"` : 'accepted';
        case 'neutral': return 'no penalty';
        case 'wrong': return 'marked wrong';
    }
}

/** A record's outcome as the result the session shows, for its colour. */
function shownResultOf({ outcome }: MixupRecord): ShownResult {
    switch (outcome) {
        case 'accepted': return 'correct';
        case 'neutral': return 'neutral';
        case 'wrong': return 'wrong';
    }
}

/**
 * An answer history, so its results use the feedback pair, the words being the second
 * cue; "no penalty" is neither, so it stays secondary. Spelled out rather than over
 * `type-support`, whose own colour would compete with the feedback one.
 */
function gradedClass(record: MixupRecord): string {
    return `font-sans text-sm ${resultTextClass(shownResultOf(record))}`;
}

/**
 * What the learner typed on this word's cards instead of it, with the card, newest first
 * (`mixupsAsked`: one of it typed on another word's card belongs to that word's history).
 * The word page's Explore Mix-ups panel, which passes the records its search keeps.
 */
export function YourMixups({ vocabId, records, query = null }: { vocabId: string; records: readonly MixupRecord[]; query?: ExploreQuery | null }) {
    // Expansion belongs to one word: keyed by it, so another word starts collapsed.
    const [expandedFor, setExpandedFor] = useState<string | null>(null);
    const expanded = expandedFor === vocabId;

    if (records.length === 0) return null;
    const shown = expanded ? records : records.slice(0, INITIAL_COUNT);

    return (
        <div>
            <ul className="space-y-4">
                {shown.map(record => (
                    <li key={`${record.date}-${record.answer}`} className="min-w-0">
                        {/* The answer is free text: a Latin token the IME left alone has no break point. */}
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            {record.typed ? (
                                <LookupLink to={vocabPath(record.typed)} target={{ kind: 'word', vocabId: record.typed }} lang="ja" className="min-w-0 break-all font-gothic text-base text-accent hover:underline">
                                    {record.answer}
                                </LookupLink>
                            ) : (
                                <span lang="ja" className="min-w-0 break-all font-gothic text-base text-primary">{record.answer}</span>
                            )}
                            <span className={gradedClass(record)}>{gradedAs(record)}</span>
                        </div>
                        <p className="type-support break-words">
                            {record.cue ? <Marked text={record.cue} ranges={englishRanges(query, record.cue)} /> : 'From its English meanings'}
                        </p>
                        <p className="type-meta">{formatShortDate(new Date(record.date))}</p>
                    </li>
                ))}
            </ul>
            {records.length > INITIAL_COUNT && (
                <TextButton onClick={() => setExpandedFor(expanded ? null : vocabId)} className="mt-3">
                    {expanded ? 'Show fewer mix-ups' : 'Show all mix-ups'}
                </TextButton>
            )}
        </div>
    );
}
