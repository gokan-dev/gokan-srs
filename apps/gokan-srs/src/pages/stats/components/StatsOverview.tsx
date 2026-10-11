import type { UserProgress, UserSettings } from "../../../models/user.model";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { percentOf, winRatesByQuizType } from "../../../utils/winRate.utils";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { VocabularyService } from "../../../services/vocabulary.service";
import { kanjiCoverage as computeKanjiCoverage } from "../../../utils/kanjiCoverage.utils";
import { isVocabFullyMastered } from "../../../services/scheduling";

interface StatsOverviewProps {
    progress: UserProgress;
    settings: UserSettings | undefined;
}

/** The Stats summary row: recall rate, words learning and mastered (each opening the list), kanji coverage. */
export function StatsOverview({ progress, settings }: StatsOverviewProps) {
    const frequencyIndex = useAsyncData('frequency-index', () => VocabularyService.loadFrequencyIndex()).data;
    const kanjiCoverage = useMemo(
        () => frequencyIndex ? computeKanjiCoverage(frequencyIndex, progress.learningQueue, progress.kanjiKnowledge) : null,
        [frequencyIndex, progress.learningQueue, progress.kanjiKnowledge]
    );

    const stats = useMemo(() => {
        const mastered = progress.learningQueue.filter(v => isVocabFullyMastered(v, settings)).length;
        // Every quiz type: reading, meaning, production and grammar.
        const { global } = winRatesByQuizType(progress);
        return {
            mastered,
            learning: progress.learningQueue.length - mastered,
            answers: global.answers,
            recallRate: percentOf(global),
        };
    }, [progress, settings]);

    const n = (value: number) => value.toLocaleString('en-US');

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile label="Recall rate" value={stats.recallRate === null ? '-' : `${stats.recallRate}%`} detail={`${n(stats.answers)} answers`} />
            <Tile label="Learning" value={n(stats.learning)} detail="words" to="/vocab?status=learning" />
            <Tile label="Mastered" value={n(stats.mastered)} detail="words" to="/vocab?status=mastered" />
            <Tile
                label="Kanji coverage"
                value={kanjiCoverage ? `${n(kanjiCoverage.covered)} / ${n(kanjiCoverage.total)}` : '...'}
                detail="known kanji used in at least one word you study"
            />
        </div>
    );
}

function Tile({ label, value, detail, to }: { label: string; value: ReactNode; detail: string; to?: string }) {
    const body = (
        <>
            <span className="type-label">{label}</span>
            <span className="font-sans text-2xl text-primary tabular-nums mt-1">{value}</span>
            <span className="type-meta mt-0.5">{detail}</span>
        </>
    );
    const frame = "relative flex flex-col rounded-md border border-divider bg-surface p-4 min-w-0";
    if (!to) return <div className={frame}>{body}</div>;
    return (
        <Link to={to} className={`${frame} hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}>
            {body}
            <ChevronRight size={16} className="absolute top-4 right-3 text-tertiary" aria-hidden="true" />
        </Link>
    );
}
