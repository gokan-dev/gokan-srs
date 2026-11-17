import { MasteryRing } from "../MasteryRing";
import { Disclosure } from "../ui/Disclosure";
import { SRSHistoryGraph, type SRSHistorySeries } from "../SRSHistoryGraph";
import { ReviewTimeline, type ReviewHistorySource } from "../ReviewTimeline";
import { addedLine } from "../../utils/learningStatus.utils";
import { DetailSection } from "./DetailSection";
import { directionGridColumns } from "./directionGrid";

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
    focusable?: boolean;
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
 * "Your study" on a word's or a grammar point's page: a ring and its status for each direction on
 * one row, when it was added and how often reviewed on the heading's line, and the learning curve
 * and review log behind one disclosure. The only place a detail page shows rings: the header does
 * not. `focusable`: its heading takes focus when a link scrolls to it (a full page's section).
 */
export function YourProgress({ directions, introductionAt, totalReviews, series, history, focusable = false }: YourProgressProps) {
    return (
        <DetailSection title="Your study" focusable={focusable} aside={<p className="type-meta">{addedLine(introductionAt, totalReviews)}</p>}>
            {/* One row at every width: below `sm` a column per direction, its status under the ring. */}
            <ul className={`grid ${directionGridColumns(directions.length)} gap-x-4 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-8`}>
                {directions.map(direction => <li key={direction.key} className="min-w-0"><DirectionStatus direction={direction} underOnPhone={directions.length > 1} /></li>)}
            </ul>
            <Disclosure title="Learning curve and review history" className="mt-4">
                <div className="space-y-6">
                    <SRSHistoryGraph introDate={introductionAt} series={series} />
                    <ReviewTimeline sources={history} />
                </div>
            </Disclosure>
        </DetailSection>
    );
}
