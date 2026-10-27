import { MasteryRing } from "../MasteryRing";
import { Disclosure } from "../ui/Disclosure";
import { SRSHistoryGraph, type SRSHistorySeries } from "../SRSHistoryGraph";
import { ReviewTimeline, type ReviewHistorySource } from "../ReviewTimeline";
import { addedLine } from "../../utils/learningStatus.utils";
import { DetailSection } from "./DetailSection";

export interface ProgressDirection {
    key: string;
    label: string;
    strength: number;
    variant: 'default' | 'reading' | 'meaning' | 'production';
    /** "Next review in 3 days", "Due now", "Not started", "Mastered" (`directionStatus`). */
    status: string;
}

interface YourProgressProps {
    directions: ProgressDirection[];
    introductionAt: Date;
    totalReviews: number;
    series: SRSHistorySeries[];
    history: ReviewHistorySource[];
}

/**
 * A direction's ring, its name and status beside it. `underOnPhone` puts the name and status
 * centred under the ring below `sm`, so three directions share one row on a phone (a word's Your study).
 */
export function DirectionStatus({ direction, underOnPhone = false }: { direction: ProgressDirection; underOnPhone?: boolean }) {
    return (
        <div className={`flex items-center min-w-0 ${underOnPhone ? 'flex-col gap-2 text-center sm:flex-row sm:gap-3 sm:text-left' : 'gap-3'}`}>
            <MasteryRing memoryStrength={direction.strength} size={40} variant={direction.variant} label={direction.label} />
            <div className="min-w-0">
                <div className="type-label">{direction.label}</div>
                <div className="type-support">{direction.status}</div>
            </div>
        </div>
    );
}

/**
 * "Your progress" on a word's or a grammar point's page: one row per direction
 * with its ring, its value and when it is next reviewed, when it was added and
 * how often reviewed, the learning curve, and the review log behind a
 * disclosure. The only place a detail page shows rings (a word's page: its Your study): the
 * header does not.
 */
export function YourProgress({ directions, introductionAt, totalReviews, series, history }: YourProgressProps) {
    return (
        <DetailSection title="Your progress">
            <ul className="space-y-3">
                {directions.map(direction => (
                    <li key={direction.key}><DirectionStatus direction={direction} /></li>
                ))}
            </ul>
            <p className="type-meta mt-4">{addedLine(introductionAt, totalReviews)}</p>
            <div className="mt-6">
                <SRSHistoryGraph series={series} introDate={introductionAt} />
            </div>
            <Disclosure title="Review history" className="mt-4">
                <ReviewTimeline sources={history} />
            </Disclosure>
        </DetailSection>
    );
}
