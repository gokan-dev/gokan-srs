import { useParams } from "react-router-dom";
import type { Kanji } from "@gokan/dataset-schema";
import { kanjiBookPositions, kanjiGradeLabel, kanjiOrder, kunReadingLabel } from "@gokan/dataset-schema";
import { JlptChip } from "../../components/JlptChip";
import { Chip } from "../../components/ui/Chip";
import { KanjiTile } from "../../components/KanjiTile";
import { useQuiz } from "../../context/useQuiz";
import { VocabularyService } from "../../services/vocabulary.service";
import { LoadingScreen } from "../../components/LoadingScreen";
import { KanjiVocabListCard } from "./KanjiVocabListCard";
import { Page } from "../../components/Page";
import { Button } from "../../components/ui/Button";
import { Disclosure } from "../../components/ui/Disclosure";
import { useAsyncData } from "../../hooks/useAsyncData";
import { DetailErrorScreen } from "../../components/detail/DetailErrorScreen";
import { DetailHeader } from "../../components/detail/DetailHeader";
import { DetailField, DetailSection } from "../../components/detail/DetailSection";
import { DetailBody } from "../../components/detail/DetailBody";
import type { KanjiLearningMethod } from "../../models/user.model";

export default function KanjiDetailScreen() {
    const { character } = useParams<{ character: string }>();
    const { state, actions } = useQuiz();
    const kanjiLoad = useAsyncData(character ?? null, () => VocabularyService.loadKanji(character ?? ''));
    const vocabIdsLoad = useAsyncData(character ?? null, async () => (await VocabularyService.loadKanjiVocabIndex())[character ?? ''] ?? []);
    const kanji: Kanji | null = kanjiLoad.data ?? null;
    // The components that are kanji of the dataset, so their tile links to their page.
    const linkedLoad = useAsyncData(kanji?.character ?? null, async () => {
        const found = await Promise.all((kanji?.components ?? []).map(component => VocabularyService.loadKanji(component)));
        return new Set(found.flatMap(entry => entry && entry.character !== kanji?.character ? [entry.character] : []));
    });
    const vocabIds = vocabIdsLoad.data ?? [];
    const error = kanjiLoad.status === 'error'
        ? "Could not load this kanji."
        : kanjiLoad.status === 'ready' && !kanjiLoad.data ? "This kanji isn't in the app's kanji set." : null;

    const knowledge = state.progress?.kanjiKnowledge;
    const isKnown = knowledge?.kanjiSet.has(character ?? '') ?? false;

    if (error) return <DetailErrorScreen message={error} />;
    if (!kanji) return <LoadingScreen />;

    // The same update the Kanji page's grid makes.
    const toggleKnown = () => {
        if (!knowledge) return;
        const kanjiSet = new Set(knowledge.kanjiSet);
        if (isKnown) kanjiSet.delete(kanji.character); else kanjiSet.add(kanji.character);
        actions.updateKanjiKnowledge({ ...knowledge, kanjiSet });
    };

    const position = methodPosition(kanji, knowledge?.method);
    const header = (
        <DetailHeader
            parentPath="/kanji"
            title={<span className="jp-display">{kanji.character}</span>}
            chips={(kanji.steps.jlpt || position) ? (
                <>
                    {kanji.steps.jlpt ? <JlptChip level={kanji.steps.jlpt} /> : null}
                    {position && <Chip>{position}</Chip>}
                </>
            ) : undefined}
            actions={
                <div className="flex flex-col items-start gap-2">
                    <span className="inline-flex items-center gap-1.5 type-support">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full border ${isKnown ? 'bg-accent border-accent' : 'border-divider'}`} aria-hidden="true" />
                        {isKnown ? 'Known' : 'Not known yet'}
                    </span>
                    <Button variant="secondary" onClick={toggleKnown}>
                        {isKnown ? 'Mark as not known' : 'Mark as known'}
                    </Button>
                </div>
            }
        >
            <KanjiReadings kanji={kanji} />
        </DetailHeader>
    );

    const meanings = kanji.meanings.length > 0 ? (
        <DetailSection title="Meanings">
            <p className="type-body">{kanji.meanings.join(', ')}</p>
        </DetailSection>
    ) : null;
    const components = (
        <DetailSection title="Components">
            {kanji.components.length > 0 && (
                <ul className="flex flex-wrap gap-3 mb-3">
                    {kanji.components.map(component => (
                        <li key={component}>
                            <KanjiTile glyph={component} to={linkedLoad.data?.has(component) ? `/kanji/${component}` : undefined} />
                        </li>
                    ))}
                </ul>
            )}
            <p className="type-meta">
                {kanji.strokeCount} stroke{kanji.strokeCount === 1 ? '' : 's'}
                {kanji.radical && <> · Radical <span className="font-gothic">{kanji.radical.character}</span></>}
            </p>
        </DetailSection>
    );
    const words = <KanjiVocabListCard character={kanji.character} vocabIds={vocabIds} />;
    const details = <KanjiDetails kanji={kanji} />;

    return (
        <Page width="wide">
            {header}
            <DetailBody
                main={<>{meanings}{words}</>}
                side={<>{components}{details}</>}
                stacked={<>{meanings}{components}{words}{details}</>}
            />
        </Page>
    );
}

/** On and kun readings, each labelled, the okurigana in parentheses: まな(ぶ). */
function KanjiReadings({ kanji }: { kanji: Kanji }) {
    const rows = [
        { label: 'On', readings: kanji.readings.on },
        { label: 'Kun', readings: kanji.readings.kun.map(kunReadingLabel) },
    ].filter(row => row.readings.length > 0);
    if (rows.length === 0) return null;
    return (
        <dl className="space-y-1">
            {rows.map(row => (
                <div key={row.label} className="flex items-baseline gap-3">
                    <dt className="type-label w-8 shrink-0">{row.label}</dt>
                    <dd className="min-w-0 font-gothic text-2xl text-secondary">{row.readings.join('、')}</dd>
                </div>
            ))}
        </dl>
    );
}

/** The kanji's place in the learner's own method, when that method numbers it: "RTK #346". */
function methodPosition(kanji: Kanji, method: KanjiLearningMethod | undefined): string | null {
    // JLPT is a level (the chip shows it) and frequency has no book number.
    if (method === undefined || method === 'jlpt' || method === 'frequency') return null;
    const position = kanji.steps[method];
    return position === undefined ? null : `${kanjiOrder(method).label} #${position.toLocaleString('en-US')}`;
}

function KanjiDetails({ kanji }: { kanji: Kanji }) {
    return (
        <Disclosure title="Dictionary details">
            <dl className="space-y-3">
                {kanji.grade !== undefined && <DetailField label="School grade">{kanjiGradeLabel(kanji.grade)}</DetailField>}
                {kanji.radical && (
                    <DetailField label="Radical"><span className="font-gothic">{kanji.radical.character}</span> (Kangxi {kanji.radical.number})</DetailField>
                )}
                {kanji.newspaperFrequency !== undefined && (
                    <DetailField label="Newspaper frequency">#{kanji.newspaperFrequency.toLocaleString('en-US')} of 2,500</DetailField>
                )}
                {kanji.readings.nanori.length > 0 && (
                    <DetailField label="Readings in names"><span className="font-gothic">{kanji.readings.nanori.join('、')}</span></DetailField>
                )}
                {kanjiBookPositions(kanji).map(({ book, name, position }) => (
                    <DetailField key={book} label={name}>#{position.toLocaleString('en-US')}</DetailField>
                ))}
            </dl>
        </Disclosure>
    );
}
