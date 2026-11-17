import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import type { Kanji } from "@gokan/dataset-schema";
import { frequencyBand, kanjiBookPositions, kanjiGradeLabel, kanjiOrder } from "@gokan/dataset-schema";
import { JlptChip } from "../../components/JlptChip";
import { HowCommon } from "../../components/FrequencyMeter";
import { KanjiReadings } from "../../components/KanjiReadings";
import { Chip } from "../../components/ui/Chip";
import { KanjiTile } from "../../components/KanjiTile";
import { StatusDot } from "../../components/StatusDot";
import { useQuiz } from "../../context/useQuiz";
import { VocabularyService } from "../../services/vocabulary.service";
import { LoadingScreen } from "../../components/LoadingScreen";
import { Page } from "../../components/Page";
import { Button } from "../../components/ui/Button";
import { Disclosure } from "../../components/ui/Disclosure";
import { TextButton } from "../../components/ui/TextButton";
import { useAsyncData } from "../../hooks/useAsyncData";
import { DetailErrorScreen } from "../../components/detail/DetailErrorScreen";
import { DetailHeader } from "../../components/detail/DetailHeader";
import { DetailField, DetailSection } from "../../components/detail/DetailSection";
import { DetailTabsBody } from "../../components/detail/DetailTabsBody";
import { useDetailTabs } from "../../components/detail/useDetailTabs";
import type { KanjiLearningMethod } from "../../models/user.model";
import { KANJI_TABS } from "../../utils/detailTabs.utils";
import { STATUS_LABEL, vocabLearningStatus } from "../../utils/learningStatus.utils";
import { kanjiPath } from "../../utils/navigation.utils";
import { KanjiWordRows, KanjiWordsPanel } from "./KanjiWords";

type KanjiTab = typeof KANJI_TABS.tabs[number];

const TAB_LABEL: Record<KanjiTab, string> = {
    kanji: 'Kanji',
    words: 'Words',
    study: 'Study',
};

/** The full page's columns: the kanji and its words in the main one, the learner's words beside them, then Details. */
const FULL_MAIN: readonly KanjiTab[] = ['kanji', 'words'];
const FULL_SIDE: readonly KanjiTab[] = ['study'];

/** The first tab's words: the most common, the learner's own first. */
const COMMON_WORDS = 5;
/** A full page's previews (DESIGN_SYSTEM section 5, Kanji page): its tabs show 20 at a time. */
const FULL_WORD_ROWS = 10;
const FULL_STUDY_ROWS = 5;

/**
 * Route /kanji/:character: a kanji's page. A header holding the glyph, its readings and its facts
 * (how common, grade, strokes, radical), with Known / Not known; then below `lg` a row of tabs
 * (Kanji, Words, and Study when the learner studies words with it), from `lg` the same panels as
 * one full page (DESIGN_SYSTEM section 5, Kanji page).
 */
export default function KanjiDetailScreen() {
    const { character } = useParams<{ character: string }>();
    const kanjiLoad = useAsyncData(character ?? null, () => VocabularyService.loadKanji(character ?? ''));
    const vocabIdsLoad = useAsyncData(character ?? null, async () => (await VocabularyService.loadKanjiVocabIndex())[character ?? ''] ?? []);
    const kanji: Kanji | null = kanjiLoad.data ?? null;
    const error = kanjiLoad.status === 'error'
        ? "Could not load this kanji."
        : kanjiLoad.status === 'ready' && !kanjiLoad.data ? "This kanji isn't in the app's kanji set." : null;

    if (error) return <DetailErrorScreen message={error} />;
    if (!kanji) return <LoadingScreen />;
    // Keyed by the kanji: another kanji opens on its own tab choice, its lists collapsed.
    return <KanjiPage key={kanji.character} kanji={kanji} vocabIds={vocabIdsLoad.data ?? []} wordsSettled={vocabIdsLoad.status !== 'loading'} />;
}

interface KanjiPageProps {
    kanji: Kanji;
    /** The kanji's words, in frequency order. */
    vocabIds: readonly string[];
    /** The words' index has loaded (or failed): the page is drawn in full (`data-words`, which check-layout waits on). */
    wordsSettled: boolean;
}

function KanjiPage({ kanji, vocabIds, wordsSettled }: KanjiPageProps) {
    const { state, actions } = useQuiz();
    const settings = state.settings ?? undefined;
    const knowledge = state.progress?.kanjiKnowledge;
    const isKnown = knowledge?.kanjiSet.has(kanji.character) ?? false;
    // The components that are kanji of the dataset, so their tile links to their page.
    const linkedLoad = useAsyncData(kanji.character, async () => {
        const found = await Promise.all(kanji.components.map(component => VocabularyService.loadKanji(component)));
        return new Set(found.flatMap(entry => entry && entry.character !== kanji.character ? [entry.character] : []));
    });

    const queue = state.progress?.learningQueue;
    const progressById = new Map((queue ?? []).map(p => [p.vocabId, p]));
    const studiedIds = vocabIds.filter(id => progressById.get(id)?.introductionAt);
    const studiedSet = new Set(studiedIds);
    const commonIds = [...studiedIds, ...vocabIds.filter(id => !studiedSet.has(id))].slice(0, COMMON_WORDS);

    const has: Record<KanjiTab, boolean> = { kanji: true, words: vocabIds.length > 0, study: studiedIds.length > 0 };
    const tabs = useDetailTabs({ set: KANJI_TABS, prefix: 'kanji', has, sections: [...FULL_MAIN, ...FULL_SIDE], settled: wordsSettled });

    // The same update the Kanji page's grid makes.
    const toggleKnown = () => {
        if (!knowledge) return;
        const kanjiSet = new Set(knowledge.kanjiSet);
        if (isKnown) kanjiSet.delete(kanji.character); else kanjiSet.add(kanji.character);
        actions.updateKanjiKnowledge({ ...knowledge, kanjiSet });
    };

    const method = knowledge?.method;
    const position = methodPosition(kanji, method);
    const header = (
        <DetailHeader
            parentPath="/kanji"
            layout={tabs.full ? 'grid' : 'column'}
            title={<span className="jp-display">{kanji.character}</span>}
            chips={(kanji.steps.jlpt || position) ? (
                <>
                    {kanji.steps.jlpt ? <JlptChip level={kanji.steps.jlpt} /> : null}
                    {position && <Chip>{position}</Chip>}
                </>
            ) : undefined}
            facts={<KanjiFacts kanji={kanji} />}
            actions={
                <div className="flex flex-col items-start gap-2">
                    <StatusDot status={isKnown ? 'mastered' : 'new'} label={isKnown ? 'Known' : 'Not known yet'} />
                    <Button variant="secondary" onClick={toggleKnown}>
                        {isKnown ? 'Mark as not known' : 'Mark as known'}
                    </Button>
                </div>
            }
        >
            <KanjiReadings kanji={kanji} size="large" />
        </DetailHeader>
    );

    const details = detailFields(kanji, method);
    const glyph = <span className="font-mincho">{kanji.character}</span>;

    const render = (tab: KanjiTab, preview: boolean): ReactNode => {
        switch (tab) {
            case 'kanji':
                return (
                    <div className="space-y-10">
                        {kanji.meanings.length > 0 && (
                            <DetailSection title="Meanings">
                                <p className="type-body">{kanji.meanings.join(', ')}</p>
                            </DetailSection>
                        )}
                        {kanji.components.length > 0 && (
                            <DetailSection title="Components">
                                <ul className="flex flex-wrap gap-3">
                                    {kanji.components.map(component => (
                                        <li key={component}>
                                            <KanjiTile glyph={component} to={linkedLoad.data?.has(component) ? kanjiPath(component) : undefined} />
                                        </li>
                                    ))}
                                </ul>
                            </DetailSection>
                        )}
                        {commonIds.length > 0 && (
                            <DetailSection
                                title="Common words"
                                aside={vocabIds.length > COMMON_WORDS
                                    ? <TextButton onClick={() => tabs.choose('words')} arrow>All {vocabIds.length.toLocaleString('en-US')} words</TextButton>
                                    : undefined}
                            >
                                <KanjiWordRows ids={commonIds} />
                            </DetailSection>
                        )}
                        {/* Below `lg` the details fold at the tab's foot; the full page has them in its side column. */}
                        {!preview && details && (
                            <Disclosure title="Details" className="border-t border-divider pt-4">
                                <dl className="space-y-3">{details}</dl>
                            </Disclosure>
                        )}
                    </div>
                );
            case 'words':
                return <KanjiWordsPanel ids={vocabIds} label={`Search the words with ${kanji.character}`} {...(preview ? { pageSize: FULL_WORD_ROWS } : {})} />;
            case 'study':
                return (
                    <DetailSection title={<>Your words with {glyph}</>} focusable={preview} aside={<p className="type-meta">{statusCounts(studiedIds.map(id => vocabLearningStatus(progressById.get(id), settings)))}</p>}>
                        <KanjiWordsPanel ids={studiedIds} label={`Search your words with ${kanji.character}`} {...(preview ? { pageSize: FULL_STUDY_ROWS } : {})} />
                    </DetailSection>
                );
        }
    };

    return (
        <Page width={tabs.full ? 'wide' : 'narrow'} data={{ 'data-words': wordsSettled ? 'settled' : 'loading' }}>
            {header}
            <DetailTabsBody
                tabs={tabs}
                label="About this kanji"
                labels={TAB_LABEL}
                main={FULL_MAIN}
                side={FULL_SIDE}
                ownHeadings={['kanji', 'study']}
                render={render}
                sideFoot={details ? (
                    <DetailSection title="Details">
                        <dl className="space-y-3">{details}</dl>
                    </DetailSection>
                ) : undefined}
            />
        </Page>
    );
}

/** The kanji's place in the learner's own method, when that method numbers it: "RTK #346". */
function methodPosition(kanji: Kanji, method: KanjiLearningMethod | undefined): string | null {
    // JLPT is a level (the chip shows it) and frequency has no book number.
    if (method === undefined || method === 'jlpt' || method === 'frequency') return null;
    const position = kanji.steps[method];
    return position === undefined ? null : `${kanjiOrder(method).label} #${position.toLocaleString('en-US')}`;
}

/** The header's facts row: how common the kanji is in newspapers, its school grade, strokes and radical. */
function KanjiFacts({ kanji }: { kanji: Kanji }) {
    return (
        <>
            <DetailField compact label="How common">
                <HowCommon band={frequencyBand(kanji.newspaperFrequency, 'kanji')} rank={kanji.newspaperFrequency} />
            </DetailField>
            {kanji.grade !== undefined && <DetailField compact label="School grade">{kanjiGradeLabel(kanji.grade)}</DetailField>}
            <DetailField compact label="Strokes">{kanji.strokeCount}</DetailField>
            {kanji.radical && <DetailField compact label="Radical"><span className="font-gothic">{kanji.radical.character}</span></DetailField>}
        </>
    );
}

/**
 * What a learner rarely looks a kanji up for: its readings in names, its Kangxi radical's number,
 * and its number in every book but the learner's own method (its chip). Null when it has none.
 */
function detailFields(kanji: Kanji, method: KanjiLearningMethod | undefined): ReactNode {
    const books = kanjiBookPositions(kanji).filter(({ book }) => book !== method);
    if (kanji.readings.nanori.length === 0 && !kanji.radical && books.length === 0) return null;
    return (
        <>
            {kanji.readings.nanori.length > 0 && (
                <DetailField label="Readings in names"><span className="font-gothic">{kanji.readings.nanori.join('、')}</span></DetailField>
            )}
            {kanji.radical && <DetailField label="Kangxi radical">No. {kanji.radical.number}</DetailField>}
            {books.map(({ book, name, position }) => (
                <DetailField key={book} label={name}>#{position.toLocaleString('en-US')}</DetailField>
            ))}
        </>
    );
}

/** "3 learning · 2 mastered": the learner's words with the kanji, by status, the ones it has. */
function statusCounts(statuses: readonly ReturnType<typeof vocabLearningStatus>[]): string {
    return (['learning', 'mastered'] as const)
        .map(status => ({ status, n: statuses.filter(s => s === status).length }))
        .filter(({ n }) => n > 0)
        .map(({ status, n }) => `${n.toLocaleString('en-US')} ${STATUS_LABEL[status].toLowerCase()}`)
        .join(' · ');
}
