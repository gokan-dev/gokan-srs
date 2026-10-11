import { Link, useParams } from 'react-router-dom';
import type { GrammarChapter, GrammarExample, GrammarPoint } from "@gokan/dataset-schema";
import { JlptChip } from "../../components/JlptChip";
import { Chip } from "../../components/ui/Chip";
import { Disclosure } from "../../components/ui/Disclosure";
import { LoadingScreen } from "../../components/LoadingScreen";
import { useResponsive } from "../../context/Responsive/useResponsive";
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
import { LearnStatus } from "../../components/detail/LearnStatus";
import { YourProgress } from "../../components/detail/YourProgress";
import { GrammarExampleList } from "./GrammarExampleList";
import { directionStatus, grammarLearningStatus } from "../../utils/learningStatus.utils";

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

/**
 * Route /grammar/:grammarId: a grammar point outside a review. The same frame
 * as a word's page: the point itself as the header with the main action, the
 * teaching (formation, explanation, when to use, examples) in the main column,
 * the learner's progress and the related points beside it.
 */
export default function GrammarDetailScreen() {
    const { grammarId } = useParams<{ grammarId: string }>();
    const { isMobile, isTablet } = useResponsive();
    const { state, grammarActions } = useQuiz();
    const now = useNow();
    const pointLoad = useAsyncData(grammarId ?? null, () => GrammarService.loadGrammarPoint(grammarId ?? ''));
    const point: GrammarPoint | null = pointLoad.data ?? null;
    // The point's chapter and its 1-based number (issue #58's locator). null while
    // loading, or when the point is not in the teaching order: then it is not shown.
    const chapterLocation: { chapter: GrammarChapter; chapterNumber: number } | null = useAsyncData(grammarId ?? null, async () => {
        const order = await GrammarService.loadTeachingOrder();
        const chapter = order?.chapters.find(c => c.points.includes(grammarId ?? ''));
        return order && chapter ? { chapter, chapterNumber: order.chapters.indexOf(chapter) + 1 } : null;
    }).data ?? null;
    // The corpus-mined pool computeBlankPlan draws review sentences from (issue #73),
    // browsable here as full sentences. null while loading or when there is none.
    const minedExamples: GrammarExample[] | null = useAsyncData(grammarId ?? null, () => GrammarService.loadMinedExamples(grammarId ?? '')).data ?? null;

    const progress = state.progress?.grammarQueue.find(g => g.grammarId === grammarId);

    if (pointLoad.status === 'error') return <DetailErrorScreen message="Could not load this grammar point." />;
    if (!point) return <LoadingScreen />;

    const studied = !!progress?.introductionAt;
    const entryStatus = progress ? directionStatus(progress.entry, studied, now) : '';

    const header = (
        <DetailHeader
            parentPath="/grammar/browse"
            title={<span className="font-mincho text-3xl md:text-4xl text-primary leading-snug">{point.title}</span>}
            chips={
                <>
                    <JlptChip level={point.jlptLevel} />
                    {point.formalityLevel && <Chip>{FORMALITY_LABELS[point.formalityLevel]}</Chip>}
                </>
            }
            actions={progress && studied ? (
                <LearnStatus
                    inStudy
                    status={grammarLearningStatus(progress)}
                    nextReview={entryStatus}
                />
            ) : (
                <LearnStatus inStudy={false} learnLabel="Learn this grammar point" onLearn={() => grammarActions.saveGrammarIntroChoice(point, 'learn')} />
            )}
        >
            {point.romaji && <p className="type-meta">{point.romaji}</p>}
            {chapterLocation && (
                <p>
                    <Link
                        to={`/grammar/chapters?chapter=${chapterLocation.chapter.id}`}
                        className="font-sans text-sm text-accent hover:underline"
                    >
                        Chapter {chapterLocation.chapterNumber}, point {chapterLocation.chapter.points.indexOf(point.id) + 1} of {chapterLocation.chapter.points.length}
                    </Link>
                </p>
            )}
        </DetailHeader>
    );

    const formation = (
        <DetailSection title="Formation">
            <p className="rounded-md bg-surface border border-divider px-4 py-3 font-gothic text-lg text-primary leading-relaxed break-words whitespace-pre-line">
                {point.formation}
            </p>
        </DetailSection>
    );

    const explanation = (
        <DetailSection title="Explanation">
            <p className="font-sans text-lg text-primary leading-relaxed">{point.shortExplanation}</p>
            <p className="type-body mt-3">{point.longExplanation}</p>
        </DetailSection>
    );

    const whenToUse = point.usageNote ? (
        <DetailSection title="When to use">
            <p className="type-body">{point.usageNote}</p>
        </DetailSection>
    ) : null;

    // Inflection points are drilled through generated conjugations, so they have no
    // authored examples: nothing rather than an empty section.
    const examples = point.examples.length === 0 ? null : (
        <DetailSection title="Example sentences" count={point.examples.length}>
            <GrammarExampleList examples={point.examples} initialCount={6} />
        </DetailSection>
    );

    const moreExamples = minedExamples && minedExamples.length > 0 ? (
        <Disclosure title={`More examples from the corpus (${minedExamples.length})`}>
            <GrammarExampleList examples={minedExamples} initialCount={5} />
        </Disclosure>
    ) : null;

    const yourProgress = progress?.introductionAt ? (
        <YourProgress
            directions={[{ key: 'grammar', label: 'Mastery', strength: progress.entry.memoryStrength, variant: 'default', status: entryStatus }]}
            introductionAt={progress.introductionAt}
            totalReviews={progress.totalReviews}
            series={[{ key: 'grammar', label: 'Mastery', entry: progress.entry, color: THEME.mastery.loop1 }]}
            history={[{ history: progress.entry.history }]}
        />
    ) : null;

    const datasetDetails = (
        <Disclosure title="Dataset details">
            <dl className="space-y-3">
                <DetailField label="Kind">{point.kind ? KIND_LABELS[point.kind] : 'Construction'}</DetailField>
                <DetailField label="Id">{point.id}</DetailField>
            </dl>
        </Disclosure>
    );

    const main = <>{formation}{explanation}{whenToUse}{examples}{moreExamples}</>;
    const side = (
        <>
            {yourProgress}
            <GrammarRelatedPointsCard point={point} />
            <GrammarVariantsCard point={point} />
            {datasetDetails}
        </>
    );

    return (
        <Page width="wide">
            {header}
            {!isMobile && !isTablet ? (
                <div className="grid grid-cols-12 gap-10 items-start">
                    <div className="col-span-8 space-y-10 min-w-0">{main}</div>
                    <div className="col-span-4 space-y-10 min-w-0">{side}</div>
                </div>
            ) : (
                <div className="space-y-10">
                    {main}
                    {side}
                </div>
            )}
        </Page>
    );
}
