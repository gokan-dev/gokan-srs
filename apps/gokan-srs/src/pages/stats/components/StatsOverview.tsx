import type { UserProgress } from "../../../models/user.model";
import { useMemo } from "react";
import { percentOf, winRatesByQuizType } from "../../../utils/winRate.utils";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { VocabularyService } from "../../../services/vocabulary.service";
import { kanjiCoverage as computeKanjiCoverage } from "../../../utils/kanjiCoverage.utils";

interface StatsOverviewProps {
    progress: UserProgress;
}

export function StatsOverview({ progress }: StatsOverviewProps) {
    const frequencyIndex = useAsyncData('frequency-index', () => VocabularyService.loadFrequencyIndex()).data;
    const kanjiCoverage = useMemo(
        () => frequencyIndex ? computeKanjiCoverage(frequencyIndex, progress.learningQueue, progress.kanjiKnowledge) : null,
        [frequencyIndex, progress.learningQueue, progress.kanjiKnowledge]
    );

    const stats = useMemo(() => {
        const queue = progress.learningQueue;

        // Volume
        const totalLearned = queue.length;
        const graduated = queue.filter(v => v.stage === 'graduated').length;
        const learning = queue.filter(v => v.stage === 'learning').length;

        // Every quiz type: reading, meaning, production and grammar. It used to
        // count reading and meaning only.
        const { global } = winRatesByQuizType(progress);
        const totalAnswers = global.answers;
        const winrate = percentOf(global) ?? 0;

        return {
            totalLearned,
            graduated,
            learning,
            totalAnswers,
            winrate
        };
    }, [progress]);


    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 animate-slide-up">
            <StatCard title="Global Win Rate" value={`${stats.winrate}%`} subtitle={`${stats.totalAnswers} reviews`} />
            <StatCard 
                title="Kanji Coverage" 
                value={kanjiCoverage ? `${kanjiCoverage.covered}/${kanjiCoverage.total}` : "..."} 
                subtitle={kanjiCoverage && kanjiCoverage.total > 0 ? `${Math.round((kanjiCoverage.covered / kanjiCoverage.total) * 100)}% of known kanji` : "Coverage"} 
            />
            <StatCard title="Total Vocab" value={stats.totalLearned} subtitle="Introduced" />
            <StatCard title="Learning" value={stats.learning} subtitle="In progress" />
            <StatCard title="Graduated" value={stats.graduated} subtitle="Mastered" />
        </div>
    );
}

function StatCard({ title, value, subtitle }: { title: string, value: string | number, subtitle?: string }) {
    const stringValue = String(value);
    const valueSizeClass = stringValue.length > 5 ? "text-2xl" : "text-3xl";

    return (
        <div className="p-4 bg-surface rounded-xl shadow-sm border border-divider flex flex-col items-center justify-center h-28 transform transition-transform hover:scale-105 duration-200 text-center">
            <span className="text-sm text-secondary font-medium mb-1 truncate w-full">{title}</span>
            <span className={`${valueSizeClass} font-bold text-primary truncate w-full`}>{value}</span>
            {subtitle && <span className="text-xs text-tertiary mt-1 truncate w-full">{subtitle}</span>}
        </div>
    );
}
