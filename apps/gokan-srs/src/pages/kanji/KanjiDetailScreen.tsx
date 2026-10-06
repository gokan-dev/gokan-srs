import { useParams, useNavigate } from "react-router-dom";
import type { Kanji } from "@gokan/dataset-schema";
import { Card } from "../../components/ui/Card";
import { JlptChip } from "../../components/JlptChip";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { useQuiz } from "../../context/useQuiz";
import { VocabularyService } from "../../services/vocabulary.service";
import { LoadingScreen } from "../../components/LoadingScreen";
import { KanjiVocabListCard } from "./KanjiVocabListCard";
import { PageHeader } from "../../components/PageHeader";
import { useAsyncData } from "../../hooks/useAsyncData";
import { DetailErrorScreen } from "../../components/detail/DetailErrorScreen";
import { DetailField } from "../../components/detail/DetailCard";

export default function KanjiDetailScreen() {
    const { character } = useParams<{ character: string }>();
    const navigate = useNavigate();
    const { isMobile } = useResponsive();
    const { state } = useQuiz();
    const kanjiLoad = useAsyncData(character ?? null, () => VocabularyService.loadKanji(character ?? ''));
    const vocabIdsLoad = useAsyncData(character ?? null, async () => (await VocabularyService.loadKanjiVocabIndex())[character ?? ''] ?? []);
    const kanji: Kanji | null = kanjiLoad.data ?? null;
    const vocabIds = vocabIdsLoad.data ?? [];
    const error = kanjiLoad.status === 'error'
        ? "Could not load kanji details."
        : kanjiLoad.status === 'ready' && !kanjiLoad.data ? "This kanji isn't in the app's known kanji set." : null;

    const isKnown = state.progress?.kanjiKnowledge.kanjiSet.has(character ?? '') ?? false;

    if (error) return <DetailErrorScreen message={error} />;

    if (!kanji) {
        return <LoadingScreen />;
    }

    const kanjiCard = (
        <Card size={isMobile ? "sm" : "md"}>
            <div className="flex flex-col items-center text-center gap-4">
                <span className="text-7xl md:text-8xl font-mincho text-primary leading-none">
                    {kanji.character}
                </span>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                    {kanji.steps.jlpt && <JlptChip level={kanji.steps.jlpt} />}
                    {isKnown && (
                        <span className="px-2 py-0.5 text-xs rounded bg-accent/10 text-accent font-gothic font-medium dark:bg-accent/15">
                            Known
                        </span>
                    )}
                </div>
            </div>
        </Card>
    );

    const metadataCard = (
        <Card size={isMobile ? "sm" : "md"}>
            <h2 className="text-lg font-gothic font-semibold text-primary mb-4">Information</h2>
            <div className="grid grid-cols-2 gap-4">
                <DetailField label="KKLC Step">
                    {kanji.steps.kklc ? `Step ${kanji.steps.kklc}` : '-'}
                </DetailField>
                <DetailField label="Frequency">
                    {kanji.frequency ? `#${kanji.frequency.toLocaleString()}` : '-'}
                </DetailField>
            </div>
        </Card>
    );

    const vocabListCard = <KanjiVocabListCard vocabIds={vocabIds} />;

    return (
        <div className="min-h-screen flex flex-col md:max-w-3xl md:mx-auto w-full animate-fade-in">
            {/* Header */}
            <PageHeader title="Kanji Details" onBack={() => void navigate(-1)} className="p-4 md:p-8" />

            {/* Content */}
            <main className="flex-1 p-4 md:p-8 pt-0 flex flex-col space-y-6">
                {kanjiCard}
                {metadataCard}
                {vocabListCard}
            </main>
        </div>
    );
}
