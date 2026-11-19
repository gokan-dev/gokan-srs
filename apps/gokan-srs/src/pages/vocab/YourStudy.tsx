import type { VocabProgress } from "../../models/vocabulary.model";
import { THEME } from "../../commons/theme";
import { YourProgress, type ProgressDirection } from "../../components/detail/YourProgress";
import { isProductionActivated, isReadingRelevant } from "../../services/scheduling";
import { directionStatus } from "../../utils/learningStatus.utils";
import { useQuiz } from "../../context/useQuiz";

interface YourStudyProps {
    progress: VocabProgress & { introductionAt: Date };
    now: number;
}

/**
 * A studied word's progress in its Study tab: a ring and its status for each direction on one
 * row, when it was added and how often reviewed on the heading's line, and the learning curve and
 * review log behind one disclosure. A due direction says its stage: the page's header is the one
 * place that says "Due now".
 */
export function YourStudy({ progress, now }: YourStudyProps) {
    // A word learned in kana has no reading direction: no ring, due date or curve for it.
    const { state: { settings } } = useQuiz();
    const readingRelevant = isReadingRelevant(progress);
    // Activation, not a pending due date: a mastered production entry has no dueDate.
    const productionActivated = isProductionActivated(progress.production);

    const directions: ProgressDirection[] = [
        ...(readingRelevant ? [{ key: 'reading', label: 'Reading', strength: progress.reading.memoryStrength, variant: 'reading' as const, status: directionStatus(progress.reading, true, now, settings, true) }] : []),
        { key: 'meaning', label: 'Meaning', strength: progress.meaning.memoryStrength, variant: 'meaning' as const, status: directionStatus(progress.meaning, true, now, settings, true) },
        // "Not started" rather than a hidden ring: production activates lazily, and an
        // absent one reads as the feature being broken.
        { key: 'production', label: 'Production', strength: progress.production?.memoryStrength ?? 0, variant: 'production' as const, status: directionStatus(progress.production, productionActivated, now, settings, true) },
    ];

    return (
        <YourProgress
            directions={directions}
            introductionAt={progress.introductionAt}
            totalReviews={progress.totalReviews}
            series={[
                ...(readingRelevant ? [{ key: 'reading', label: 'Reading', entry: progress.reading, color: THEME.mastery.reading.loop1 }] : []),
                { key: 'meaning', label: 'Meaning', entry: progress.meaning, color: THEME.mastery.meaning.loop1 },
                // Only once activated: an un-started entry would draw a flat zero line.
                ...(productionActivated && progress.production
                    ? [{ key: 'production', label: 'Production', entry: progress.production, color: THEME.mastery.production.loop1 }]
                    : []),
            ]}
            history={[
                { label: 'Reading', history: progress.reading.history },
                { label: 'Meaning', history: progress.meaning.history },
                { label: 'Production', history: progress.production?.history ?? [] },
            ]}
        />
    );
}
