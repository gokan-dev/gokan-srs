import { useMemo } from 'react';
import type { SRSEntry, ReviewLog } from '../models/vocabulary.model';
import { Card } from './ui/Card';

interface ReviewTimelineProps {
    readingEntry: SRSEntry;
    meaningEntry: SRSEntry;
    productionEntry?: SRSEntry;
}

interface TimelineEvent extends ReviewLog {
    type: 'reading' | 'meaning' | 'production';
}

export function ReviewTimeline({ readingEntry, meaningEntry, productionEntry }: ReviewTimelineProps) {
    const events = useMemo(() => {
        const rEvents: TimelineEvent[] = readingEntry.history.map(h => ({ ...h, type: 'reading' }));
        const mEvents: TimelineEvent[] = meaningEntry.history.map(h => ({ ...h, type: 'meaning' }));
        const pEvents: TimelineEvent[] = (productionEntry?.history ?? []).map(h => ({ ...h, type: 'production' }));
        return [...rEvents, ...mEvents, ...pEvents].sort((a, b) => b.date - a.date);
    }, [readingEntry, meaningEntry, productionEntry]);

    if (events.length === 0) {
        return null;
    }

    const formatResult = (result: string) => {
        switch (result) {
            case 'correct': return <span className="text-primary font-medium">Correct</span>;
            case 'minor_error': return <span className="text-primary opacity-80">Minor Error</span>;
            case 'wrong': return <span className="text-error font-medium">Incorrect</span>;
            case 'pass': return <span className="text-secondary">Passed</span>;
            default: return <span className="text-secondary">{result}</span>;
        }
    };

    return (
        <Card size="md">
            <h2 className="text-lg font-gothic font-semibold text-primary mb-4">Review History</h2>
            <div className="relative border-l border-divider ml-3 space-y-6 max-h-96 overflow-y-auto pr-4">
                {events.map((event, i) => (
                    <div key={`${event.date}-${event.type}-${i}`} className="relative pl-6">
                        {/* Timeline dot */}
                        <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${event.result === 'wrong' ? 'bg-error' : 'bg-divider'}`} />

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                            <div className="flex items-center gap-2 mb-1 sm:mb-0">
                                <span className="text-sm font-gothic font-medium text-primary capitalize">{event.type}</span>
                                <span className="text-xs text-tertiary font-gothic px-1.5 py-0.5 rounded bg-feedback-background">
                                    {event.interval.toFixed(1)}d interval
                                </span>
                            </div>
                            <span className="text-xs text-tertiary font-gothic">
                                {new Date(event.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm font-gothic">
                            {formatResult(event.result)}
                            {event.latency > 0 && (
                                <span className="text-tertiary text-xs">· {(event.latency / 1000).toFixed(1)}s</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}
