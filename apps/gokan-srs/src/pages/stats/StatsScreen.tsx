import { Button } from "../../components/ui/Button";
import { useQuiz } from "../../context/useQuiz";
import { StatsOverview } from "./components/StatsOverview";
import { QuizTypeWinRates } from "./components/QuizTypeWinRates";
import { ReviewForecast } from "./components/ReviewForecast";
import { DailyProgressionChart } from "./components/DailyProgressionChart";
import { KnowledgeCurveChart } from "./components/KnowledgeCurveChart";
import { JlptCoverageChart } from "./components/JlptCoverageChart";
import { GrammarJlptCoverageChart } from "./components/GrammarJlptCoverageChart";
import { GrammarChapterCoverageChart } from "./components/GrammarChapterCoverageChart";
import { SmartVocabList } from "./components/SmartVocabList";
import { SmartGrammarList } from "./components/SmartGrammarList";
import { ArrowLeft } from "lucide-react";

interface StatsScreenProps {
    onBack: () => void;
    onVocabClick?: (vocabId: string) => void;
    onGrammarClick?: (grammarId: string) => void;
}

export function StatsScreen({ onBack, onVocabClick, onGrammarClick }: StatsScreenProps) {
    const { state } = useQuiz();

    // Guard if accessible without progress (though route is protected usually)
    if (!state.progress) return null;

    const card = "w-full min-w-0 p-6 bg-surface rounded-lg shadow-sm border border-divider";

    return (
        <div className="w-full max-w-6xl flex flex-col gap-6 animate-fade-in pb-12">
            <header className="w-full flex items-center justify-center relative h-12">
                <Button variant="ghost" onClick={onBack} className="absolute left-0">
                    <ArrowLeft className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Back
                </Button>
                <h1 className="text-xl font-serif text-primary">Statistics</h1>
            </header>

            <StatsOverview progress={state.progress} />

            {/* Two columns on desktop; one column on a phone. Cards in a row stretch
                to the taller one, so each row pairs charts of the same shape: the two
                bar charts share a height, and a bar chart next to the table or the
                curve would sit in a half-empty card. */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className={card}>
                    <h2 className="text-lg mb-4 text-primary font-serif">Review Forecast</h2>
                    <ReviewForecast progress={state.progress} />
                </section>

                <section className={card}>
                    <h2 className="text-lg mb-4 text-primary font-serif">Daily Progression</h2>
                    <DailyProgressionChart progress={state.progress} />
                </section>

                <section className={card}>
                    <h2 className="text-lg mb-4 text-primary font-serif">Win Rate by Quiz</h2>
                    <QuizTypeWinRates progress={state.progress} />
                </section>

                <section className={card}>
                    <h2 className="text-lg mb-4 text-primary font-serif">Knowledge Curve</h2>
                    <KnowledgeCurveChart progress={state.progress} settings={state.settings ?? undefined} />
                </section>

                <section className={card}>
                    <h2 className="text-lg mb-4 text-primary font-serif">JLPT Coverage</h2>
                    <JlptCoverageChart progress={state.progress} settings={state.settings ?? undefined} />
                </section>

                <section className={card}>
                    <h2 className="text-lg mb-4 text-primary font-serif">Grammar JLPT Coverage</h2>
                    <GrammarJlptCoverageChart progress={state.progress} />
                </section>

                {/* One row per chapter (151): it needs the full width. */}
                <section className={`${card} lg:col-span-2`}>
                    <h2 className="text-lg mb-4 text-primary font-serif">Grammar Chapter Coverage</h2>
                    <GrammarChapterCoverageChart progress={state.progress} />
                </section>
            </div>


            <section className="w-full">
                <h2 className="text-lg mb-4 text-primary font-serif">Vocabulary</h2>
                <SmartVocabList
                    progress={state.progress.learningQueue}
                    settings={state.settings ?? undefined}
                    onVocabClick={onVocabClick}
                />
            </section>

            <section className="w-full">
                <h2 className="text-lg mb-4 text-primary font-serif">Grammar</h2>
                <SmartGrammarList
                    progress={state.progress.grammarQueue}
                    onGrammarClick={onGrammarClick}
                />
            </section>
        </div>
    );
}
