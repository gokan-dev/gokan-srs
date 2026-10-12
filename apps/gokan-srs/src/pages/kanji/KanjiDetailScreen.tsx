import { useParams } from "react-router-dom";
import type { Kanji } from "@gokan/dataset-schema";
import { kanjiBookPositions, kanjiGradeLabel, kanjiOrder, kunReadingParts } from "@gokan/dataset-schema";
import { JlptChip } from "../../components/JlptChip";
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
import type { KanjiLearningMethod } from "../../models/user.model";

export default function KanjiDetailScreen() {
    const { character } = useParams<{ character: string }>();
    const { state, actions } = useQuiz();
    const kanjiLoad = useAsyncData(character ?? null, () => VocabularyService.loadKanji(character ?? ''));
    const vocabIdsLoad = useAsyncData(character ?? null, async () => (await VocabularyService.loadKanjiVocabIndex())[character ?? ''] ?? []);
    const kanji: Kanji | null = kanjiLoad.data ?? null;
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

    const facts = [
        methodPosition(kanji, knowledge?.method),
        `${kanji.strokeCount} stroke${kanji.strokeCount === 1 ? '' : 's'}`,
        kanji.radical ? `Radical ${kanji.radical.character}` : null,
        kanji.grade !== undefined ? kanjiGradeLabel(kanji.grade) : null,
    ].filter(Boolean).join(' · ');

    return (
        <Page width="wide">
            <DetailHeader
                parentPath="/kanji"
                title={<span className="jp-display">{kanji.character}</span>}
                chips={kanji.steps.jlpt ? <JlptChip level={kanji.steps.jlpt} /> : undefined}
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
                {kanji.meanings.length > 0 && <p className="text-xl text-primary">{kanji.meanings.join(', ')}</p>}
                <KanjiReadings kanji={kanji} />
                {facts && <p className="type-meta">{facts}</p>}
            </DetailHeader>

            {kanji.components.length > 0 && (
                <DetailSection title="Components">
                    <ul className="flex flex-wrap gap-3">
                        {kanji.components.map(component => (
                            <li
                                key={component}
                                className="w-12 h-12 flex items-center justify-center rounded-md border border-divider bg-surface font-mincho text-2xl text-primary"
                            >
                                {component}
                            </li>
                        ))}
                    </ul>
                </DetailSection>
            )}

            <KanjiVocabListCard character={kanji.character} vocabIds={vocabIds} />

            <KanjiDetails kanji={kanji} />
        </Page>
    );
}

/** On and kun readings, the okurigana of a kun reading set apart: まな(ぶ). */
function KanjiReadings({ kanji }: { kanji: Kanji }) {
    const { on, kun } = kanji.readings;
    if (on.length === 0 && kun.length === 0) return null;
    return (
        <div className="space-y-1">
            {on.length > 0 && <p className="font-gothic text-xl text-secondary">{on.join('、')}</p>}
            {kun.length > 0 && (
                <p className="font-gothic text-xl text-secondary">
                    {kun.map((reading, i) => {
                        const { stem, okurigana } = kunReadingParts(reading);
                        return (
                            <span key={reading}>
                                {i > 0 && '、'}
                                {stem}
                                {okurigana && <span className="text-tertiary">{okurigana}</span>}
                            </span>
                        );
                    })}
                </p>
            )}
        </div>
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
    const positions = kanjiBookPositions(kanji);
    return (
        <Disclosure title="Dictionary details">
            <dl className="space-y-3">
                {kanji.readings.nanori.length > 0 && (
                    <DetailField label="Name readings"><span className="font-gothic">{kanji.readings.nanori.join('、')}</span></DetailField>
                )}
                {kanji.newspaperFrequency !== undefined && (
                    <DetailField label="Newspaper frequency">#{kanji.newspaperFrequency.toLocaleString('en-US')} of 2,500</DetailField>
                )}
                {kanji.radical && (
                    <DetailField label="Radical">{kanji.radical.character} (Kangxi {kanji.radical.number})</DetailField>
                )}
                {positions.map(({ book, name, position }) => (
                    <DetailField key={book} label={name}>#{position.toLocaleString('en-US')}</DetailField>
                ))}
            </dl>
        </Disclosure>
    );
}
