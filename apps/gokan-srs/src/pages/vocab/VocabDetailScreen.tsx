import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { frequencyBand, wordFrequencyRank, headwordOf, summaryGloss, textbookLessonsLabel } from "@gokan/dataset-schema";
import type { Sentence, Vocabulary } from "@gokan/dataset-schema";
import { useQuiz } from "../../context/useQuiz";
import { VocabularyService } from "../../services/vocabulary.service";
import { LoadingScreen } from "../../components/LoadingScreen";
import { JlptChip } from "../../components/JlptChip";
import { HowCommon } from "../../components/FrequencyMeter";
import { vocabNextReviewAt } from "../../services/scheduling";
import { WordReading } from "../../components/WordReading";
import { Page } from "../../components/Page";
import { DetailErrorScreen } from "../../components/detail/DetailErrorScreen";
import { DetailTabsBody } from "../../components/detail/DetailTabsBody";
import { DetailHeader } from "../../components/detail/DetailHeader";
import { DetailField } from "../../components/detail/DetailSection";
import { useDetailTabs } from "../../components/detail/useDetailTabs";
import { HeadwordKanji } from "../../components/lookup/HeadwordKanji";
import { LearnStatus } from "../../components/detail/LearnStatus";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useNow } from "../../hooks/useNow";
import { statusReviewPhrase, vocabLearningStatus } from "../../utils/learningStatus.utils";
import { mixupsAsked } from "../../utils/mixups.utils";
import { synonymCount } from "../../utils/synonymSections.utils";
import { WORD_TAB_SET, type WordTab } from "../../utils/wordTabs.utils";
import { patternText, type PatternFilter } from "../../utils/wordPatterns.utils";
import { relatedCount } from "./explore/counts";
import { RelatedPanel } from "./explore/RelatedPanel";
import { SentencesPanel } from "./explore/SentencesPanel";
import { SynonymsPanel } from "./explore/SynonymsPanel";
import { DictTab } from "./DictTab";
import { KanjiTab } from "./KanjiTab";
import { StudyTab } from "./StudyTab";
import { useWordSynonyms } from "./useWordSynonyms";

const TAB_LABEL: Record<WordTab, string> = {
    dict: 'Dict',
    sentence: 'Sentences',
    synonym: 'Synonyms',
    kanji: 'Kanji',
    related: 'Related',
    study: 'Study',
};

/**
 * The full page's columns, each in order: the subject's content in the main one, the learner's
 * data and the word's parts and relatives in the side one.
 */
const FULL_MAIN: readonly WordTab[] = ['dict', 'sentence', 'synonym'];
const FULL_SIDE: readonly WordTab[] = ['study', 'kanji', 'related'];

/**
 * A long panel's first page as a full page's section, lower than in its tab so 取る (1,030
 * sentences, 439 synonyms) stays a page a learner can take in (DESIGN_SYSTEM section 5, Word
 * page). Sentences keep their tab's 5.
 */
const FULL_SYNONYM_GROUPS = 2;
const FULL_RELATED_ROWS = 5;

/**
 * A word's page: a header holding what a learner looks the word up for (the word, its reading,
 * one line of meaning, how common it is, its status), then below `lg` one narrow column under a
 * row of tabs (Dict, Sentences, Synonyms, Kanji, Related, Study, each only when it has content),
 * one open at a time, and from `lg` the same panels as one full page on the 8/4 grid (DESIGN_SYSTEM
 * section 5, Word page).
 */
export default function VocabDetailScreen() {
    const { vocabId } = useParams<{ vocabId: string }>();
    const { state, actions } = useQuiz();
    const now = useNow();
    const load = useAsyncData(vocabId ?? null, () => VocabularyService.loadVocab(vocabId ?? ''));
    const vocab: Vocabulary | null = load.data ?? null;
    const sentencesLoad = useAsyncData(vocabId ?? null, () => VocabularyService.loadSentences(vocabId ?? ''));
    const sentencesSettled = sentencesLoad.status === 'ready' || sentencesLoad.status === 'error';

    if (load.status === 'error') return <DetailErrorScreen message="Could not load this word." />;
    if (!vocab) return <LoadingScreen />;

    return (
        // Keyed by the word: another word opens on its own tab choice (initialWordTab), not this one's.
        <WordPage
            key={vocab.id}
            vocab={vocab}
            sentences={sentencesLoad.data ?? []}
            sentencesSettled={sentencesSettled}
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
    now: number;
    onLearn: () => void;
    knownKanji: ReadonlySet<string> | undefined;
}

function WordPage({ vocab, sentences, sentencesSettled, now, onLearn, knownKanji }: WordPageProps) {
    const { state } = useQuiz();
    const progress = state.progress?.learningQueue.find(p => p.vocabId === vocab.id);
    const settings = state.settings ?? undefined;
    const wordSynonyms = useWordSynonyms(vocab);
    const records = state.progress?.mixups;
    const mixups = useMemo(() => mixupsAsked(records, vocab.id), [records, vocab.id]);
    // The common pattern Sentences is filtered on, chosen in Dict; the page is keyed by the word, so it starts clear.
    const [patternFilter, setPatternFilter] = useState<PatternFilter>(null);
    const studied = progress?.introductionAt ? { ...progress, introductionAt: progress.introductionAt } : null;

    const has: Record<WordTab, boolean> = {
        dict: true,
        sentence: sentences.length > 0,
        synonym: synonymCount(wordSynonyms.sections) > 0,
        kanji: vocab.writtenForm.containedKanji.length > 0,
        related: relatedCount(vocab) > 0,
        study: studied !== null,
    };
    // A hash lands once the sentences, which come before the synonyms, have settled.
    const tabs = useDetailTabs({ set: WORD_TAB_SET, prefix: 'word', has, sections: [...FULL_MAIN, ...FULL_SIDE], settled: sentencesSettled });
    const full = tabs.full;

    const status = vocabLearningStatus(progress, settings);

    const header = (
        <DetailHeader
            parentPath="/vocab"
            layout={full ? 'grid' : 'column'}
            title={<span className="jp-display"><HeadwordKanji headword={headwordOf(vocab)} kanji={vocab.writtenForm.containedKanji} /></span>}
            chips={<HeaderChips vocab={vocab} />}
            facts={headerFacts(vocab)}
            actions={<div data-word-status>{progress ? (
                <LearnStatus
                    inStudy
                    status={status}
                    nextReview={statusReviewPhrase(status, vocabNextReviewAt(progress, settings), now)}
                />
            ) : (
                <LearnStatus inStudy={false} learnLabel="Learn this word" onLearn={onLearn} />
            )}</div>}
        >
            {/* A word shown in kana names its kanji spellings in a note instead. */}
            {!vocab.usuallyKana && vocab.writtenForm.alternatives && vocab.writtenForm.alternatives.length > 0 && (
                <p className="font-mincho text-2xl text-secondary">{vocab.writtenForm.alternatives.join('・')}</p>
            )}
            <WordReading vocab={vocab} variant="page" />
            {vocab.reading.alternatives.length > 0 && (
                <p className="type-meta">Also: <span className="font-gothic">{vocab.reading.alternatives.join('、')}</span></p>
            )}
            <p data-summary-gloss className="type-body pt-2">{summaryGloss(vocab.senses)}</p>
        </DetailHeader>
    );

    return (
        <Page width={full ? 'wide' : 'narrow'} data={{ 'data-sentences': sentencesSettled ? 'settled' : 'loading' }}>
            {header}
            <DetailTabsBody
                tabs={tabs}
                label="About this word"
                labels={TAB_LABEL}
                main={FULL_MAIN}
                side={FULL_SIDE}
                ownHeadings={['dict', 'study']}
                render={(tab, preview) => (
                    <TabPanel
                        tab={tab}
                        vocab={vocab}
                        sentences={sentences}
                        wordSynonyms={wordSynonyms}
                        mixups={mixups}
                        studied={studied}
                        now={now}
                        knownKanji={knownKanji}
                        onChoose={tabs.choose}
                        patternFilter={patternFilter}
                        onPatternFilter={pattern => {
                            setPatternFilter(pattern);
                            if (pattern !== null) tabs.choose('sentence');
                        }}
                        preview={preview}
                    />
                )}
            />
        </Page>
    );
}

interface TabPanelProps {
    tab: WordTab;
    vocab: Vocabulary;
    sentences: readonly Sentence[];
    wordSynonyms: ReturnType<typeof useWordSynonyms>;
    mixups: ReturnType<typeof mixupsAsked>;
    studied: Parameters<typeof StudyTab>[0]['progress'] | null;
    now: number;
    knownKanji: ReadonlySet<string> | undefined;
    onChoose: (tab: WordTab) => void;
    /** The common pattern Sentences is filtered on (Dict sets it, Sentences clears it). */
    patternFilter: PatternFilter;
    onPatternFilter: (pattern: PatternFilter) => void;
    /** A section of the full page: its first page is a preview (FULL_SYNONYM_GROUPS, FULL_RELATED_ROWS). */
    preview?: boolean;
}

function TabPanel({ tab, vocab, sentences, wordSynonyms, mixups, studied, now, knownKanji, onChoose, patternFilter, onPatternFilter, preview = false }: TabPanelProps) {
    switch (tab) {
        case 'dict':
            return (
                <DictTab
                    vocab={vocab}
                    sentences={sentences}
                    synonymSections={wordSynonyms.sections}
                    // "All N sentences" promises every sentence: it lifts a pattern's filter (the tab row keeps it, under its line).
                    onShowSentences={() => {
                        onPatternFilter(null);
                        onChoose('sentence');
                    }}
                    onCompareSynonyms={() => onChoose('synonym')}
                    onShowPattern={onPatternFilter}
                />
            );
        case 'sentence':
            return (
                <SentencesPanel
                    // A new filter starts a fresh search and sort: on the full page the panel stays
                    // mounted, and a leftover query could hide the field yet still filter.
                    key={patternFilter ?? 'all'}
                    vocabId={vocab.id}
                    sentences={sentences}
                    patternIndex={patternFilter}
                    patternText={patternText(vocab, patternFilter)}
                    onClearPattern={() => onPatternFilter(null)}
                />
            );
        case 'synonym': return <SynonymsPanel vocab={vocab} sections={wordSynonyms.sections} mixedUp={wordSynonyms.mixedUp} {...(preview ? { groupsAtOnce: FULL_SYNONYM_GROUPS } : {})} />;
        case 'kanji': return <KanjiTab glyphs={vocab.writtenForm.containedKanji} knownKanji={knownKanji} />;
        case 'related': return <RelatedPanel vocab={vocab} {...(preview ? { pageSize: FULL_RELATED_ROWS } : {})} />;
        case 'study': return studied ? <StudyTab vocabId={vocab.id} progress={studied} now={now} mixups={mixups} /> : null;
    }
}

/** The JLPT chip, then how common the word is on one line: the four bars and the band, the round reference and exact rank in its title. */
function HeaderChips({ vocab }: { vocab: Vocabulary }) {
    const rank = wordFrequencyRank(vocab);
    return (
        <>
            {vocab.jlptLevel && <JlptChip level={vocab.jlptLevel} />}
            <HowCommon band={frequencyBand(rank)} rank={rank} />
        </>
    );
}

/**
 * The header's facts row, under the chips: the word's KKLC step and its textbook lessons. A word
 * learned in kana has no KKLC step (the kanji orders never teach it); with no textbook either it
 * has no row.
 */
function headerFacts(vocab: Vocabulary): ReactNode {
    const kklc = !vocab.usuallyKana;
    const textbooks = vocab.textbooks && vocab.textbooks.length > 0 ? vocab.textbooks : null;
    if (!kklc && !textbooks) return undefined;
    return (
        <>
            {kklc && <DetailField compact label="KKLC step">{vocab.progression.kklcStep}</DetailField>}
            {textbooks && <DetailField compact label="Textbooks">{textbookLessonsLabel(textbooks)}</DetailField>}
        </>
    );
}
