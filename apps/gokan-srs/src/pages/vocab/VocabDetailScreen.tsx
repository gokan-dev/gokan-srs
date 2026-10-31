import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { frequencyBand, headwordOf, summaryGloss } from "@gokan/dataset-schema";
import type { Sentence, Vocabulary } from "@gokan/dataset-schema";
import { useQuiz } from "../../context/useQuiz";
import { hasSessionInProgress, wordReviewTaskKeys } from "../../context/quiz/quizSelectors";
import { VocabularyService } from "../../services/vocabulary.service";
import { LoadingScreen } from "../../components/LoadingScreen";
import { JlptChip } from "../../components/JlptChip";
import { FrequencyMeter } from "../../components/FrequencyMeter";
import { vocabNextReviewAt } from "../../services/scheduling";
import { KanjiSpellingNote } from "../../components/KanjiSpellingNote";
import { Page, PAGE_BLEED_INSET } from "../../components/Page";
import { DetailErrorScreen } from "../../components/detail/DetailErrorScreen";
import { DetailBody } from "../../components/detail/DetailBody";
import { DetailHeader } from "../../components/detail/DetailHeader";
import { LearnStatus } from "../../components/detail/LearnStatus";
import { TabNav, type PageTab } from "../../components/ui/TabNav";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useNow } from "../../hooks/useNow";
import { usePersistedControlsSnapshot, writePersistedControls } from "../../hooks/usePersistedControls";
import { statusReviewPhrase, vocabLearningStatus } from "../../utils/learningStatus.utils";
import { mixupsAsked } from "../../utils/mixups.utils";
import { wordReviewPath } from "../../utils/navigation.utils";
import { synonymCount } from "../../utils/synonymSections.utils";
import { initialWordTab, WORD_TAB_STORAGE_KEY, WORD_TABS, wordTabHash, type WordTab } from "../../utils/wordTabs.utils";
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

/** A tab's panel id, which its tab button controls, and the button's id, which labels the panel. */
const panelId = (tab: WordTab) => `word-panel-${tab}`;
const tabId = (tab: WordTab) => `word-tab-${tab}`;

/**
 * A word's page, one narrow column at every width: a header holding what a learner looks the word
 * up for (the word, its reading, one line of meaning, how common it is, its status), then one row
 * of tabs (Dict, Sentences, Synonyms, Kanji, Related, Study, each only when it has content), one
 * open at a time (DESIGN_SYSTEM section 5, Word page).
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
    const navigate = useNavigate();
    const { pathname, hash } = useLocation();
    const progress = state.progress?.learningQueue.find(p => p.vocabId === vocab.id);
    const settings = state.settings ?? undefined;
    const wordSynonyms = useWordSynonyms(vocab);
    const records = state.progress?.mixups;
    const mixups = useMemo(() => mixupsAsked(records, vocab.id), [records, vocab.id]);
    const studied = progress?.introductionAt ? { ...progress, introductionAt: progress.introductionAt } : null;

    const has: Record<WordTab, boolean> = {
        dict: true,
        sentence: sentences.length > 0,
        synonym: synonymCount(wordSynonyms.sections) > 0,
        kanji: vocab.writtenForm.containedKanji.length > 0,
        related: relatedCount(vocab) > 0,
        study: studied !== null,
    };
    const available = WORD_TABS.filter(tab => has[tab]);

    // The open tab: the one chosen on this page, else the hash's, the remembered one or Dict.
    // Derived on every render, so a tab whose content arrives late (Sentences) opens once it has.
    const remembered = usePersistedControlsSnapshot<{ tab: WordTab }>(WORD_TAB_STORAGE_KEY).tab;
    const [chosen, setChosen] = useState<WordTab | null>(null);
    const open: WordTab = chosen !== null && has[chosen] ? chosen : initialWordTab(hash, remembered, available);

    // Choosing a tab while the row is stuck brings its panel's top just under the row, so the
    // learner reads it from its start (the open tab, tapped again, too); while the row is in its
    // place, nothing moves. Another tab's panel is there only once it renders, hence the flag.
    const rowRef = useRef<HTMLDivElement>(null);
    const panelsRef = useRef<HTMLDivElement>(null);
    const scrollToPanel = useRef(false);
    const scrollPanelToTop = () => {
        const row = rowRef.current;
        const panels = panelsRef.current;
        if (row && panels) window.scrollTo({ top: window.scrollY + panels.getBoundingClientRect().top - row.offsetHeight });
    };
    useLayoutEffect(() => {
        if (!scrollToPanel.current) return;
        scrollToPanel.current = false;
        scrollPanelToTop();
    }, [open]);

    const choose = (tab: WordTab) => {
        const row = rowRef.current;
        // Stuck: the row sits at the viewport's top while the page has scrolled past its place.
        const stuck = row !== null && row.getBoundingClientRect().top <= 0 && window.scrollY > 0;
        if (tab === open) {
            if (stuck) scrollPanelToTop();
        } else {
            scrollToPanel.current = stuck;
        }
        setChosen(tab);
        writePersistedControls(WORD_TAB_STORAGE_KEY, { tab });
        // The hash names the tab (none for Dict), replaced so tabs never fill the history.
        void navigate({ pathname, hash: wordTabHash(tab) }, { replace: true });
    };

    const status = vocabLearningStatus(progress, settings);
    const due = progress ? wordReviewTaskKeys([progress], vocab.id, settings, new Date(now)).length > 0 : false;
    const reviewable = due && !hasSessionInProgress(state);

    const header = (
        <DetailHeader
            parentPath="/vocab"
            layout="column"
            title={<span className="jp-display">{headwordOf(vocab)}</span>}
            chips={<HeaderChips vocab={vocab} />}
            actions={<div data-word-status>{progress ? (
                <LearnStatus
                    inStudy
                    status={status}
                    nextReview={statusReviewPhrase(status, vocabNextReviewAt(progress, settings), now)}
                    // Replacing this page: the session's end replaces itself with it again, so Back
                    // from either goes where it would have from this page, never to it twice.
                    onReview={reviewable ? () => void navigate(wordReviewPath(vocab.id), { replace: true }) : undefined}
                />
            ) : (
                <LearnStatus inStudy={false} learnLabel="Learn this word" onLearn={onLearn} />
            )}</div>}
        >
            {/* A word shown in kana names its kanji spellings in a note instead. */}
            {!vocab.usuallyKana && vocab.writtenForm.alternatives && vocab.writtenForm.alternatives.length > 0 && (
                <p className="font-mincho text-2xl text-secondary">{vocab.writtenForm.alternatives.join('・')}</p>
            )}
            {vocab.usuallyKana
                ? <div data-word-reading><KanjiSpellingNote vocab={vocab} /></div>
                : <p data-word-reading className="font-gothic text-2xl text-secondary">{vocab.reading.primary}</p>}
            {vocab.reading.alternatives.length > 0 && (
                <p className="type-meta">Also: <span className="font-gothic">{vocab.reading.alternatives.join('、')}</span></p>
            )}
            {/* Where the play button (issue 178) and the pitch accent (issue 176) will follow the reading. */}
            <p data-summary-gloss className="type-body pt-2">{summaryGloss(vocab.senses)}</p>
        </DetailHeader>
    );

    // Every tab's panel is there for its tab's aria-controls; only the open one has content.
    const panels = available.map(tab => (
        <div
            key={tab}
            ref={tab === open ? panelsRef : undefined}
            id={panelId(tab)}
            role="tabpanel"
            aria-labelledby={tabId(tab)}
            hidden={tab !== open}
            className="pt-6"
        >
            {tab === open && (
                <TabPanel
                    tab={tab}
                    vocab={vocab}
                    sentences={sentences}
                    wordSynonyms={wordSynonyms}
                    mixups={mixups}
                    studied={studied}
                    now={now}
                    knownKanji={knownKanji}
                    onChoose={choose}
                />
            )}
        </div>
    ));

    const tabs: PageTab<WordTab>[] = available.map(tab => ({ key: tab, label: TAB_LABEL[tab], id: tabId(tab), controls: panelId(tab) }));

    return (
        <Page width="narrow" data={{ 'data-sentences': sentencesSettled ? 'settled' : 'loading' }}>
            {header}
            <DetailBody
                tabsRef={rowRef}
                tabs={<TabNav label="About this word" tabs={tabs} selected={open} onSelect={choose} className={PAGE_BLEED_INSET} />}
                panels={panels}
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
}

function TabPanel({ tab, vocab, sentences, wordSynonyms, mixups, studied, now, knownKanji, onChoose }: TabPanelProps) {
    switch (tab) {
        case 'dict':
            return (
                <DictTab
                    vocab={vocab}
                    sentences={sentences}
                    synonymSections={wordSynonyms.sections}
                    onShowSentences={() => onChoose('sentence')}
                    onCompareSynonyms={() => onChoose('synonym')}
                />
            );
        case 'sentence': return <SentencesPanel vocabId={vocab.id} sentences={sentences} />;
        case 'synonym': return <SynonymsPanel vocab={vocab} sections={wordSynonyms.sections} mixedUp={wordSynonyms.mixedUp} />;
        case 'kanji': return <KanjiTab glyphs={vocab.writtenForm.containedKanji} knownKanji={knownKanji} />;
        case 'related': return <RelatedPanel vocab={vocab} />;
        case 'study': return studied ? <StudyTab vocabId={vocab.id} progress={studied} now={now} mixups={mixups} /> : null;
    }
}

/** The JLPT chip, then how common the word is on one line: the four bars and the band, the round reference and exact rank in its title. */
function HeaderChips({ vocab }: { vocab: Vocabulary }) {
    // A word learned in kana is met at its kana spelling's rank.
    const rank = vocab.usuallyKana ? vocab.frequency.kanaRank ?? vocab.frequency.kanjiRank : vocab.frequency.kanjiRank;
    const band = frequencyBand(rank);
    const title = band.ranked ? `${band.reference}, rank ${rank.toLocaleString('en-US')}` : band.reference;
    return (
        <>
            {vocab.jlptLevel && <JlptChip level={vocab.jlptLevel} />}
            <span className="inline-flex items-center gap-2 type-support" title={title}>
                <FrequencyMeter band={band} />
                {band.name}
            </span>
        </>
    );
}
