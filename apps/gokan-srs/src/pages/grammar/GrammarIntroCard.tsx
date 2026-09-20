import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { GrammarChapter, GrammarPoint } from "../../models/grammar.model";
import { CardSection } from "../../components/ui/CardSection";
import { JlptChip } from "../../components/JlptChip";
import { MasteryRing } from "../../components/MasteryRing";
import { IntroCardShell } from "../../components/IntroCardShell";
import { GrammarDifferentiator } from "../../components/GrammarDifferentiator";
import { GrammarContrastCard } from "../../components/GrammarContrastCard";
import { GrammarService } from "../../services/grammar.service";
import { useQuiz } from "../../context/useQuiz";

interface GrammarIntroCardProps {
    grammarPoint: GrammarPoint;
    onLearn: () => void;
    onSkip: () => void;
}

export function GrammarIntroCard({ grammarPoint, onLearn, onSkip }: GrammarIntroCardProps) {
    const { currentGrammarProgress, state } = useQuiz();
    const [chapter, setChapter] = useState<GrammarChapter | null>(null);

    useEffect(() => {
        let cancelled = false;
        GrammarService.loadChapterFor(grammarPoint.id).then(found => {
            if (!cancelled) setChapter(found);
        });
        return () => { cancelled = true; };
    }, [grammarPoint.id]);

    // Which family siblings the learner has already met, so the register ladder
    // can mark them rather than presenting every rung as new.
    const knownIds = useMemo(() => {
        const ids = new Set<string>();
        for (const g of state.progress?.grammarQueue ?? []) {
            if (g.introductionAt) ids.add(g.grammarId);
        }
        return ids;
    }, [state.progress?.grammarQueue]);

    // Where this point sits in its chapter. Worth showing because a chapter is
    // the unit that carries the lesson - "2 of 9 in the register ladder" tells
    // the learner more than the point alone does.
    const positionInChapter = chapter
        ? chapter.points.indexOf(grammarPoint.id) + 1
        : 0;
    const isChapterOpener = positionInChapter === 1;

    return (
        <IntroCardShell onLearn={onLearn} onSkip={onSkip} learnLabel="Learn this grammar point">
            <CardSection>
                <div className="flex justify-end mb-2">
                    <MasteryRing memoryStrength={currentGrammarProgress?.entry.memoryStrength ?? 0} size={40} />
                </div>

                {chapter && (
                    <div className="text-center mb-3">
                        <p className="uppercase tracking-wide text-label-neutral text-xs font-gothic">
                            {chapter.title}
                            {chapter.points.length > 1 && (
                                <span className="text-tertiary normal-case tracking-normal">
                                    {" "}· {positionInChapter} of {chapter.points.length}
                                </span>
                            )}
                        </p>
                    </div>
                )}

                <div className="text-center">
                    <div className="flex justify-center mb-3">
                        <JlptChip level={grammarPoint.jlptLevel} />
                    </div>
                    <h2 className="text-primary font-mincho text-2xl leading-snug">
                        <Link to={`/grammar/${grammarPoint.id}`} className="hover:underline">
                            {grammarPoint.title}
                        </Link>
                    </h2>
                    {grammarPoint.romaji && (
                        <div className="text-tertiary font-gothic text-sm mt-1">
                            {grammarPoint.romaji}
                        </div>
                    )}
                </div>
            </CardSection>

            {/* The chapter's own summary, shown once when its first point comes
                up - this is where a chapter gets to explain why its members sit
                together, which a per-point explanation cannot do. */}
            {chapter && isChapterOpener && (
                <CardSection>
                    <div className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
                        <p className="uppercase tracking-wide text-label-neutral text-xs mb-1 font-gothic">
                            New chapter
                        </p>
                        <p className="text-primary font-serif text-sm leading-relaxed">
                            {chapter.summary}
                        </p>
                    </div>
                </CardSection>
            )}

            <CardSection>
                <div className="text-center font-serif text-base text-meaning-muted leading-relaxed">
                    {grammarPoint.shortExplanation}
                </div>
            </CardSection>

            <CardSection>
                <div className="rounded-lg border border-divider bg-feedback-background px-4 py-3 text-center">
                    <p className="uppercase tracking-wide text-label-neutral text-xs mb-1 font-gothic">
                        Formation
                    </p>
                    <p className="text-primary font-gothic text-sm">
                        {grammarPoint.formation}
                    </p>
                </div>
            </CardSection>

            {/* Guarded rather than letting the component return null, so an
                unfamilied point doesn't leave an empty bordered section behind. */}
            {grammarPoint.family && grammarPoint.family.relatedPoints.length > 0 && (
                <CardSection>
                    <GrammarDifferentiator point={grammarPoint} knownIds={knownIds} />
                </CardSection>
            )}

            {/* Situational "which one, and when" lesson - shown only when this
                point is the focus of a contrast whose siblings are already known
                (issue #62). Rendered unwrapped (it returns null when there's
                nothing ready) so it never leaves an empty CardSection behind. */}
            <GrammarContrastCard pointId={grammarPoint.id} knownIds={knownIds} />
        </IntroCardShell>
    );
}
