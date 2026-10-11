import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuiz } from "../../context/useQuiz";
import { StatsOverview } from "./components/StatsOverview";
import { QuizTypeWinRates } from "./components/QuizTypeWinRates";
import { ReviewForecast } from "./components/ReviewForecast";
import { DailyProgressionChart } from "./components/DailyProgressionChart";
import { KnowledgeCurveChart } from "./components/KnowledgeCurveChart";
import { JlptCoverageChart } from "./components/JlptCoverageChart";
import { GrammarJlptCoverageChart } from "./components/GrammarJlptCoverageChart";
import { Page } from "../../components/Page";
import { PageHeader } from "../../components/PageHeader";

/** One chart: a card is an object, so each chart gets one, with its title inside. */
function ChartCard({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
    return (
        <div className={`w-full min-w-0 rounded-md border border-divider bg-surface p-5 md:p-6 ${className}`}>
            <h3 className="type-subsection mb-4">{title}</h3>
            {children}
        </div>
    );
}

/** A Stats section: a heading and its charts, two columns from `lg`. */
function StatsSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section>
            <h2 className="type-section mb-4">{title}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">{children}</div>
        </section>
    );
}

/** A report of how study is going. The lists are their own pages (Vocabulary, Grammar). */
export function StatsScreen() {
    const { state } = useQuiz();
    if (!state.progress) return null;
    const settings = state.settings ?? undefined;

    return (
        <Page width="wide">
            <PageHeader title="Stats" className="mb-8" />

            <div className="space-y-10">
                <StatsOverview progress={state.progress} settings={settings} />

                <StatsSection title="Reviews">
                    <ChartCard title="Review forecast">
                        <ReviewForecast progress={state.progress} settings={settings} />
                    </ChartCard>
                    <ChartCard title="Daily activity">
                        <DailyProgressionChart progress={state.progress} />
                    </ChartCard>
                </StatsSection>

                <StatsSection title="Accuracy">
                    <ChartCard title="Recall rate by quiz" className="lg:col-span-2">
                        <QuizTypeWinRates progress={state.progress} />
                    </ChartCard>
                </StatsSection>

                <StatsSection title="Knowledge">
                    <ChartCard title="Knowledge growth" className="lg:col-span-2">
                        <KnowledgeCurveChart progress={state.progress} settings={settings} />
                    </ChartCard>
                </StatsSection>

                <StatsSection title="Coverage">
                    <ChartCard title="JLPT vocabulary">
                        <JlptCoverageChart progress={state.progress} settings={settings} />
                    </ChartCard>
                    <ChartCard title="JLPT grammar">
                        <GrammarJlptCoverageChart progress={state.progress} />
                        <Link to="/grammar/chapters" className="inline-block mt-4 font-sans text-sm text-accent hover:underline">
                            See the curriculum
                        </Link>
                    </ChartCard>
                </StatsSection>
            </div>
        </Page>
    );
}
