import React from 'react';
import { useResponsive } from '../context/Responsive/useResponsive';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AnswerResult } from '../services/srs.service';

export interface SessionProgressStats {
    done: number;
    total: number;
    retriesPending: number;
    waiting: number;
    moreNew: boolean;
}

export interface SessionHistoryEntry {
    /** Unique key for the ticker's animation list, e.g. `${id}-${index}`. */
    key: string;
    href: string;
    label: string;
    result: AnswerResult;
    /**
     * Knowledge points this answer moved the item by, which is also exactly how far
     * its MasteryRing moved (one knowledge point is one mastery point - see
     * knowledge.utils.ts). The ticker prints this number and the total is its
     * running sum, so an answer showing +6 moves the total by +6.
     */
    delta: number;
    /**
     * Points credited to the sentence's *vocabulary* by this answer, separately from
     * the item's own delta. Grammar only: a grammar answer also reinforces the words
     * the learner filled in correctly (see GrammarSRSService.applyVocabReinforcement),
     * and that gain was previously invisible. Absent for vocab answers.
     */
    vocabDelta?: number;
}

interface SessionProgressProps {
    stats: SessionProgressStats;
    history: SessionHistoryEntry[];
    /** Plural noun for the waiting note, e.g. "vocab" or "grammar points". */
    waitingNoun: string;
}

/**
 * The `done / total` counter, with two extra signals the flat count can't show:
 *  - retries (highlighted, appended to the total): committed tasks the user got
 *    wrong this session and still has to redo.
 *  - waiting: reviews that came due AFTER this session started - deliberately kept
 *    out of the total so the denominator stays stable, surfaced as "n+ waiting".
 *
 * Note: `moreNew` (whether brand-new content remains learnable at all) is
 * deliberately NOT used on its own to show a fallback "more available" line -
 * given the dataset's size, it's true for virtually every user forever, so it
 * would read as permanent, meaningless noise rather than a signal about what
 * happens after this session. It's only used as the "+" suffix on a genuine
 * waiting count.
 */
const SessionCounter: React.FC<{
    done: number;
    total: number;
    retriesPending: number;
}> = ({ done, total, retriesPending }) => (
    <span className="tabular-nums">
        {done} <span className="text-secondary-400 font-normal">/ {total}</span>
        {retriesPending > 0 && (
            <span className="text-desaturated-red-600 font-normal" title="Answers to redo before this session is complete">
                {' '}+{retriesPending}
            </span>
        )}
    </span>
);

const WaitingNote: React.FC<{ waiting: number; moreNew: boolean; noun: string }> = ({ waiting, moreNew, noun }) => {
    if (waiting === 0) return null;
    const label = `${waiting}${moreNew ? '+' : ''} ${noun} waiting after this session`;
    return <span className="text-secondary-400 text-xs italic">{label}</span>;
};

/**
 * Knowledge points gained this session, as ONE net number that is the plain sum of
 * the per-answer deltas shown in the ticker directly below it. An answer reading +6
 * moves this by +6.
 *
 * It used to show gained and lost as two figures, in points, while the ticker
 * printed percentages that were twice their point value. Three things were wrong at
 * once: the total could not be reconciled with the rows under it, the split invited
 * reading "+18 / -5" as a single quantity when it is two, and the row mixed a
 * percentage with an absolute count. Now: one unit, one number, arithmetic that
 * checks out by eye. The gained/lost breakdown survives in the tooltip for anyone
 * who wants it.
 *
 * `vocabDelta` is summed separately rather than folded in: in a grammar session the
 * answer scores the grammar point AND reinforces the sentence's vocabulary, and
 * those are two different things the learner is building.
 */
const GainsSummary: React.FC<{ history: SessionHistoryEntry[] }> = ({ history }) => {
    if (history.length === 0) return null;

    const net = Math.round(history.reduce((s, h) => s + h.delta, 0));
    const gained = Math.round(history.filter(h => h.delta > 0).reduce((s, h) => s + h.delta, 0));
    const lost = Math.round(Math.abs(history.filter(h => h.delta < 0).reduce((s, h) => s + h.delta, 0)));
    const vocab = Math.round(history.reduce((s, h) => s + (h.vocabDelta ?? 0), 0));

    const title = `Knowledge points this session: +${gained} gained, -${lost} lost`
        + (vocab > 0 ? `, +${vocab} on the vocabulary in these sentences` : '');

    return (
        <span className="text-xs tabular-nums" title={title}>
            <span className={net < 0 ? 'text-desaturated-red-600' : 'text-emerald-600'}>
                {net > 0 ? '+' : ''}{net}
            </span>
            <span className="text-secondary-400"> pts</span>
            {vocab > 0 && (
                <>
                    <span className="text-secondary-300 mx-1">·</span>
                    <span className="text-emerald-600">+{vocab}</span>
                    <span className="text-secondary-400"> vocab</span>
                </>
            )}
        </span>
    );
};

/**
 * Session-progress header shared by both quiz activities (vocab's
 * VocabQuizScreen and GrammarScreen) - the `done / total` counter plus a
 * HistoryTicker of recent answers. Fully presentational: parameterized over
 * `stats`/`history` rather than reading activity-specific context directly,
 * so it makes no assumption about which activity produced the numbers. See
 * quizSelectors.ts's selectSessionStats / grammarSelectors.ts's
 * selectGrammarSessionStats for how each activity computes its own
 * `stats`/`history` (issue #32 follow-up).
 */
export const SessionProgress: React.FC<SessionProgressProps> = ({ stats, history, waitingNoun }) => {
    const { isMobile } = useResponsive();

    const { done, total, retriesPending, waiting, moreNew } = stats;

    // Retries extend the denominator so the bar can't read 100% while redos remain.
    const barTotal = total + retriesPending;
    const progressPercent = barTotal > 0 ? (done / barTotal) * 100 : 0;

    return (
        <div className="w-full max-w-4xl mx-auto mb-6">
            {/* Desktop View */}
            {!isMobile && (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-end mb-1">
                            <div className="flex items-center gap-3">
                                <span className="text-secondary-400 text-sm font-medium">Session Progress</span>
                                <GainsSummary history={history} />
                            </div>
                            <div className="text-secondary-400 text-sm font-medium">
                                <SessionCounter done={done} total={total} retriesPending={retriesPending} />
                            </div>
                        </div>

                        <div className="h-2 bg-secondary-200/50 rounded-full overflow-hidden flex">
                            {/* Progress Segment */}
                            <div
                                className="h-full bg-primary-600 transition-all duration-500 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>

                        <WaitingNote waiting={waiting} moreNew={moreNew} noun={waitingNoun} />
                    </div>

                    {/* Moved History Ticker Below */}
                    <HistoryTicker history={history} />
                </div>
            )}

            {/* Mobile View */}
            {isMobile && (
                <>
                    <div className="flex items-center justify-between px-1">
                        <div className="text-xs font-medium text-secondary-500 uppercase tracking-wider">Session Progress</div>
                        <div className="text-sm font-bold text-primary-700">
                            <SessionCounter done={done} total={total} retriesPending={retriesPending} />
                        </div>
                    </div>
                    {/* Mobile Thin Line */}
                    <div className="h-1 w-full bg-secondary-200 mt-2 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary-600 transition-all duration-500 ease-out"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="px-1 mt-1 flex items-center justify-between gap-2">
                        <WaitingNote waiting={waiting} moreNew={moreNew} noun={waitingNoun} />
                        <GainsSummary history={history} />
                    </div>
                </>
            )}
        </div>
    );
};

const HistoryTicker: React.FC<{ history: SessionHistoryEntry[] }> = ({ history }) => {
    // Most recent is at index 0
    const recentItems = history.slice(0, 5);

    return (
        <div className="flex-1 flex items-center gap-3 overflow-hidden h-8">
            <AnimatePresence initial={false}>
                {recentItems.map((item, index) => (
                    <motion.div
                        key={item.key}
                        initial={{ opacity: 0, y: 10, x: -10 }}
                        animate={{ opacity: 1 - (index * 0.2), y: 0, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center gap-2 text-sm whitespace-nowrap"
                    >
                        <Link
                            to={item.href}
                            className={`font-mincho hover:underline cursor-pointer ${item.result === 'correct' ? 'text-emerald-600' :
                                item.result === 'minor_error' ? 'text-amber-600' :
                                    'text-desaturated-red-600'
                                }`}
                            onClick={(e) => {
                                // Since it's within a ticker, stop propagation isn't strictly necessary but safe
                                e.stopPropagation();
                            }}
                        >
                            {item.label}
                        </Link>

                        {/* Result Icon/Indicator */}
                        {item.result === 'correct' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                        {item.result === 'minor_error' && <AlertCircle className="w-3 h-3 text-amber-500" />}
                        {(item.result === 'wrong' || item.result === 'pass') && <XCircle className="w-3 h-3 text-desaturated-red-500" />}

                        {/* Knowledge points, the same unit the total above sums. Was
                            printed as a percentage that was twice its point value. */}
                        <span className="text-xs text-secondary-400 tabular-nums">
                            {item.delta > 0 ? '+' : ''}{Math.round(item.delta)}
                        </span>

                        {/* Separator for all but last visible */}
                        {index < recentItems.length - 1 && (
                            <span className="text-secondary-300 mx-1">•</span>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>

            {history.length === 0 && (
                <span className="text-secondary-400 text-sm italic">Session started...</span>
            )}
        </div>
    );
};
