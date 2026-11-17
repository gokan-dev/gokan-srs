import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from 'react-router-dom';
import type { GrammarChapter, GrammarExample, GrammarPoint } from "@gokan/dataset-schema";
import { JlptChip } from "../../components/JlptChip";
import { Disclosure } from "../../components/ui/Disclosure";
import { TextButton } from "../../components/ui/TextButton";
import { LoadingScreen } from "../../components/LoadingScreen";
import { useQuiz } from "../../context/useQuiz";
import { GrammarService } from "../../services/grammar.service";
import { THEME } from "../../commons/theme";
import { GrammarRelatedPointsCard } from "./GrammarRelatedPointsCard";
import { GrammarVariantsCard } from "./GrammarVariantsCard";
import { Page } from "../../components/Page";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useNow } from "../../hooks/useNow";
import { DetailErrorScreen } from "../../components/detail/DetailErrorScreen";
import { DetailField, DetailSection } from "../../components/detail/DetailSection";
import { DetailHeader } from "../../components/detail/DetailHeader";
import { DetailTabsBody } from "../../components/detail/DetailTabsBody";
import { LearnStatus } from "../../components/detail/LearnStatus";
import { YourProgress } from "../../components/detail/YourProgress";
import { useDetailTabs } from "../../components/detail/useDetailTabs";
import { GrammarExampleList, GrammarExamplesPanel, type ListedExample } from "./GrammarExampleList";
import { GRAMMAR_TABS } from "../../utils/detailTabs.utils";
import { directionStatus, grammarLearningStatus, statusReviewPhrase } from "../../utils/learningStatus.utils";
import { grammarNextReviewAt } from "../../services/grammarScheduling";

type GrammarTab = typeof GRAMMAR_TABS.tabs[number];

const TAB_LABEL: Record<GrammarTab, string> = {
    point: 'Point',
    examples: 'Examples',
    related: 'Related',
    study: 'Study',
};

/** The full page's columns: the point and its examples in the main one, the learner's study and the related points beside them. */
const FULL_MAIN: readonly GrammarTab[] = ['point', 'examples'];
const FULL_SIDE: readonly GrammarTab[] = ['study', 'related'];

/** The Point tab's examples, before "All N examples". */
const POINT_EXAMPLES = 2;
/** The Examples section's first page on the full page (its tab: 10). */
const FULL_EXAMPLES = 5;

const KIND_LABELS: Record<NonNullable<GrammarPoint['kind']>, string> = {
    'construction': 'Construction',
    'inflection': 'Inflection',
    'lexical': 'Lexical',
};

const FORMALITY_LABELS: Record<NonNullable<GrammarPoint['formalityLevel']>, string> = {
    'casual': 'Casual',
    'neutral': 'Neutral',
    'polite': 'Polite',
    'formal': 'Formal',
    'very-formal-literary': 'Very formal / literary',
};

interface ChapterLocation {
    chapter: GrammarChapter;
    /** 1-based (issue #58's locator). */
    chapterNumber: number;
}

/**
 * Route /grammar/:grammarId: a grammar point outside a review. A header holding the point, its
 * facts (formality, chapter, kind) and its status; then below `lg` a row of tabs (Point, Examples,
 * Related, Study, each only when it has content), from `lg` the same panels as one full page
 * (DESIGN_SYSTEM section 5, Grammar page).
 */
export default function GrammarDetailScreen() {
    const { grammarId } = useParams<{ grammarId: string }>();
    const pointLoad = useAsyncData(grammarId ?? null, () => GrammarService.loadGrammarPoint(grammarId ?? ''));
    const point: GrammarPoint | null = pointLoad.data ?? null;
    // The point's chapter: null while loading, or when the point is not in the teaching order.
    const chapterLocation: ChapterLocation | null = useAsyncData(grammarId ?? null, async () => {
        const order = await GrammarService.loadTeachingOrder();
        const chapter = order?.chapters.find(c => c.points.includes(grammarId ?? ''));
        return order && chapter ? { chapter, chapterNumber: order.chapters.indexOf(chapter) + 1 } : null;
    }).data ?? null;
    // The corpus-mined pool computeBlankPlan draws review sentences from (issue #73), browsable
    // here as full sentences. null while loading or when there is none.
    const minedLoad = useAsyncData(grammarId ?? null, () => GrammarService.loadMinedExamples(grammarId ?? ''));
    // The other forms of the same point (its variant group), for whether Related has content.
    const hasVariants = useAsyncData(point?.id ?? null, async () => {
        const group = (await GrammarService.loadVariantGroups())[point?.variantOf ?? point?.id ?? ''];
        return (group ?? []).some(m => m.id !== point?.id);
    }).data ?? false;

    if (pointLoad.status === 'error') return <DetailErrorScreen message="Could not load this grammar point." />;
    if (!point) return <LoadingScreen />;
    return (
        // Keyed by the point: another point opens on its own tab choice, its lists collapsed.
        <GrammarPage
            key={point.id}
            point={point}
            chapterLocation={chapterLocation}
            mined={minedLoad.data ?? null}
            examplesSettled={minedLoad.status !== 'loading'}
            hasVariants={hasVariants}
        />
    );
}

interface GrammarPageProps {
    point: GrammarPoint;
    chapterLocation: ChapterLocation | null;
    mined: GrammarExample[] | null;
    /** The corpus examples have loaded (or failed): the page is drawn in full (`data-examples`, which check-layout waits on). */
    examplesSettled: boolean;
    hasVariants: boolean;
}

function GrammarPage({ point, chapterLocation, mined, examplesSettled, hasVariants }: GrammarPageProps) {
    const { state, grammarActions } = useQuiz();
    const now = useNow();
    const progress = state.progress?.grammarQueue.find(g => g.grammarId === point.id);
    const studied = progress?.introductionAt ? { ...progress, introductionAt: progress.introductionAt } : null;
    // One list, the curated examples first, each marked with its source.
    const examples: ListedExample[] = useMemo(() => [
        ...point.examples.map(example => ({ example, source: 'curated' as const })),
        ...(mined ?? []).map(example => ({ example, source: 'corpus' as const })),
    ], [point.examples, mined]);

    const has: Record<GrammarTab, boolean> = {
        point: true,
        examples: examples.length > 0,
        related: (point.family?.relatedPoints.length ?? 0) > 0 || hasVariants,
        study: studied !== null,
    };
    const tabs = useDetailTabs({ set: GRAMMAR_TABS, prefix: 'grammar', has, sections: [...FULL_MAIN, ...FULL_SIDE], settled: examplesSettled });

    const header = (
        <DetailHeader
            parentPath="/grammar/browse"
            layout={tabs.full ? 'grid' : 'column'}
            title={<span className="font-mincho text-3xl md:text-4xl text-primary leading-snug">{point.title}</span>}
            chips={<JlptChip level={point.jlptLevel} />}
            facts={(
                <>
                    {point.formalityLevel && <DetailField compact label="Formality">{FORMALITY_LABELS[point.formalityLevel]}</DetailField>}
                    {chapterLocation && (
                        <DetailField compact label="Position">
                            <Link to={`/grammar/chapters?chapter=${chapterLocation.chapter.id}`} className="text-accent hover:underline">
                                Chapter {chapterLocation.chapterNumber}, point {chapterLocation.chapter.points.indexOf(point.id) + 1} of {chapterLocation.chapter.points.length}
                            </Link>
                        </DetailField>
                    )}
                    <DetailField compact label="Kind">{KIND_LABELS[point.kind ?? 'construction']}</DetailField>
                </>
            )}
            actions={progress && studied ? (
                <LearnStatus
                    inStudy
                    status={grammarLearningStatus(progress)}
                    nextReview={statusReviewPhrase(grammarLearningStatus(progress), grammarNextReviewAt(progress, state.settings), now)}
                />
            ) : (
                <LearnStatus inStudy={false} learnLabel="Learn this grammar point" onLearn={() => grammarActions.saveGrammarIntroChoice(point, 'learn')} />
            )}
        >
            {point.romaji && <p className="type-meta">{point.romaji}</p>}
        </DetailHeader>
    );

    const render = (tab: GrammarTab, preview: boolean): ReactNode => {
        switch (tab) {
            case 'point':
                return <PointPanel point={point} examples={examples} onAllExamples={() => tabs.choose('examples')} />;
            case 'examples':
                return <GrammarExamplesPanel examples={examples} {...(preview ? { pageSize: FULL_EXAMPLES } : {})} />;
            case 'related':
                return (
                    <div className="space-y-10">
                        <GrammarRelatedPointsCard point={point} />
                        <GrammarVariantsCard point={point} />
                    </div>
                );
            case 'study':
                return studied ? (
                    <YourProgress
                        focusable={preview}
                        directions={[{ key: 'grammar', label: 'Mastery', strength: studied.entry.memoryStrength, variant: 'default', status: directionStatus(studied.entry, true, now, state.settings) }]}
                        introductionAt={studied.introductionAt}
                        totalReviews={studied.totalReviews}
                        series={[{ key: 'grammar', label: 'Mastery', entry: studied.entry, color: THEME.mastery.loop1 }]}
                        history={[{ history: studied.entry.history }]}
                    />
                ) : null;
        }
    };

    return (
        <Page width={tabs.full ? 'wide' : 'narrow'} data={{ 'data-examples': examplesSettled ? 'settled' : 'loading' }}>
            {header}
            <DetailTabsBody
                tabs={tabs}
                label="About this grammar point"
                labels={TAB_LABEL}
                main={FULL_MAIN}
                side={FULL_SIDE}
                ownHeadings={['point', 'related', 'study']}
                render={render}
            />
        </Page>
    );
}

/**
 * The Point tab, what a learner opens a point for: its formation, the short explanation (the full
 * one in place on request), when to use it and two examples, then its id folded at the foot.
 */
function PointPanel({ point, examples, onAllExamples }: { point: GrammarPoint; examples: readonly ListedExample[]; onAllExamples: () => void }) {
    const [fullExplanation, setFullExplanation] = useState(false);
    return (
        <div className="space-y-10">
            {/* The one box on these pages: a pattern to copy, an object rather than a section's card. */}
            <DetailSection title="Formation">
                <p className="rounded-md bg-surface border border-divider px-4 py-3 font-gothic text-lg text-primary leading-relaxed break-words whitespace-pre-line">
                    {point.formation}
                </p>
            </DetailSection>
            <DetailSection title="Explanation">
                <p className="font-sans text-lg text-primary leading-relaxed">{point.shortExplanation}</p>
                {point.longExplanation && (fullExplanation
                    ? <p className="type-body mt-3">{point.longExplanation}</p>
                    : <TextButton onClick={() => setFullExplanation(true)} className="mt-3">Read the full explanation</TextButton>)}
            </DetailSection>
            {point.usageNote && (
                <DetailSection title="When to use">
                    <p className="type-body">{point.usageNote}</p>
                </DetailSection>
            )}
            {/* An inflection point has no curated examples: its corpus ones, or nothing rather than an empty section. */}
            {examples.length > 0 && (
                <DetailSection
                    title="Examples"
                    aside={examples.length > POINT_EXAMPLES
                        ? <TextButton onClick={onAllExamples} arrow>All {examples.length.toLocaleString('en-US')} examples</TextButton>
                        : undefined}
                >
                    <GrammarExampleList examples={examples.slice(0, POINT_EXAMPLES)} />
                </DetailSection>
            )}
            <Disclosure title="Dataset details" className="border-t border-divider pt-4">
                <dl><DetailField label="Id">{point.id}</DetailField></dl>
            </Disclosure>
        </div>
    );
}
