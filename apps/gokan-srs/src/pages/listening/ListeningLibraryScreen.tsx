import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MediaIndexEntry, MediaLibraryWords } from "@gokan/dataset-schema";
import { MediaService } from "../../services/media.service";
import { useQuiz } from "../../context/useQuiz";
import { PageHeader } from "../../components/PageHeader";
import { ChapterProgressBar } from "../../components/ChapterProgressBar";
import {
    buildWordKnowledge,
    countWatchedEpisodes,
    formatPercent,
    isEpisodeWatched,
    knownRatio,
    libraryGenres,
    rankLibrary,
    speechSpeedLabel,
} from "../../utils/mediaCoverage.utils";
import { JitenCredit, MediaCover, VocabularyOnlyNote } from "./listeningShared";

/**
 * Route /listening: the anime in the library, ranked by how much of each one's
 * vocabulary the learner already knows, so the best fit for where they are now
 * comes first. The genre filter is saved in their settings (and so follows them
 * across devices); the search box is not.
 */
export function ListeningLibraryScreen() {
    const { state, actions } = useQuiz();
    const navigate = useNavigate();
    const [index, setIndex] = useState<MediaIndexEntry[] | null>(null);
    const [libraryWords, setLibraryWords] = useState<MediaLibraryWords | null>(null);
    const [failed, setFailed] = useState(false);
    const [query, setQuery] = useState('');

    useEffect(() => {
        Promise.all([MediaService.loadIndex(), MediaService.loadLibraryWords()])
            .then(([loadedIndex, loadedWords]) => {
                setIndex(loadedIndex);
                setLibraryWords(loadedWords);
            })
            .catch(() => setFailed(true));
    }, []);

    const knowledge = useMemo(
        () => buildWordKnowledge(state.progress?.learningQueue ?? [], state.settings ?? undefined),
        [state.progress?.learningQueue, state.settings]
    );
    const watched = state.progress?.watchedEpisodes;
    const selectedGenres = useMemo(() => state.settings?.listeningGenres ?? [], [state.settings?.listeningGenres]);
    const genres = useMemo(() => (index ? libraryGenres(index) : []), [index]);

    const toggleGenre = (genre: string) => {
        if (!state.settings) return;
        const next = selectedGenres.includes(genre)
            ? selectedGenres.filter(g => g !== genre)
            : [...selectedGenres, genre];
        actions.saveSettings({ ...state.settings, listeningGenres: next });
    };
    const clearGenres = () => {
        if (state.settings) actions.saveSettings({ ...state.settings, listeningGenres: [] });
    };

    const rows = useMemo(() => {
        if (!index || !libraryWords) return [];
        return rankLibrary(index, libraryWords, knowledge, selectedGenres, query).map(({ entry, coverage }) => {
            let nextEpisode: number | null = null;
            for (let n = 1; n <= entry.episodeCount; n++) {
                if (!isEpisodeWatched(watched, entry.id, n)) { nextEpisode = n; break; }
            }
            return { entry, coverage, nextEpisode, watchedCount: countWatchedEpisodes(watched, entry.id) };
        });
    }, [index, libraryWords, knowledge, watched, selectedGenres, query]);

    return (
        <div className="w-full max-w-3xl mx-auto px-4 py-6">
            <PageHeader title="Listening" onBack={() => void navigate('/')} className="mb-4" />

            <p className="font-serif text-sm text-secondary mb-1">
                Anime for listening practice, ordered by how much of their vocabulary you already know.
            </p>
            <VocabularyOnlyNote className="mb-5" />

            {failed && <p className="font-gothic text-sm text-secondary">Could not load the listening library.</p>}
            {!failed && !index && <p className="font-gothic text-sm text-secondary">Loading library...</p>}

            {index && (
                <div className="mb-5">
                    <input
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search a title"
                        className="w-full bg-surface border border-divider rounded px-3 py-2 text-base md:text-sm font-gothic text-primary placeholder:text-input-placeholder outline-none focus:border-accent mb-3"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-gothic text-xs text-secondary mr-1">I like</span>
                        {genres.map(genre => {
                            const on = selectedGenres.includes(genre);
                            return (
                                <button
                                    key={genre}
                                    type="button"
                                    onClick={() => toggleGenre(genre)}
                                    aria-pressed={on}
                                    className={`rounded-full border px-2.5 py-0.5 font-gothic text-xs transition-colors cursor-pointer ${
                                        on ? 'border-accent bg-accent/10 text-accent' : 'border-divider text-secondary hover:border-accent hover:text-accent'
                                    }`}
                                >
                                    {genre}
                                </button>
                            );
                        })}
                        {selectedGenres.length > 0 && (
                            <button type="button" onClick={clearGenres} className="font-gothic text-xs text-accent hover:underline ml-1 cursor-pointer">
                                Show all
                            </button>
                        )}
                    </div>
                    <p className="font-gothic text-xs text-tertiary mt-2">
                        {rows.length} of {index.length} titles
                        {selectedGenres.length > 0 && ' matching your genres'}
                    </p>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {rows.map(({ entry, coverage, nextEpisode, watchedCount }) => {
                    const speed = speechSpeedLabel(entry.speechSpeed);
                    const subtitle = entry.title.english ?? entry.title.romaji;
                    return (
                        <Link
                            key={entry.id}
                            to={`/listening/${entry.id}`}
                            className="flex gap-4 rounded-lg border border-divider bg-surface p-4 hover:border-accent transition-colors duration-200"
                        >
                            <MediaCover entry={entry} className="w-16 sm:w-20 self-start" />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <h2 className="font-mincho text-lg text-primary truncate">{entry.title.original}</h2>
                                        {subtitle && <p className="font-serif text-sm text-secondary truncate">{subtitle}</p>}
                                        <p className="font-gothic text-xs text-tertiary mt-1">
                                            {[
                                                entry.releaseYear,
                                                `${entry.episodeCount} episode${entry.episodeCount > 1 ? 's' : ''}`,
                                                speed && `${speed} speech`,
                                            ].filter(Boolean).join(' · ')}
                                        </p>
                                        {entry.genres.length > 0 && (
                                            <p className="font-gothic text-xs text-tertiary truncate">{entry.genres.join(' · ')}</p>
                                        )}
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

                                {(watchedCount > 0 || entry.episodeCount > 1) && (
                                    <p className="font-gothic text-xs text-secondary mt-3">
                                        {watchedCount > 0 && <span>{watchedCount} of {entry.episodeCount} watched · </span>}
                                        {nextEpisode !== null
                                            ? <span>Next: Episode {nextEpisode}</span>
                                            : <span>Every episode watched</span>}
                                    </p>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>

            {index && rows.length === 0 && (
                <p className="font-gothic text-sm text-secondary">No title matches. Try other genres or clear the search.</p>
            )}

            {index && <JitenCredit className="mt-8" />}
        </div>
    );
}
