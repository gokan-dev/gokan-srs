import { useMemo, useState } from 'react';
import type { ReviewLog } from '../models/vocabulary.model';
import { formatDateTime } from '../utils/time.utils';

/** One direction's reviews, named ("Reading"), or unnamed for a grammar point's single entry. */
export interface ReviewHistorySource {
    label?: string;
    history: ReviewLog[];
}

const PAGE = 20;

const RESULT: Record<ReviewLog['result'], { label: string; className: string }> = {
    correct: { label: 'Correct', className: 'text-feedback-correct' },
    minor_error: { label: 'Almost', className: 'text-feedback-correct' },
    wrong: { label: 'Incorrect', className: 'text-feedback-incorrect' },
    pass: { label: 'Passed', className: 'text-secondary' },
};

/**
 * The review log, newest first, 20 at a time: date, direction, result (in the
 * answer pair, always with its word) and answer time. Rendered inside the
 * "Review history" disclosure of Your progress.
 */
export function ReviewTimeline({ sources }: { sources: ReviewHistorySource[] }) {
    const [shown, setShown] = useState(PAGE);
    const events = useMemo(
        () => sources
            .flatMap(source => source.history
                // Grammar's positive-only credit onto production is not a review the learner made.
                .filter(log => log.source !== 'reinforcement')
                .map(log => ({ ...log, label: source.label })))
            .sort((a, b) => b.date - a.date),
        [sources],
    );

    if (events.length === 0) return <p className="type-support">No reviews yet.</p>;

    return (
        <div>
            <ul className="divide-y divide-divider">
                {events.slice(0, shown).map((event, i) => (
                    <li key={`${event.date}-${event.label ?? ''}-${i}`} className="py-2 flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                            <span className="type-meta block">{formatDateTime(new Date(event.date))}</span>
                            <span className="font-sans text-sm">
                                {event.label && <span className="text-primary">{event.label} · </span>}
                                <span className={RESULT[event.result].className}>{RESULT[event.result].label}</span>
                            </span>
                        </div>
                        {event.latency > 0 && (
                            <span className="type-meta tabular-nums shrink-0">{(event.latency / 1000).toFixed(1)} s</span>
                        )}
                    </li>
                ))}
            </ul>
            {events.length > shown && (
                <button
                    type="button"
                    onClick={() => setShown(s => s + PAGE)}
                    className="mt-2 font-sans text-sm text-accent hover:underline cursor-pointer"
                >
                    Show more
                </button>
            )}
        </div>
    );
}
