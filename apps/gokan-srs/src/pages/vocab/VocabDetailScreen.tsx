import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Vocabulary } from "../../models/vocabulary.model";
import { Card } from "../../components/ui/Card";
import { MasteryRing } from "../../components/MasteryRing";
import { TagsLookup, type Tags } from "../../models/data.model";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { useQuiz } from "../../context/useQuiz";
import { VocabularyService } from "../../services/vocabulary.service";
import { Button } from "../../components/ui/Button";
import { LoadingScreen } from "../../components/LoadingScreen";
import { Combine , ArrowLeft} from "lucide-react";
import { VocabSentencesCard } from "./VocabSentencesCard";
import { SRSHistoryGraph } from "../../components/SRSHistoryGraph";
import { ReviewTimeline } from "../../components/ReviewTimeline";
import { VocabRelationshipsCard } from "./VocabRelationshipsCard";
import { JlptChip } from "../../components/JlptChip";
import { THEME } from "../../commons/theme";

export default function VocabDetailScreen() {
    const { vocabId } = useParams<{ vocabId: string }>();
    const navigate = useNavigate();
    const { isMobile } = useResponsive();
    const { state, actions } = useQuiz();
    const [vocab, setVocab] = useState<Vocabulary | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!vocabId) return;

        VocabularyService.loadVocab(vocabId)
            .then(setVocab)
            .catch(err => {
                console.error("Failed to load vocab", err);
                setError("Could not load vocabulary details.");
            });
    }, [vocabId]);

    const progress = state.progress?.learningQueue.find(p => p.vocabId === vocabId);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 text-center">
                <div>
                    <h2 className="text-xl font-bold text-error mb-2">Error</h2>
                    <p className="text-secondary mb-4">{error}</p>
                    <Button onClick={() => navigate(-1)}>Go Back</Button>
                </div>
            </div>
        );
    }

    if (!vocab) {
        return <LoadingScreen />;
    }

    const kanjiCard = (
        <Card size={isMobile ? "sm" : "md"}>
            <div className={`flex ${isMobile ? 'flex-col gap-4' : 'flex-col items-center text-center gap-6'}`}>
                <div className="flex-1 flex flex-col items-center">
                    <div
                        className="relative inline-flex items-start text-7xl md:text-8xl font-mincho text-primary mb-2"
                        title={vocab.mergedVocabs && vocab.mergedVocabs.length > 1 ? "Merged Entry (combines multiple JMDict words)" : undefined}
                    >
                        <span>{vocab.writtenForm.kanji}</span>
                        {vocab.mergedVocabs && vocab.mergedVocabs.length > 1 && (
                            <span className="absolute -right-10 top-0">
                                <Combine size={24} className="text-divider opacity-40" />
                            </span>
                        )}
                    </div>
                    {vocab.writtenForm.alternatives && vocab.writtenForm.alternatives.length > 0 && (
                        <div className="text-2xl md:text-3xl font-mincho text-tertiary mb-4 text-center">
                            {vocab.writtenForm.alternatives.join(' ・ ')}
                        </div>
                    )}
                    <div className="space-y-2">
                        <div className="text-3xl font-gothic text-secondary/90 opacity-90">
                            {vocab.reading.primary}
                        </div>
                        {vocab.reading.alternatives.length > 0 && (
                            <div className="text-sm text-tertiary font-gothic">
                                Also: {vocab.reading.alternatives.join(', ')}
                            </div>
                        )}
                        {vocab.jlptLevel && (
                            <div className="flex justify-center">
                                <JlptChip level={vocab.jlptLevel} />
                            </div>
                        )}
                    </div>
                </div>
                {progress && (
                    <div className="flex justify-center gap-8 border-t border-divider pt-6 w-full">
                        <div className="flex flex-col items-center gap-2">
                            <MasteryRing memoryStrength={progress.reading.memoryStrength} size={60} variant="reading" />
                            <span className="text-xs text-tertiary uppercase tracking-wider font-gothic font-semibold">
                                Reading
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <MasteryRing memoryStrength={progress.meaning.memoryStrength} size={60} variant="meaning" />
                            <span className="text-xs text-tertiary uppercase tracking-wider font-gothic font-semibold">
                                Meaning
                            </span>
                        </div>
                        {/* Only once the production entry has actually been activated for
                            this word (see SRSService.seedProductionEntry). An empty third
                            ring on every word that has not reached it yet would read as
                            lost progress rather than a direction not started. */}
                        {progress.production?.dueDate && (
                            <div className="flex flex-col items-center gap-2">
                                <MasteryRing memoryStrength={progress.production.memoryStrength} size={60} variant="meaning" />
                                <span className="text-xs text-tertiary uppercase tracking-wider font-gothic font-semibold">
                                    Production
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );

    const metadataCard = (
        <Card size={isMobile ? "sm" : "md"}>
            <h2 className="text-lg font-gothic font-semibold text-primary mb-4">Information</h2>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-1">
                        Frequency
                    </div>
                    <div className="text-base text-primary font-gothic">
                        #{vocab.frequency.kanjiRank.toLocaleString()}
                    </div>
                </div>
                <div>
                    <div className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-1">
                        KKLC Step
                    </div>
                    <div className="text-base text-primary font-gothic">
                        Step {vocab.progression.kklcStep}
                    </div>
                </div>
                {vocab.usageHints?.examplePattern && (
                    <div className="col-span-2 pt-2 border-t border-divider">
                        <div className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-1">
                            Usage Pattern
                        </div>
                        <div className="text-base text-primary font-mincho">
                            {vocab.usageHints.examplePattern}
                        </div>
                    </div>
                )}
                {!progress && (
                    <div className="col-span-2 pt-4 border-t border-divider mt-2">
                        <Button
                            className="w-full"
                            onClick={() => {
                                actions.saveVocabIntroChoice(vocab, 'learn');
                            }}
                        >
                            Add to Learning List
                        </Button>
                    </div>
                )}
            </div>
        </Card>
    );

    const kanjiBreakdownCard = vocab.writtenForm.containedKanji.length > 0 ? (
        <Card size={isMobile ? "sm" : "md"}>
            <h2 className="text-lg font-gothic font-semibold text-primary mb-4">Kanji</h2>
            <div className="flex flex-wrap gap-2">
                {vocab.writtenForm.containedKanji.map(char => (
                    <span
                        key={char}
                        onClick={() => navigate(`/kanji/${char}`)}
                        className="px-3 py-1.5 text-lg rounded bg-accent/10 text-accent font-mincho font-medium dark:bg-accent/15 cursor-pointer hover:bg-accent/20 transition-colors"
                    >
                        {char}
                    </span>
                ))}
            </div>
        </Card>
    ) : null;

    const mergedCard = vocab.mergedVocabs && vocab.mergedVocabs.length > 1 ? (
        <Card size={isMobile ? "sm" : "md"}>
            <h2 className="text-lg font-gothic font-semibold text-primary mb-4 flex items-center gap-2">
                <Combine size={18} />
                Original Entries
            </h2>
            <p className="text-sm text-secondary mb-4 font-serif">
                This is a merged entry combining multiple JMDict words that share the exact same kanji.
            </p>
            <div className="space-y-4">
                {vocab.mergedVocabs.map((mv, idx) => (
                    <div key={idx} className="border-l-2 border-divider pl-3">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-gothic font-bold text-primary">{mv.originalPrimaryReading}</span>
                            <span className="text-xs text-tertiary font-mono">ID: {mv.id}</span>
                            {mv.isBase && <span className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.5 rounded font-gothic">BASE</span>}
                        </div>
                        <div className="text-sm text-meaning-muted font-serif">
                            {mv.originalGlosses.join(', ')}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    ) : null;

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
                        {progress.reading.interval.toFixed(1)}d
                    </div>
                </div>
                <div className="col-span-2 pt-2 border-t border-divider grid grid-cols-2 gap-4">
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
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-secondary font-gothic w-16">Reading:</span>
                                <span className="text-base text-primary font-gothic">{progress.reading.dueDate ? new Date(progress.reading.dueDate).toLocaleDateString() : 'Ready'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-secondary font-gothic w-16">Meaning:</span>
                                <span className="text-base text-primary font-gothic">{progress.meaning.dueDate ? new Date(progress.meaning.dueDate).toLocaleDateString() : 'Ready'}</span>
                            </div>
                            {/* "Not started" rather than a hidden row or a bare "Ready":
                                production activates lazily, so a word that has not reached
                                it yet needs to say so, or its absence reads as the feature
                                being broken. */}
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-secondary font-gothic w-16">Production:</span>
                                <span className="text-base text-primary font-gothic">
                                    {progress.production?.dueDate
                                        ? new Date(progress.production.dueDate).toLocaleDateString()
                                        : 'Not started'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-span-2">
                    <SRSHistoryGraph
                        series={[
                            { key: 'reading', label: 'Reading', entry: progress.reading, color: THEME.mastery.reading.loop1 },
                            { key: 'meaning', label: 'Meaning', entry: progress.meaning, color: THEME.mastery.meaning.loop1 },
                            // Only once activated: an un-started entry would draw a flat
                            // zero line that reads as lost progress.
                            ...(progress.production?.dueDate
                                ? [{ key: 'production', label: 'Production', entry: progress.production, color: THEME.mastery.production.loop1 }]
                                : []),
                        ]}
                        introDate={progress.introductionAt ? new Date(progress.introductionAt) : null}
                    />
                </div>
            </div>
        </Card>
    ) : null;

    const timelineCard = progress && progress.introductionAt ? (
        <ReviewTimeline readingEntry={progress.reading} meaningEntry={progress.meaning} />
    ) : null;

    const relationshipsCard = <VocabRelationshipsCard vocab={vocab} />;

    const meaningsCard = (
        <Card size={isMobile ? "sm" : "md"}>
            <h2 className="text-lg font-gothic font-semibold text-primary mb-4">Meanings</h2>
            <div className="space-y-6">
                {vocab.senses.map((sense, index) => (
                    <div key={index} className="pb-6 last:pb-0 border-b last:border-b-0 border-divider">
                        {/* POS Tags */}
                        <div className="flex flex-wrap gap-2 mb-3">
                            {Array.from(new Set([...sense.pos, ...sense.misc.rawTags])).map(tag => (
                                <span
                                    key={tag}
                                    className="px-2 py-1 text-xs rounded bg-accent/10 text-accent font-gothic font-medium dark:bg-accent/15"
                                >
                                    {TagsLookup[tag as Tags]}
                                </span>
                            ))}
                        </div>
                        {/* Glosses */}
                        <p className="text-lg text-meaning-muted font-serif leading-relaxed">
                            {sense.appliesToReadings && sense.appliesToReadings.length > 0 && (
                                <span className="text-sm text-tertiary mr-2 font-gothic">[{sense.appliesToReadings.join(', ')}]</span>
                            )}
                            {sense.glosses.join(', ')}
                        </p>

                        {/* Related Compounds (Specific to Sense) */}
                        {sense.related?.compounds && sense.related.compounds.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-divider/50">
                                <div className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-2">
                                    Related
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {compoundList(sense.related.compounds)}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );

    const sentencesCard = <VocabSentencesCard vocabId={vocab.id} />;

    return (
        <div className="min-h-screen flex flex-col md:max-w-5xl md:mx-auto w-full animate-fade-in">
            {/* Header */}
            <div className="w-full flex items-center p-4 md:p-8 relative">
                <Button variant="ghost" onClick={() => navigate(-1)} className="absolute left-4 md:left-8">
                    <ArrowLeft className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Back
                </Button>
                <h1 className="flex-1 text-center text-xl font-serif text-primary">
                    Vocabulary Details
                </h1>
            </div>

            {/* Content */}
            <main className="flex-1 p-4 md:p-8 pt-0">
                {isMobile ? (
                    <div className="flex flex-col space-y-6">
                        {kanjiCard}
                        {kanjiBreakdownCard}
                        {meaningsCard}
                        {metadataCard}
                        {sentencesCard}
                        {mergedCard}
                        {statsCard}
                        {timelineCard}
                        {relationshipsCard}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                        {/* Left Column */}
                        <div className="md:col-span-5 space-y-6">
                            {kanjiCard}
                            {kanjiBreakdownCard}
                            {metadataCard}
                            {mergedCard}
                            {statsCard}
                            {timelineCard}
                            {relationshipsCard}
                        </div>

                        {/* Right Column */}
                        <div className="md:col-span-7 space-y-6">
                            {meaningsCard}
                            {sentencesCard}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

function compoundList(compounds: string[]) {
    return compounds.map((compound, i) => (
        <span key={i} className="text-lg font-mincho text-primary/80">
            {compound}
            {i < compounds.length - 1 && <span className="text-divider mx-2">|</span>}
        </span>
    ));
}
