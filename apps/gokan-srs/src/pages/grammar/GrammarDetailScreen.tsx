import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { GrammarChapter, GrammarExample, GrammarPoint } from "../../models/grammar.model";
import { Card } from "../../components/ui/Card";
import { MasteryRing } from "../../components/MasteryRing";
import { JlptChip } from "../../components/JlptChip";
import { Button } from "../../components/ui/Button";
import { LoadingScreen } from "../../components/LoadingScreen";
import { SRSHistoryGraph } from "../../components/SRSHistoryGraph";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { useQuiz } from "../../context/useQuiz";
import { GrammarService } from "../../services/grammar.service";
import { THEME } from "../../commons/theme";
import { GrammarRelatedPointsCard } from "./GrammarRelatedPointsCard";
import { GrammarVariantsCard } from "./GrammarVariantsCard";
import { GrammarDifferentiator } from "../../components/GrammarDifferentiator";
import { InteractiveSentence } from "../../components/InteractiveSentence";
import { grammarExampleToSentence, patternHighlightRanges } from "../../utils/grammarSentence.utils";
import { PageHeader } from "../../components/PageHeader";

const MINED_INITIAL_COUNT = 5;

const KIND_LABELS: Record<string, string> = {
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
 * Route /grammar/:grammarId - a single grammar point's details outside of a
 * live review, mirroring VocabDetailScreen's layout and section conventions.
 */
export default function GrammarDetailScreen() {
    const { grammarId } = useParams<{ grammarId: string }>();
    const navigate = useNavigate();
    const { isMobile } = useResponsive();
    const { state, grammarActions } = useQuiz();
    const [point, setPoint] = useState<GrammarPoint | null>(null);
    const [error, setError] = useState<string | null>(null);
    // The point's chapter + its 1-based position among all chapters (issue
    // #58's detail-page locator). null while loading, or when the order file
    // isn't available - same "just don't show it" failure direction
    // GrammarSRSService.getCurrentChapter uses.
    const [chapterLocation, setChapterLocation] = useState<{ chapter: GrammarChapter; chapterNumber: number } | null>(null);
    // Corpus-mined examples (issue #73's follow-up): a read-only browsing view
    // of the same pool computeBlankPlan draws review sentences from, so the
    // mined data is inspectable without grinding a point to its 2nd review.
    // null while loading or when the point has no mined pool at all - both
    // read as "render nothing", same as GrammarRelatedPointsCard's failure
    // direction.
    const [minedExamples, setMinedExamples] = useState<GrammarExample[] | null>(null);
    const [isMinedSectionOpen, setIsMinedSectionOpen] = useState(false);
    const [isMinedExpanded, setIsMinedExpanded] = useState(false);

    useEffect(() => {
        if (!grammarId) return;

        setPoint(null);
        setError(null);

        GrammarService.loadGrammarPoint(grammarId)
            .then(setPoint)
            .catch(err => {
                console.error("Failed to load grammar point", err);
                setError("Could not load grammar point details.");
            });
    }, [grammarId]);

    useEffect(() => {
        if (!grammarId) return;

        setMinedExamples(null);
        setIsMinedSectionOpen(false);
        setIsMinedExpanded(false);
        GrammarService.loadMinedExamples(grammarId).then(setMinedExamples);
    }, [grammarId]);

    useEffect(() => {
        if (!grammarId) return;

        setChapterLocation(null);
        GrammarService.loadTeachingOrder().then(order => {
            if (!order) return;
            const chapter = order.chapters.find(c => c.points.includes(grammarId));
            if (!chapter) return;
            setChapterLocation({ chapter, chapterNumber: order.chapters.indexOf(chapter) + 1 });
        });
    }, [grammarId]);

    const progress = state.progress?.grammarQueue.find(g => g.grammarId === grammarId);

    // Which family siblings the learner has already met, for GrammarDifferentiator's
    // register ladder (mirrors GrammarIntroCard's own knownIds computation).
    const knownIds = useMemo(() => {
        const ids = new Set<string>();
        for (const g of state.progress?.grammarQueue ?? []) {
            if (g.introductionAt) ids.add(g.grammarId);
        }
        return ids;
    }, [state.progress?.grammarQueue]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 text-center">
                <div>
                    <h2 className="text-xl font-bold text-error mb-2">Error</h2>
                    <p className="text-secondary mb-4">{error}</p>
                    <Button onClick={() => void navigate(-1)}>Go Back</Button>
                </div>
            </div>
        );
    }

    if (!point) {
        return <LoadingScreen />;
    }

    /**
     * Identity block. Previously a centred single column with the mastery ring
     * alone on its own row, which left a band of empty space above the title and
     * pushed everything else down. The ring now sits inline with the chips, and
     * the whole card reads as one left-aligned unit.
     */
    const headerCard = (
        <Card size={isMobile ? "sm" : "md"}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                        <JlptChip level={point.jlptLevel} />
                        {point.formalityLevel && (
                            <span className="px-2 py-0.5 text-xs rounded border border-secondary/30 text-secondary font-gothic font-medium whitespace-nowrap">
                                {FORMALITY_LABELS[point.formalityLevel]}
                            </span>
                        )}
                        {point.kind && (
                            <span className="px-2 py-0.5 text-xs rounded border border-divider text-tertiary font-gothic whitespace-nowrap">
                                {KIND_LABELS[point.kind] ?? point.kind}
                            </span>
                        )}
                    </div>
                    <h2 className="text-primary font-mincho text-2xl md:text-3xl leading-snug break-words">
                        {point.title}
                    </h2>
                    {point.romaji && (
                        <p className="text-tertiary font-gothic text-sm mt-1">{point.romaji}</p>
                    )}
                    {/*
                      * Chapter locator (issue #58): where this point sits in the
                      * curriculum, linking to the chapter browser with this
                      * chapter pre-expanded. Silently absent when the teaching
                      * order can't be loaded or this point isn't in it (e.g. an
                      * excluded/untestable point) - same failure direction as
                      * every other chapter-derived display in the app.
                      */}
                    {chapterLocation && (
                        <p className="text-xs font-gothic text-tertiary mt-1">
                            <Link
                                to={`/grammar/chapters?chapter=${chapterLocation.chapter.id}`}
                                className="hover:text-accent hover:underline"
                            >
                                Chapter {chapterLocation.chapterNumber} &middot; {chapterLocation.chapter.points.indexOf(point.id) + 1} of {chapterLocation.chapter.points.length}
                            </Link>
                        </p>
                    )}
                </div>
                <MasteryRing memoryStrength={progress?.entry.memoryStrength ?? 0} size={48} />
            </div>

            {point.usageNote && (
                <p className="text-sm text-secondary font-serif leading-relaxed mt-4 pt-4 border-t border-divider">
                    {point.usageNote}
                </p>
            )}

            <div className="mt-4 pt-4 border-t border-divider">
                {progress ? (
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-tertiary font-gothic uppercase tracking-wider">
                            {progress.stage === 'graduated' ? 'Graduated' : 'In your queue'}
                        </span>
                        <Button variant="secondary" onClick={() => void navigate('/grammar')}>
                            Go to grammar
                        </Button>
                    </div>
                ) : (
                    <Button
                        className="w-full"
                        onClick={() => grammarActions.saveGrammarIntroChoice(point, 'learn')}
                    >
                        Add to Grammar Queue
                    </Button>
                )}
            </div>
        </Card>
    );

    const explanationCard = (
        <Card size={isMobile ? "sm" : "md"}>
            <h2 className="text-lg font-gothic font-semibold text-primary mb-4">Explanation</h2>
            <div className="space-y-4">
                <p className="text-base text-meaning-muted font-serif leading-relaxed">
                    {point.shortExplanation}
                </p>
                <p className="text-sm text-secondary font-serif leading-relaxed">
                    {point.longExplanation}
                </p>
            </div>
        </Card>
    );

    /**
     * Formation is a single short line, so a full card with a heading and a
     * boxed row inside it was mostly padding. Rendered as a labelled row
     * instead, and folded into the left column next to the identity block.
     */
    const formationCard = (
        <Card size={isMobile ? "sm" : "md"}>
            <h2 className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-2">Formation</h2>
            <p className="text-primary font-gothic text-base leading-relaxed break-words whitespace-pre-line">
                {point.formation}
            </p>
        </Card>
    );

    // Inflection points (kind: 'inflection') are drilled through a generated
    // conjugation exercise rather than authored example sentences, so
    // point.examples is always empty for them - render nothing rather than an
    // empty "Example Sentences (0)" card.
    const examplesCard = point.examples.length === 0 ? null : (
        <Card size={isMobile ? "sm" : "md"}>
            <h2 className="text-lg font-gothic font-semibold text-primary mb-4">
                Example Sentences <span className="text-sm font-normal text-tertiary ml-2">({point.examples.length})</span>
            </h2>
            <div>
                {point.examples.map((example, i) => (
                    <div key={i} className={`pb-4 ${i < point.examples.length - 1 ? 'border-b border-divider mb-4' : ''}`}>
                        <div className="text-xl leading-relaxed text-primary mb-1">
                            <InteractiveSentence
                                sentence={grammarExampleToSentence(example, i)}
                                onVocabClick={(vid) => void navigate(`/vocab/${vid}`)}
                                showFurigana={true}
                                highlightRanges={patternHighlightRanges(example)}
                            />
                        </div>
                        <div className="text-sm text-tertiary font-gothic mb-1">
                            {example.romaji}
                        </div>
                        <div className="text-sm text-secondary font-serif">
                            {example.en}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );

    // Read-only browsing of the corpus-mined pool (issue #73 follow-up): full
    // sentences, no blanks - this is a study/reference view, not the quiz's
    // recall test. Collapsed by default since a point can carry up to 60 of
    // these, then capped to MINED_INITIAL_COUNT with a "Show all N" toggle
    // once opened, mirroring GrammarRelatedPointsCard's cap/expand shape.
    const displayedMinedExamples = isMinedExpanded ? (minedExamples ?? []) : (minedExamples ?? []).slice(0, MINED_INITIAL_COUNT);
    const moreExamplesCard = minedExamples && minedExamples.length > 0 ? (
        <Card size={isMobile ? "sm" : "md"}>
            <button
                type="button"
                onClick={() => setIsMinedSectionOpen(v => !v)}
                className="w-full flex items-center justify-between gap-2 text-left"
            >
                <h2 className="text-lg font-gothic font-semibold text-primary">
                    More examples from the corpus <span className="text-sm font-normal text-tertiary ml-2">({minedExamples.length})</span>
                </h2>
                <span className="text-accent font-gothic text-sm shrink-0">
                    {isMinedSectionOpen ? 'Hide' : 'Show'}
                </span>
            </button>
            {isMinedSectionOpen && (
                <div className="mt-4">
                    {displayedMinedExamples.map((example, i) => (
                        <div key={i} className={`pb-4 ${i < displayedMinedExamples.length - 1 ? 'border-b border-divider mb-4' : ''}`}>
                            <div className="text-xl leading-relaxed text-primary mb-1">
                                <InteractiveSentence
                                    sentence={grammarExampleToSentence(example, i)}
                                    onVocabClick={(vid) => void navigate(`/vocab/${vid}`)}
                                    showFurigana={true}
                                    highlightRanges={patternHighlightRanges(example)}
                                />
                            </div>
                            <div className="text-sm text-tertiary font-gothic mb-1">
                                {example.romaji}
                            </div>
                            <div className="text-sm text-secondary font-serif">
                                {example.en}
                            </div>
                        </div>
                    ))}
                    {!isMinedExpanded && minedExamples.length > MINED_INITIAL_COUNT && (
                        <button
                            type="button"
                            onClick={() => setIsMinedExpanded(true)}
                            className="text-accent font-gothic text-sm hover:underline"
                        >
                            Show all {minedExamples.length}
                        </button>
                    )}
                </div>
            )}
        </Card>
    ) : null;

    const variantsCard = <GrammarVariantsCard point={point} />;
    // Placed directly above the related-points list it explains (issue #58's
    // "unify the overlapping concepts" note): GrammarDifferentiator answers
    // "what actually separates these", GrammarRelatedPointsCard is the
    // navigable list of who "these" are. They stay separate components -
    // one renders axis-driven prose, the other a linkable RelatedEntriesCard
    // list - but showing them together here (previously this card only ever
    // appeared once, on the point's own intro card) closes the gap the issue
    // flagged: a learner revisiting the point later had no way to see why its
    // siblings differ at all.
    const differentiatorCard = point.family && point.family.relatedPoints.length > 0 ? (
        <Card size={isMobile ? "sm" : "md"}>
            <GrammarDifferentiator point={point} knownIds={knownIds} />
        </Card>
    ) : null;
    const relatedPointsCard = <GrammarRelatedPointsCard point={point} />;

    const statsCard = progress && progress.introductionAt ? (
        <Card size={isMobile ? "sm" : "md"}>
            <h2 className="text-lg font-gothic font-semibold text-primary mb-4">Stats</h2>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-1">
                        Reviews
                    </div>
                    <div className="text-xl text-primary font-gothic">
                        {progress.totalReviews}
                    </div>
                </div>
                <div>
                    <div className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-1">
                        Interval
                    </div>
                    <div className="text-xl text-primary font-gothic">
                        {progress.entry.interval.toFixed(1)}d
                    </div>
                </div>
                <div>
                    <div className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-1">
                        Introduced
                    </div>
                    <div className="text-base text-primary font-gothic">
                        {new Date(progress.introductionAt).toLocaleDateString()}
                    </div>
                </div>
                <div>
                    <div className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-1">
                        Next Review
                    </div>
                    <div className="text-base text-primary font-gothic">
                        {progress.entry.dueDate ? new Date(progress.entry.dueDate).toLocaleDateString() : 'Ready'}
                    </div>
                </div>
                <div className="col-span-2">
                    <SRSHistoryGraph
                        series={[{ key: 'grammar', label: 'Grammar', entry: progress.entry, color: THEME.mastery.loop1 }]}
                        introDate={progress.introductionAt ? new Date(progress.introductionAt) : null}
                    />
                </div>
            </div>
        </Card>
    ) : null;

    return (
        <div className="min-h-screen flex flex-col md:max-w-5xl md:mx-auto w-full animate-fade-in">
            <PageHeader
                title="Grammar Point Details"
                onBack={() => void navigate(-1)}
                className="p-4 md:p-8"
                right={
                    <Link
                        to="/grammar/browse"
                        className="text-accent font-gothic text-sm hover:underline whitespace-nowrap"
                    >
                        <span className="hidden sm:inline">Browse dataset</span>
                        <span className="sm:hidden">Browse</span>
                    </Link>
                }
            />

            {/* Content */}
            <main className="flex-1 p-4 md:p-8 pt-0">
                {isMobile ? (
                    <div className="flex flex-col space-y-6">
                        {headerCard}
                        {formationCard}
                        {explanationCard}
                        {examplesCard}
                        {moreExamplesCard}
                        {statsCard}
                        {variantsCard}
                        {differentiatorCard}
                        {relatedPointsCard}
                    </div>
                ) : (
                    /*
                     * Two columns, mirroring VocabDetailScreen. The single column
                     * left every card as wide as the page, so short ones
                     * (Formation, the identity block) were mostly empty space.
                     * The narrow column takes the short, glanceable cards; the
                     * wide one takes the prose and the examples, which are the
                     * only things that actually need the width.
                     */
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                        <div className="md:col-span-5 space-y-6">
                            {headerCard}
                            {formationCard}
                            {statsCard}
                            {variantsCard}
                            {differentiatorCard}
                            {relatedPointsCard}
                        </div>
                        <div className="md:col-span-7 space-y-6">
                            {explanationCard}
                            {examplesCard}
                            {moreExamplesCard}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
