import { useParams } from "react-router-dom";
import type { Kanji } from "@gokan/dataset-schema";
import { JlptChip } from "../../components/JlptChip";
import { useQuiz } from "../../context/useQuiz";
import { VocabularyService } from "../../services/vocabulary.service";
import { LoadingScreen } from "../../components/LoadingScreen";
import { KanjiVocabListCard } from "./KanjiVocabListCard";
import { Page } from "../../components/Page";
import { Button } from "../../components/ui/Button";
import { useAsyncData } from "../../hooks/useAsyncData";
import { DetailErrorScreen } from "../../components/detail/DetailErrorScreen";
import { DetailHeader } from "../../components/detail/DetailHeader";

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
        kanji.steps.kklc ? `KKLC step ${kanji.steps.kklc}` : null,
        kanji.frequency ? `Frequency #${kanji.frequency.toLocaleString('en-US')}` : null,
    ].filter(Boolean).join(' · ');

    return (
        <Page width="wide">
            <DetailHeader
                parentPath="/kanji"
                title={<span className="jp-display">{kanji.character}</span>}
                chips={kanji.steps.jlpt ? <JlptChip level={kanji.steps.jlpt} /> : undefined}
                actions={
                    <div className="flex flex-col items-start md:items-end gap-2">
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
                {facts && <p className="type-meta">{facts}</p>}
            </DetailHeader>

            <KanjiVocabListCard character={kanji.character} vocabIds={vocabIds} />
        </Page>
    );
}
