import type { VocabProgress } from "../../models/vocabulary.model";
import { THEME } from "../../commons/theme";
import { DetailSection } from "../../components/detail/DetailSection";
import { DirectionStatus, type ProgressDirection } from "../../components/detail/YourProgress";
import { ReviewTimeline } from "../../components/ReviewTimeline";
import { SRSHistoryGraph } from "../../components/SRSHistoryGraph";
import { Disclosure } from "../../components/ui/Disclosure";
import { TextButton } from "../../components/ui/TextButton";
import { isProductionActivated, isReadingRelevant } from "../../services/scheduling";
import { addedLine, directionStatus } from "../../utils/learningStatus.utils";

interface YourStudyProps {
    progress: VocabProgress & { introductionAt: Date };
    now: number;
    /** How many mix-ups the learner made on this word's cards (mixupsAsked). */
    mixups: number;
    onShowMixups: () => void;
}

/**
 * A studied word's progress on its page: a ring and its status for each direction on one row,
 * when it was added and how often reviewed on the heading's line, its mix-ups (opening Explore
 * on them), and the learning curve and review log behind one disclosure.
 */
export function YourStudy({ progress, now, mixups, onShowMixups }: YourStudyProps) {
    // A word learned in kana has no reading direction: no ring, due date or curve for it.
    const readingRelevant = isReadingRelevant(progress);
    // Activation, not a pending due date: a mastered production entry has no dueDate.
    const productionActivated = isProductionActivated(progress.production);

    const directions: ProgressDirection[] = [
        ...(readingRelevant ? [{ key: 'reading', label: 'Reading', strength: progress.reading.memoryStrength, variant: 'reading' as const, status: directionStatus(progress.reading, true, now) }] : []),
        { key: 'meaning', label: 'Meaning', strength: progress.meaning.memoryStrength, variant: 'meaning' as const, status: directionStatus(progress.meaning, true, now) },
        // "Not started" rather than a hidden ring: production activates lazily, and an
        // absent one reads as the feature being broken.
        { key: 'production', label: 'Production', strength: progress.production?.memoryStrength ?? 0, variant: 'production' as const, status: directionStatus(progress.production, productionActivated, now) },
    ];

    return (
        <DetailSection title="Your study" aside={<p className="type-meta">{addedLine(progress.introductionAt, progress.totalReviews)}</p>}>
            {/* One row at every width: below `sm` a column per direction, its status under the ring. */}
            <ul className={`grid ${directions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-x-4 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-8`}>
                {directions.map(direction => <li key={direction.key} className="min-w-0"><DirectionStatus direction={direction} underOnPhone /></li>)}
            </ul>
            {mixups > 0 && (
                <p className="type-support mt-4">
                    You mixed it up {mixups === 1 ? 'once' : `${mixups.toLocaleString('en-US')} times`}.{' '}
                    <TextButton onClick={onShowMixups} arrow>See your mix-ups</TextButton>
                </p>
            )}
            <Disclosure title="Learning curve and review history" className="mt-4">
                <div className="space-y-6">
                    <SRSHistoryGraph
                        introDate={progress.introductionAt}
                        series={[
                            ...(readingRelevant ? [{ key: 'reading', label: 'Reading', entry: progress.reading, color: THEME.mastery.reading.loop1 }] : []),
                            { key: 'meaning', label: 'Meaning', entry: progress.meaning, color: THEME.mastery.meaning.loop1 },
                            // Only once activated: an un-started entry would draw a flat zero line.
                            ...(productionActivated && progress.production
                                ? [{ key: 'production', label: 'Production', entry: progress.production, color: THEME.mastery.production.loop1 }]
                                : []),
                        ]}
                    />
                    <ReviewTimeline sources={[
                        { label: 'Reading', history: progress.reading.history },
                        { label: 'Meaning', history: progress.meaning.history },
                        { label: 'Production', history: progress.production?.history ?? [] },
                    ]} />
                </div>
            </Disclosure>
        </DetailSection>
    );
}
