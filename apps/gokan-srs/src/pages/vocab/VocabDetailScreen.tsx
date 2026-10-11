import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { headwordOf, textbookLessonsLabel } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { MasteryRing } from "../../components/MasteryRing";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { useQuiz } from "../../context/useQuiz";
import { VocabularyService } from "../../services/vocabulary.service";
import { LoadingScreen } from "../../components/LoadingScreen";
import { VocabSentencesCard } from "./VocabSentencesCard";
import { VocabRelationshipsCard } from "./VocabRelationshipsCard";
import { JlptChip } from "../../components/JlptChip";
import { THEME } from "../../commons/theme";
import { isProductionActivated, isReadingRelevant, isVocabFullyMastered, vocabNextReviewAt } from "../../services/scheduling";
import { KanjiSpellingNote } from "../../components/KanjiSpellingNote";
import { Page } from "../../components/Page";
import { DetailErrorScreen } from "../../components/detail/DetailErrorScreen";
import { DetailField, DetailSection } from "../../components/detail/DetailSection";
import { DetailHeader } from "../../components/detail/DetailHeader";
import { LabelledRing, LearnStatus } from "../../components/detail/LearnStatus";
import { YourProgress, type ProgressDirection } from "../../components/detail/YourProgress";
import { Disclosure } from "../../components/ui/Disclosure";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useNow } from "../../hooks/useNow";
import { directionStatus, vocabLearningStatus } from "../../utils/learningStatus.utils";
import { nextReviewPhrase } from "../../utils/time.utils";
import { organizeSenses, type ShownSense } from "../../utils/senses.utils";
import type { VocabProgress } from "../../models/vocabulary.model";

const INITIAL_SENSES = 5;

export default function VocabDetailScreen() {
    const { vocabId } = useParams<{ vocabId: string }>();
    const { isMobile, isTablet } = useResponsive();
    const { state, actions } = useQuiz();
    const now = useNow();
    const load = useAsyncData(vocabId ?? null, () => VocabularyService.loadVocab(vocabId ?? ''));
    const vocab: Vocabulary | null = load.data ?? null;

    const progress = state.progress?.learningQueue.find(p => p.vocabId === vocabId);
    const settings = state.settings ?? undefined;

    if (load.status === 'error') return <DetailErrorScreen message="Could not load this word." />;
    if (!vocab) return <LoadingScreen />;

    // A word learned in kana has no reading direction: no ring, due date or curve for it.
    const readingRelevant = !progress || isReadingRelevant(progress);
    // Activation, not a pending due date: a mastered production entry has no dueDate.
    const productionActivated = isProductionActivated(progress?.production);

    const directions: ProgressDirection[] = progress ? [
        ...(readingRelevant ? [{ key: 'reading', label: 'Reading', strength: progress.reading.memoryStrength, variant: 'reading' as const, status: directionStatus(progress.reading, true, now) }] : []),
        { key: 'meaning', label: 'Meaning', strength: progress.meaning.memoryStrength, variant: 'meaning' as const, status: directionStatus(progress.meaning, true, now) },
        // "Not started" rather than a hidden row: production activates lazily, and an
        // absent row reads as the feature being broken.
        { key: 'production', label: 'Production', strength: progress.production?.memoryStrength ?? 0, variant: 'production' as const, status: directionStatus(progress.production, productionActivated, now) },
    ] : [];

    const header = (
        <DetailHeader
            parentPath="/vocab"
            title={<span className="jp-display">{headwordOf(vocab)}</span>}
            chips={vocab.jlptLevel ? <JlptChip level={vocab.jlptLevel} /> : undefined}
            actions={progress ? (
                <LearnStatus
                    inStudy
                    status={vocabLearningStatus(progress, settings)}
                    nextReview={nextReviewOf(progress, settings, now)}
                    rings={directions
                        .filter(d => d.key !== 'production' || productionActivated)
                        .map(d => (
                            <LabelledRing key={d.key} label={d.label}>
                                <MasteryRing memoryStrength={d.strength} size={44} variant={d.variant} label={d.label} />
                            </LabelledRing>
                        ))}
                />
            ) : (
                <LearnStatus inStudy={false} learnLabel="Learn this word" onLearn={() => actions.saveVocabIntroChoice(vocab, 'learn')} />
            )}
        >
            {/* A word shown in kana names its kanji spellings in a note instead. */}
            {!vocab.usuallyKana && vocab.writtenForm.alternatives && vocab.writtenForm.alternatives.length > 0 && (
                <p className="font-mincho text-2xl text-secondary">{vocab.writtenForm.alternatives.join('・')}</p>
            )}
            {vocab.usuallyKana
                ? <KanjiSpellingNote vocab={vocab} />
                : <p className="font-gothic text-2xl text-secondary">{vocab.reading.primary}</p>}
            {vocab.reading.alternatives.length > 0 && (
                <p className="type-meta">Also: <span className="font-gothic">{vocab.reading.alternatives.join('、')}</span></p>
            )}
        </DetailHeader>
    );

    const meanings = <MeaningsSection vocab={vocab} />;
    const kanji = vocab.writtenForm.containedKanji.length > 0 ? (
        <DetailSection title="Kanji">
            <div className="flex flex-wrap gap-3">
                {vocab.writtenForm.containedKanji.map(char => {
                    const known = state.progress?.kanjiKnowledge.kanjiSet.has(char) ?? false;
                    return (
                        <Link
                            key={char}
                            to={`/kanji/${char}`}
                            className="flex flex-col items-center gap-1 group focus-visible:outline-none"
                        >
                            <span className="w-12 h-12 flex items-center justify-center rounded-md border border-divider bg-surface font-mincho text-2xl text-primary group-hover:border-accent group-focus-visible:ring-2 group-focus-visible:ring-accent transition-colors">
                                {char}
                            </span>
                            <span className="type-meta">{known ? 'Known' : 'Not known'}</span>
                        </Link>
                    );
                })}
            </div>
        </DetailSection>
    ) : null;
    const sentences = <VocabSentencesCard vocabId={vocab.id} />;
    const related = <VocabRelationshipsCard vocab={vocab} />;
    const yourProgress = progress?.introductionAt ? (
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
    ) : null;
    const dictionaryDetails = <DictionaryDetails vocab={vocab} />;

    // Two columns from `lg`; below it, one column in reading order.
    const twoColumns = !isMobile && !isTablet;

    return (
        <Page width="wide">
            {header}
            {twoColumns ? (
                <div className="grid grid-cols-12 gap-10 items-start">
                    <div className="col-span-8 space-y-10 min-w-0">
                        {meanings}
                        {sentences}
                        {related}
                    </div>
                    <div className="col-span-4 space-y-10 min-w-0">
                        {kanji}
                        {yourProgress}
                        {dictionaryDetails}
                    </div>
                </div>
            ) : (
                <div className="space-y-10">
                    {meanings}
                    {kanji}
                    {sentences}
                    {related}
                    {yourProgress}
                    {dictionaryDetails}
                </div>
            )}
        </Page>
    );
}

/** The earliest review among the word's activated directions, or "Mastered". */
function nextReviewOf(progress: VocabProgress, settings: Parameters<typeof vocabNextReviewAt>[1], now: number): string {
    if (isVocabFullyMastered(progress, settings)) return 'Mastered';
    const due = vocabNextReviewAt(progress, settings);
    return due ? nextReviewPhrase(due, now) : 'Not scheduled yet';
}

function MeaningsSection({ vocab }: { vocab: Vocabulary }) {
    // Expansion belongs to one word: keyed by it, so another word starts collapsed.
    const [expandedFor, setExpandedFor] = useState<string | null>(null);
    const { common, rare } = organizeSenses(vocab.senses);
    const showAll = expandedFor === vocab.id;
    const shown = showAll ? common : common.slice(0, INITIAL_SENSES);

    return (
        <DetailSection title="Meanings">
            <SenseList senses={shown} start={1} />
            {common.length > INITIAL_SENSES && (
                <button
                    type="button"
                    onClick={() => setExpandedFor(showAll ? null : vocab.id)}
                    className="mt-3 font-sans text-sm text-accent hover:underline cursor-pointer"
                >
                    {showAll ? 'Show fewer meanings' : `Show all ${common.length} meanings`}
                </button>
            )}
            {rare.length > 0 && (
                <Disclosure title={`Rare and archaic meanings (${rare.length})`} className="mt-4">
                    <SenseList senses={rare} start={common.length + 1} />
                </Disclosure>
            )}
            {vocab.usageHints?.examplePattern && (
                <p className="type-support mt-4">
                    Usage: <span className="font-mincho text-base text-primary">{vocab.usageHints.examplePattern}</span>
                </p>
            )}
        </DetailSection>
    );
}

function SenseList({ senses, start }: { senses: ShownSense[]; start: number }) {
    return (
        <ol start={start} className="space-y-3 list-decimal pl-6 marker:text-tertiary marker:font-sans marker:text-sm">
            {senses.map(({ sense, posLabel }, i) => (
                <li key={i} className="pl-1">
                    {posLabel && <div className="type-meta mb-0.5">{posLabel}</div>}
                    <p className="type-body">
                        {sense.appliesToReadings && sense.appliesToReadings.length > 0 && (
                            <span className="font-gothic text-secondary mr-1">({sense.appliesToReadings.join('、')})</span>
                        )}
                        {sense.glosses.join(', ')}
                    </p>
                    {/* Strings, not entries: plain text, nothing that looks like a link. */}
                    {sense.related.compounds.length > 0 && (
                        <p className="type-support mt-0.5">
                            See also: <span className="font-mincho text-primary">{sense.related.compounds.join('、')}</span>
                        </p>
                    )}
                </li>
            ))}
        </ol>
    );
}

function DictionaryDetails({ vocab }: { vocab: Vocabulary }) {
    const merged = vocab.mergedVocabs && vocab.mergedVocabs.length > 1 ? vocab.mergedVocabs : null;
    const fields: { label: string; value: ReactNode }[] = [
        // A word learned in kana is met at its kana spelling's rank, and is not part of the kanji order.
        { label: 'Frequency rank', value: `#${(vocab.usuallyKana ? vocab.frequency.kanaRank ?? vocab.frequency.kanjiRank : vocab.frequency.kanjiRank).toLocaleString('en-US')}` },
        { label: 'KKLC step', value: vocab.usuallyKana ? 'Learned in kana' : vocab.progression.kklcStep },
        ...(vocab.textbooks && vocab.textbooks.length > 0 ? [{ label: 'Textbook lessons', value: textbookLessonsLabel(vocab.textbooks) }] : []),
    ];

    return (
        <Disclosure title="Dictionary details">
            <dl className="space-y-3">
                {fields.map(field => <DetailField key={field.label} label={field.label}>{field.value}</DetailField>)}
            </dl>
            {merged && (
                <div className="mt-4">
                    <p className="type-label">Combines {merged.length} dictionary entries</p>
                    <ul className="mt-2 space-y-2">
                        {merged.map(entry => (
                            <li key={entry.id}>
                                <span className="font-gothic text-primary">{entry.originalPrimaryReading}</span>
                                <span className="type-meta ml-2">JMdict {entry.id}</span>
                                <p className="type-support">{entry.originalGlosses.join(', ')}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Disclosure>
    );
}
