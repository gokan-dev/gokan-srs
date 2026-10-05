import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Kanji } from "../../models/kanji.model";
import { Card } from "../../components/ui/Card";
import { JlptChip } from "../../components/JlptChip";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { useQuiz } from "../../context/useQuiz";
import { VocabularyService } from "../../services/vocabulary.service";
import { Button } from "../../components/ui/Button";
import { LoadingScreen } from "../../components/LoadingScreen";
import { KanjiVocabListCard } from "./KanjiVocabListCard";
import { PageHeader } from "../../components/PageHeader";

export default function KanjiDetailScreen() {
    const { character } = useParams<{ character: string }>();
    const navigate = useNavigate();
    const { isMobile } = useResponsive();
    const { state } = useQuiz();
    const [kanji, setKanji] = useState<Kanji | null>(null);
    const [vocabIds, setVocabIds] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!character) return;

        setKanji(null);
        setError(null);

        VocabularyService.loadKanji(character)
            .then(k => {
                if (!k) {
                    setError("This kanji isn't in the app's known kanji set.");
                    return;
                }
                setKanji(k);
            })
            .catch(err => {
                console.error("Failed to load kanji", err);
                setError("Could not load kanji details.");
            });

        VocabularyService.loadKanjiVocabIndex()
            .then(index => setVocabIds(index[character] ?? []))
            .catch(err => console.error("Failed to load kanji-vocab index", err));
    }, [character]);

    const isKnown = state.progress?.kanjiKnowledge.kanjiSet.has(character ?? '') ?? false;

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 text-center">
                <div>
                    <h2 className="text-xl font-bold text-error mb-2">Error</h2>
                    <p className="text-secondary mb-4">{error}</p>
                    <Button onClick={() => void navigate(-1)}>Go Back</Button>
                </div>
            </div>
        );
    }

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
                <div>
                    <div className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-1">
                        KKLC Step
                    </div>
                    <div className="text-base text-primary font-gothic">
                        {kanji.steps.kklc ? `Step ${kanji.steps.kklc}` : '-'}
                    </div>
                </div>
                <div>
                    <div className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-1">
                        Frequency
                    </div>
                    <div className="text-base text-primary font-gothic">
                        {kanji.frequency ? `#${kanji.frequency.toLocaleString()}` : '-'}
                    </div>
                </div>
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
