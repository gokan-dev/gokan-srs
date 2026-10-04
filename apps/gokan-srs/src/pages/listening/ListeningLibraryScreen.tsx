import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MediaTitle } from "../../models/media.model";
import { MediaService } from "../../services/media.service";
import { useQuiz } from "../../context/useQuiz";
import { PageHeader } from "../../components/PageHeader";
import { ChapterProgressBar } from "../../components/ChapterProgressBar";
import {
    aggregateEpisodeWords,
    buildWordKnowledge,
    computeCoverage,
    countWatchedEpisodes,
    formatPercent,
    isEpisodeWatched,
    knownRatio,
    speechSpeedLabel,
} from "../../utils/mediaCoverage.utils";
import { JitenCredit, VocabularyOnlyNote } from "./listeningShared";

/**
 * Route /listening: the anime picked for listening practice, ranked by how much
 * of each one's vocabulary the learner already knows, so the best fit for where
 * they are now comes first. Each card names the next episode to watch.
 */
export function ListeningLibraryScreen() {
    const { state } = useQuiz();
    const navigate = useNavigate();
    const [titles, setTitles] = useState<MediaTitle[] | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        MediaService.loadAllTitles().then(setTitles).catch(() => setFailed(true));
    }, []);

    const knowledge = useMemo(
        () => buildWordKnowledge(state.progress?.learningQueue ?? [], state.settings ?? undefined),
        [state.progress?.learningQueue, state.settings]
    );
    const watched = state.progress?.watchedEpisodes;

    const rows = useMemo(() => {
        if (!titles) return [];
        return titles
            .map(title => {
                const coverage = computeCoverage(aggregateEpisodeWords(title.episodes), knowledge);
                const nextEpisode = title.episodes.find(e => !isEpisodeWatched(watched, title.id, e.number)) ?? null;
                return {
                    title,
                    coverage,
                    nextEpisode,
                    nextCoverage: nextEpisode ? knownRatio(computeCoverage(nextEpisode.words, knowledge).occurrences) : null,
                    watchedCount: countWatchedEpisodes(watched, title.id),
                };
            })
            .sort((a, b) => knownRatio(b.coverage.occurrences) - knownRatio(a.coverage.occurrences));
    }, [titles, knowledge, watched]);

    return (
        <div className="w-full max-w-3xl mx-auto px-4 py-6">
            <PageHeader title="Listening" onBack={() => navigate('/')} className="mb-4" />

            <p className="font-serif text-sm text-secondary mb-1">
                Anime picked for listening practice, ordered by how much of their vocabulary you already know.
            </p>
            <VocabularyOnlyNote className="mb-6" />

            {failed && <p className="font-gothic text-sm text-secondary">Could not load the listening library.</p>}
            {!failed && !titles && <p className="font-gothic text-sm text-secondary">Loading library...</p>}

            <div className="flex flex-col gap-3">
                {rows.map(({ title, coverage, nextEpisode, nextCoverage, watchedCount }) => {
                    const speed = speechSpeedLabel(title.speechSpeed);
                    const subtitle = title.title.english ?? title.title.romaji;
                    return (
                        <Link
                            key={title.id}
                            to={`/listening/${title.id}`}
                            className="block rounded-lg border border-divider bg-surface p-4 hover:border-accent transition-colors duration-200"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h2 className="font-mincho text-lg text-primary truncate">{title.title.original}</h2>
                                    {subtitle && <p className="font-serif text-sm text-secondary truncate">{subtitle}</p>}
                                    <p className="font-gothic text-xs text-tertiary mt-1">
                                        {[
                                            title.releaseYear,
                                            `${title.episodeCount} episodes`,
                                            speed && `${speed} speech`,
                                        ].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-serif text-2xl text-primary tabular-nums leading-none">
                                        {formatPercent(knownRatio(coverage.occurrences))}
                                    </p>
                                    <p className="font-gothic text-[11px] text-tertiary mt-1">of the vocabulary heard</p>
                                </div>
                            </div>

                            <div className="mt-3">
                                <ChapterProgressBar counts={coverage.occurrences} compact />
                                <p className="font-gothic text-xs text-tertiary mt-1.5 tabular-nums">
                                    {coverage.unique.mastered + coverage.unique.learning} of {coverage.unique.total} distinct words known
                                    {coverage.unique.mastered > 0 && ` (${coverage.unique.mastered} mastered)`}
                                </p>
                            </div>

                            <p className="font-gothic text-xs text-secondary mt-3">
                                {watchedCount > 0 && <span>{watchedCount} of {title.episodeCount} watched · </span>}
                                {nextEpisode
                                    ? <span>Next: {nextEpisode.title}{nextCoverage !== null && `, ${formatPercent(nextCoverage)} known`}</span>
                                    : <span>Every episode watched</span>}
                            </p>
                        </Link>
                    );
                })}
            </div>

            {titles && <JitenCredit className="mt-8" />}
        </div>
    );
}
