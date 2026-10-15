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
import { JitenCredit, MediaCover, MediaCoverPlaceholder, VocabularyOnlyNote } from "./listeningShared";
import { FilterToggle } from "../../components/ui/FilterToggle";
import { Pagination } from "../../components/ui/Pagination";

const PAGE_SIZE = 20;
/** Enough rows to fill a desktop screen while the library loads, so nothing below moves up into view. */
const SKELETON_ROWS = 6;
/**
 * The list and a row's frame, shared by the loaded rows and their skeletons so the list keeps
 * its shape when the library arrives and the two cannot drift.
 */
const LIST_FRAME = 'flex flex-col divide-y divide-divider border-y border-divider';
const ROW_FRAME = 'flex gap-4 px-2 py-4 rounded-md';
/**
 * A typical meta line ("2013 · 12 episodes · Moderate speech · Comedy · Slice of Life"), one bar
 * per word at its measured width, so the skeleton's line wraps where the real one does on a phone.
 */
const META_WORD_WIDTHS = ['w-[33px]', 'w-[12px]', 'w-[57px]', 'w-[54px]', 'w-[48px]', 'w-[54px]', 'w-[27px]', 'w-[12px]', 'w-[21px]'];
/**
 * The genre pills before the index names them, at the widths the library's 13 genres measure
 * (most common first), so the row wraps onto as many lines as the real pills will at any width.
 * A library with other genres only costs a small shift.
 */
const GENRE_PLACEHOLDER_WIDTHS = [
    'w-[78px]', 'w-[100px]', 'w-[84px]', 'w-[74px]', 'w-[62px]', 'w-[90px]', 'w-[65px]',
    'w-[64px]', 'w-[60px]', 'w-[107px]', 'w-[76px]', 'w-[65px]', 'w-[65px]',
];

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
    const loaded = index !== null && libraryWords !== null;

    return (
        <Page width="narrow">
            <PageHeader
                title="Listening"
                subtitle="Anime for listening practice, ordered by how much of their vocabulary you already know."
                className="mb-2"
            />
            <VocabularyOnlyNote className="mb-6" />

            {failed && <p className="type-support">Could not load the listening library.</p>}

            {/* The filters and the list take their final place from the first frame, so the
                titles do not jump down when the library arrives. */}
            {!failed && (
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
                        {!loaded && GENRE_PLACEHOLDER_WIDTHS.map((width, i) => (
                            <span key={i} aria-hidden="true" className={`${width} h-[30px] rounded-md border border-divider animate-pulse`} />
                        ))}
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
                    {index && libraryWords ? (
                        <p className="type-meta">
                            {rows.length} of {index.length} titles
                            {selectedGenres.length > 0 && ' matching your genres'}
                        </p>
                    ) : (
                        <p className="type-meta">Loading the library...</p>
                    )}
                </div>
            )}

            {!failed && !loaded && (
                <div className={LIST_FRAME} aria-hidden="true">
                    {Array.from({ length: SKELETON_ROWS }, (_, i) => <LibraryRowSkeleton key={i} />)}
                </div>
            )}

            {loaded && <div className={LIST_FRAME}>
                {displayed.map(({ entry, coverage, nextEpisode, watchedCount }) => {
                    const speed = speechSpeedLabel(entry.speechSpeed);
                    const toLearn = coverage.unique.total - coverage.unique.mastered - coverage.unique.learning;
                    return (
                        <Link
                            key={entry.id}
                            to={`/listening/${entry.id}`}
                            className={`${ROW_FRAME} hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
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
            </div>}

            <Pagination page={shownPage} totalPages={totalPages} onPageChange={setPage} />

            {loaded && rows.length === 0 && (
                <p className="type-support">No title matches. Try other genres or clear the search.</p>
            )}

            {loaded && <JitenCredit className="mt-8" />}
        </Page>
    );
}

/** A grey bar standing in for a line of text, inside an element with that line's type so the row keeps its height. */
function TextBar({ width }: { width: string }) {
    return <span className={`inline-block h-[0.75em] ${width} max-w-full rounded-sm bg-divider align-middle animate-pulse`} />;
}

/** A library row before the library loads: the loaded row's frame, with bars where its text goes. */
function LibraryRowSkeleton() {
    return (
        <div className={ROW_FRAME}>
            <MediaCoverPlaceholder size="library" className="self-start" />
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <p className="font-mincho text-lg"><TextBar width="w-40" /></p>
                        <p className="type-support"><TextBar width="w-32" /></p>
                        <p className="type-meta mt-1">
                            {META_WORD_WIDTHS.map((width, i) => <span key={i}>{i > 0 && ' '}<TextBar width={width} /></span>)}
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="font-sans text-2xl leading-none"><TextBar width="w-10" /></p>
                        <p className="type-meta mt-1"><TextBar width="w-10" /></p>
                        <p className="type-meta"><TextBar width="w-[118px]" /></p>
                    </div>
                </div>

                <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-divider animate-pulse" />
                </div>
            </div>
        </div>
    );
}
