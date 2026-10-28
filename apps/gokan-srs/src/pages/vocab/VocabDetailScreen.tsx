import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { frequencyBand, headwordOf, textbookLessonsLabel } from "@gokan/dataset-schema";
import type { Sentence, Vocabulary } from "@gokan/dataset-schema";
import { KanjiTile } from "../../components/KanjiTile";
import { DetailBody } from "../../components/detail/DetailBody";
import { useQuiz } from "../../context/useQuiz";
import { VocabularyService } from "../../services/vocabulary.service";
import { LoadingScreen } from "../../components/LoadingScreen";
import { JlptChip } from "../../components/JlptChip";
import { FrequencyMeter } from "../../components/FrequencyMeter";
import { vocabNextReviewAt } from "../../services/scheduling";
import { KanjiSpellingNote } from "../../components/KanjiSpellingNote";
import { Page } from "../../components/Page";
import { DetailErrorScreen } from "../../components/detail/DetailErrorScreen";
import { DetailField, DetailSection } from "../../components/detail/DetailSection";
import { DetailHeader } from "../../components/detail/DetailHeader";
import { LearnStatus } from "../../components/detail/LearnStatus";
import { Disclosure } from "../../components/ui/Disclosure";
import { TextButton } from "../../components/ui/TextButton";
import { WordTile } from "../../components/WordTile";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useNow } from "../../hooks/useNow";
import { CLOSENESS_LABEL, closenessOf } from "../../services/exercise/wordRelation";
import { statusReviewPhrase, vocabLearningStatus } from "../../utils/learningStatus.utils";
import { mixupsAsked } from "../../utils/mixups.utils";
import { EXPLORE_ANCHOR, SYNONYMS_HASH } from "../../utils/navigation.utils";
import { indexLearnerVocab } from "../../utils/sentenceRanking";
import { organizeSenses, senseNumbers, type ShownSense } from "../../utils/senses.utils";
import { closestSynonyms, sectionGlossLine, synonymCount, type SynonymSection } from "../../utils/synonymSections.utils";
import { pickWordExamples } from "../../utils/wordExamples.utils";
import { Explore, type ExplorePanel } from "./explore/Explore";
import { useWordSynonyms } from "./useWordSynonyms";
import { WordSentence } from "./WordSentence";
import { YourStudy } from "./YourStudy";

const INITIAL_SENSES = 3;

/**
 * A word's page, one narrow column in three levels: the essentials (meanings, two examples,
 * the closest synonyms), the learner's study, and Explore, where the long lists open on request,
 * then the dataset's internals. A line between two levels, nothing else (DESIGN_SYSTEM section 4).
 */
export default function VocabDetailScreen() {
    const { vocabId } = useParams<{ vocabId: string }>();
    const { state, actions } = useQuiz();
    const now = useNow();
    const load = useAsyncData(vocabId ?? null, () => VocabularyService.loadVocab(vocabId ?? ''));
    const vocab: Vocabulary | null = load.data ?? null;
    const sentencesLoad = useAsyncData(vocabId ?? null, () => VocabularyService.loadSentences(vocabId ?? ''));
    const { hash } = useLocation();

    // The open panel belongs to one word: keyed by it, so another word opens with none, or with
    // Synonyms when linked there (`#synonyms`, a quiz's "Compare synonyms").
    const [chosen, setChosen] = useState<{ for: string; panel: ExplorePanel | null } | null>(null);
    const linkedToSynonyms = hash === SYNONYMS_HASH;
    const openPanel: ExplorePanel | null = chosen && chosen.for === vocabId ? chosen.panel : linkedToSynonyms ? 'synonym' : null;

    // The router does not scroll to a hash. The examples above Explore arrive after the word, so
    // scrolling when it first renders leaves it pushed down the screen: scroll once they have
    // settled (the rest of the page above it is drawn with the word).
    const sentencesSettled = sentencesLoad.status === 'ready' || sentencesLoad.status === 'error';
    const landOnSynonyms = linkedToSynonyms && vocab !== null && sentencesSettled;
    useEffect(() => {
        if (landOnSynonyms) document.getElementById(EXPLORE_ANCHOR)?.scrollIntoView({ block: 'start' });
    }, [landOnSynonyms, vocabId]);

    if (load.status === 'error') return <DetailErrorScreen message="Could not load this word." />;
    if (!vocab) return <LoadingScreen />;

    const togglePanel = (panel: ExplorePanel) => setChosen({ for: vocab.id, panel: openPanel === panel ? null : panel });
    // Opens a panel from an action above it ("All 1,030 sentences →") and brings Explore to the
    // top: its heading does not move when a panel opens under it, so no wait for the render.
    const showPanel = (panel: ExplorePanel) => {
        setChosen({ for: vocab.id, panel });
        document.getElementById(EXPLORE_ANCHOR)?.scrollIntoView({ block: 'start' });
    };

    return (
        <WordPage
            key={vocab.id}
            vocab={vocab}
            sentences={sentencesLoad.data ?? []}
            sentencesSettled={sentencesSettled}
            openPanel={openPanel}
            onTogglePanel={togglePanel}
            onShowPanel={showPanel}
            now={now}
            onLearn={() => actions.saveVocabIntroChoice(vocab, 'learn')}
            knownKanji={state.progress?.kanjiKnowledge.kanjiSet}
        />
    );
}

interface WordPageProps {
    vocab: Vocabulary;
    sentences: Sentence[];
    /** The sentences have loaded or failed: the page is drawn in full (`data-sentences`, which check-layout waits on). */
    sentencesSettled: boolean;
    openPanel: ExplorePanel | null;
    onTogglePanel: (panel: ExplorePanel) => void;
    onShowPanel: (panel: ExplorePanel) => void;
    now: number;
    onLearn: () => void;
    knownKanji: ReadonlySet<string> | undefined;
}

function WordPage({ vocab, sentences, sentencesSettled, openPanel, onTogglePanel, onShowPanel, now, onLearn, knownKanji }: WordPageProps) {
    const { state } = useQuiz();
    const progress = state.progress?.learningQueue.find(p => p.vocabId === vocab.id);
    const settings = state.settings ?? undefined;
    const wordSynonyms = useWordSynonyms(vocab);
    const records = state.progress?.mixups;
    const mixups = useMemo(() => mixupsAsked(records, vocab.id), [records, vocab.id]);

    const status = vocabLearningStatus(progress, settings);
    const header = (
        <DetailHeader
            parentPath="/vocab"
            layout="column"
            title={<span className="jp-display">{headwordOf(vocab)}</span>}
            chips={<HeaderChips vocab={vocab} knownKanji={knownKanji} />}
            facts={<WordFacts vocab={vocab} />}
            actions={progress ? (
                <LearnStatus
                    inStudy
                    status={status}
                    nextReview={statusReviewPhrase(status, vocabNextReviewAt(progress, settings), now)}
                />
            ) : (
                <LearnStatus inStudy={false} learnLabel="Learn this word" onLearn={onLearn} />
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

    const essentials = (
        <>
            <MeaningsSection vocab={vocab} />
            <ExamplesSection vocab={vocab} sentences={sentences} onShowAll={() => onShowPanel('sentence')} />
            <ClosestSynonyms vocab={vocab} sections={wordSynonyms.sections} onCompare={() => onShowPanel('synonym')} />
        </>
    );
    const yourStudy = progress?.introductionAt
        ? <YourStudy progress={{ ...progress, introductionAt: progress.introductionAt }} now={now} mixups={mixups.length} onShowMixups={() => onShowPanel('mixup')} />
        : null;
    const explore = (
        <Explore vocab={vocab} open={openPanel} onToggle={onTogglePanel} sentences={sentences} wordSynonyms={wordSynonyms} mixups={mixups} />
    );
    const merged = vocab.mergedVocabs && vocab.mergedVocabs.length > 1 ? vocab.mergedVocabs : null;
    const internals = merged ? (
        <Disclosure title={`Combines ${merged.length} dictionary entries`}>
            <ul className="mt-2 space-y-2">
                {merged.map(entry => (
                    <li key={entry.id}>
                        <span className="font-gothic text-primary">{entry.originalPrimaryReading}</span>
                        <span className="type-meta ml-2">JMdict {entry.id}</span>
                        <p className="type-support">{entry.originalGlosses.join(', ')}</p>
                    </li>
                ))}
            </ul>
        </Disclosure>
    ) : null;

    return (
        <Page width="narrow" data={{ 'data-sentences': sentencesSettled ? 'settled' : 'loading' }}>
            {header}
            <DetailBody levels={[
                { key: 'essentials', node: essentials },
                { key: 'your-study', node: yourStudy },
                { key: 'explore', node: explore },
                { key: 'internals', node: internals },
            ]} />
        </Page>
    );
}

/** The JLPT chip, then each of the word's kanji as a small tile, with whether the learner knows it. */
function HeaderChips({ vocab, knownKanji }: { vocab: Vocabulary; knownKanji: ReadonlySet<string> | undefined }) {
    return (
        <>
            {vocab.jlptLevel && <JlptChip level={vocab.jlptLevel} />}
            {vocab.writtenForm.containedKanji.map(char => (
                <span key={char} className="mx-1">
                    <KanjiTile glyph={char} to={`/kanji/${char}`} size="sm" caption={knownKanji?.has(char) ? 'Known' : 'Not known'} />
                </span>
            ))}
        </>
    );
}

/** What "Dictionary details" used to hold, as a row of facts: how common, KKLC step, textbooks. */
function WordFacts({ vocab }: { vocab: Vocabulary }) {
    // A word learned in kana is met at its kana spelling's rank, and is not part of the kanji order.
    const rank = vocab.usuallyKana ? vocab.frequency.kanaRank ?? vocab.frequency.kanjiRank : vocab.frequency.kanjiRank;
    const band = frequencyBand(rank);
    return (
        <>
            <DetailField compact label="How common">
                <span className="inline-flex items-center gap-2" title={band.ranked ? `Rank ${rank.toLocaleString('en-US')}` : undefined}>
                    <FrequencyMeter band={band} />
                    {band.name}
                </span>
                <span className="block type-meta">{band.reference}</span>
            </DetailField>
            <DetailField compact label="KKLC step">{vocab.usuallyKana ? 'Learned in kana' : vocab.progression.kklcStep}</DetailField>
            {vocab.textbooks && vocab.textbooks.length > 0 && <DetailField compact label="Textbooks">{textbookLessonsLabel(vocab.textbooks)}</DetailField>}
        </>
    );
}

function MeaningsSection({ vocab }: { vocab: Vocabulary }) {
    const [expanded, setExpanded] = useState(false);
    const { common, rare } = organizeSenses(vocab.senses);
    // A word whose every sense is rare (婦人) leads with them: there is nothing else to show.
    const lead = common.length > 0 ? common : rare;
    const rest = common.length > 0 ? rare : [];
    const total = common.length + rare.length;

    return (
        <DetailSection title="Meanings">
            <SenseList senses={expanded ? lead : lead.slice(0, INITIAL_SENSES)} start={1} />
            {expanded && rest.length > 0 && (
                <div className="mt-4">
                    <p className="type-label mb-2">Rare and archaic</p>
                    <SenseList senses={rest} start={lead.length + 1} />
                </div>
            )}
            {total > INITIAL_SENSES || rest.length > 0 ? (
                <TextButton onClick={() => setExpanded(!expanded)} className="mt-3">
                    {expanded ? 'Show fewer meanings' : `Show all ${total} meanings`}
                </TextButton>
            ) : null}
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

/** Two example sentences (pickWordExamples), and the way to all of them in Explore. */
function ExamplesSection({ vocab, sentences, onShowAll }: { vocab: Vocabulary; sentences: readonly Sentence[]; onShowAll: () => void }) {
    const { state } = useQuiz();
    const queue = state.progress?.learningQueue;
    const examples = useMemo(() => {
        const firstSense = organizeSenses(vocab.senses).common[0]?.sense.glosses ?? vocab.senses[0]?.glosses ?? [];
        return pickWordExamples(vocab.id, sentences, firstSense, indexLearnerVocab(queue));
    }, [vocab, sentences, queue]);
    if (examples.length === 0) return null;
    return (
        <DetailSection
            title="Examples"
            aside={sentences.length > examples.length
                ? <TextButton onClick={onShowAll} arrow>All {sentences.length.toLocaleString('en-US')} sentences</TextButton>
                : undefined}
        >
            <div className="space-y-4">
                {examples.map(sentence => <WordSentence key={sentence.id} vocabId={vocab.id} sentence={sentence} />)}
            </div>
        </DetailSection>
    );
}

/** Up to five words from the first sense's synonyms, each a boxed link, and the way to all of them. */
function ClosestSynonyms({ vocab, sections, onCompare }: { vocab: Vocabulary; sections: SynonymSection[]; onCompare: () => void }) {
    const closest = closestSynonyms(sections, (w, section) => closenessOf(w.pair, section.glosses) === 'distinct');
    if (!closest) return null;
    const number = senseNumbers(vocab.senses)[closest.section.sense];
    return (
        <DetailSection
            title="Closest synonyms"
            aside={<TextButton onClick={onCompare} arrow>Compare all {synonymCount(sections).toLocaleString('en-US')}</TextButton>}
        >
            <ul className="flex flex-wrap gap-2">
                {closest.words.map(word => (
                    <li key={word.vocabId} className="min-w-0 max-w-full">
                        <WordTile to={`/vocab/${word.vocabId}`} vocab={word.forms} sign={CLOSENESS_LABEL[closenessOf(word.pair, closest.section.glosses)]} />
                    </li>
                ))}
            </ul>
            <p className="type-meta mt-3">For meaning {number}: {sectionGlossLine(closest.section)}</p>
        </DetailSection>
    );
}
