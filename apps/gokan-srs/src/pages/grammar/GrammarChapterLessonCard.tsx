import { Card } from "../../components/ui/Card";
import { CardSection, CardDivider } from "../../components/ui/CardSection";
import { Button } from "../../components/ui/Button";
import { GrammarContrastCard } from "../../components/GrammarContrastCard";

interface Props {
    chapterTitle: string;
    focusPointIds: string[];
    knownIds: Set<string>;
    onContinue: () => void;
}

/**
 * The end-of-chapter review step: once every point in a chapter has been
 * introduced, the contrast lessons anchored to it (lesson.taughtInChapterId)
 * surface here as one consolidated, deliberate recap - reusing
 * GrammarContrastCard per focus point rather than a second set of markup, the
 * same component the per-point intro-time card renders.
 *
 * Complementary to that intro-time card, not a replacement for it: the card at
 * introduction is the just-in-time hint, gated per-learner by
 * selectReadyContrasts (every `vs` sibling already known); this step is the
 * deliberate review of a now-finished chapter, shown once the whole chapter's
 * arrangement can be seen at a glance.
 */
export function GrammarChapterLessonCard({ chapterTitle, focusPointIds, knownIds, onContinue }: Props) {
    return (
        <Card size="lg">
            <CardSection>
                <p className="uppercase tracking-wide text-label-neutral text-xs mb-1 font-gothic text-center">
                    Chapter review
                </p>
                <h2 className="text-primary font-mincho text-xl text-center leading-snug">
                    {chapterTitle}
                </h2>
            </CardSection>

            <CardSection className="space-y-4">
                {focusPointIds.map(id => (
                    <GrammarContrastCard key={id} pointId={id} knownIds={knownIds} />
                ))}
            </CardSection>

            <CardDivider />

            <Button variant="primary" className="w-full" onClick={onContinue}>
                Continue
            </Button>
        </Card>
    );
}
