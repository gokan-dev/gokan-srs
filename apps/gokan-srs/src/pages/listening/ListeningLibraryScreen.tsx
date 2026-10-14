import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { MediaIndexEntry, MediaLibraryWords } from "@gokan/dataset-schema";
import { MediaService } from "../../services/media.service";
import { useQuiz } from "../../context/useQuiz";
import { Page } from "../../components/Page";
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
import { FilterToggle } from "../../components/ui/FilterToggle";
import { Pagination } from "../../components/ui/Pagination";

const PAGE_SIZE = 20;

/**
 * Route /listening: the anime in the library, ranked by how much of each one's
 * vocabulary the learner already knows, so the best fit for where they are now
 * comes first. The genre filter is saved in their settings (and so follows them
 * across devices); the search box is not.
 */
export function ListeningLibraryScreen() {
    const { state, actions } = useQuiz();
    const [index, setIndex] = useState<MediaIndexEntry[] | null>(null);
    const [libraryWords, setLibraryWords] = useState<MediaLibraryWords | null>(null);
    const [failed, setFailed] = useState(false);
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

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

    const totalPages = Math.ceil(rows.length / PAGE_SIZE) || 1;
    const shownPage = Math.min(page, totalPages);
    const displayed = rows.slice((shownPage - 1) * PAGE_SIZE, shownPage * PAGE_SIZE);

    return (
        <Page width="narrow">
            <PageHeader
                title="Listening"
                subtitle="Anime for listening practice, ordered by how much of their vocabulary you already know."
                className="mb-2"
            />
            <VocabularyOnlyNote className="mb-6" />

            {failed && <p className="type-support">Could not load the listening library.</p>}
            {!failed && !index && <p className="type-support">Loading the library...</p>}

            {index && (
                <div className="mb-6 space-y-3">
                    <input
                        type="search"
                        value={query}
                        onChange={e => { setQuery(e.target.value); setPage(1); }}
                        placeholder="Search a title"
                        aria-label="Search a title"
                        className="w-full bg-surface border border-divider rounded-md px-3 py-2 text-base md:text-sm font-sans text-primary placeholder:text-input-placeholder outline-none focus:border-accent"
                    />
                    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Genres">
                        <span className="type-label mr-1">Genres</span>
                        {genres.map(genre => (
                            <FilterToggle key={genre} active={selectedGenres.includes(genre)} onClick={() => { toggleGenre(genre); setPage(1); }}>
                                {genre}
                            </FilterToggle>
                        ))}
                        {selectedGenres.length > 0 && (
                            <button type="button" onClick={clearGenres} className="font-sans text-sm text-accent hover:underline ml-1 cursor-pointer">
                                Show all
                            </button>
                        )}
                    </div>
                    <p className="type-meta">
                        {rows.length} of {index.length} titles
                        {selectedGenres.length > 0 && ' matching your genres'}
                    </p>
                </div>
            )}

            <div className="flex flex-col divide-y divide-divider border-y border-divider">
                {displayed.map(({ entry, coverage, nextEpisode, watchedCount }) => {
                    const speed = speechSpeedLabel(entry.speechSpeed);
                    const toLearn = coverage.unique.total - coverage.unique.mastered - coverage.unique.learning;
                    return (
                        <Link
                            key={entry.id}
                            to={`/listening/${entry.id}`}
                            className="flex gap-4 px-2 py-4 rounded-md hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                            <MediaCover entry={entry} size="library" className="self-start" />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <h2 className="font-mincho text-lg text-primary truncate">{entry.title.original}</h2>
                                        {entry.title.english && <p className="type-support truncate">{entry.title.english}</p>}
                                        <p className="type-meta mt-1">
                                            {[
                                                entry.releaseYear,
                                                `${entry.episodeCount} episode${entry.episodeCount > 1 ? 's' : ''}`,
                                                speed && `${speed} speech`,
                                                ...entry.genres.slice(0, 3),
                                            ].filter(Boolean).join(' · ')}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-sans text-2xl text-primary tabular-nums leading-none">
                                            {formatPercent(knownRatio(coverage.occurrences))}
                                        </p>
                                        <p className="type-meta mt-1">known</p>
                                        <p className="type-meta tabular-nums">{toLearn.toLocaleString('en-US')} words to learn</p>
                                    </div>
                                </div>

                                <div className="mt-3">
                                    <ChapterProgressBar counts={coverage.occurrences} compact />
                                </div>

                                {watchedCount > 0 && (
                                    <p className="type-support mt-2">
                                        {watchedCount} of {entry.episodeCount} watched
                                        {nextEpisode !== null ? ` · Next: Episode ${nextEpisode}` : ' · Every episode watched'}
                                    </p>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>

            <Pagination page={shownPage} totalPages={totalPages} onPageChange={setPage} />

            {index && rows.length === 0 && (
                <p className="type-support">No title matches. Try other genres or clear the search.</p>
            )}

            {index && <JitenCredit className="mt-8" />}
        </Page>
    );
}
