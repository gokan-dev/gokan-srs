import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import type { MediaEpisode, MediaTitle, MediaWordCount, WatchedEpisode } from "../../models/media.model";
import type { Vocabulary } from "../../models/vocabulary.model";
import { MediaService } from "../../services/media.service";
import { VocabularyService } from "../../services/vocabulary.service";
import { useQuiz } from "../../context/useQuiz";
import { PageHeader } from "../../components/PageHeader";
import { ChapterProgressBar } from "../../components/ChapterProgressBar";
import { usePersistControls, usePersistedControlsSnapshot } from "../../hooks/usePersistedControls";
import {
    aggregateEpisodeWords,
    buildWordKnowledge,
    computeCoverage,
    countWatchedEpisodes,
    episodeKey,
    formatPercent,
    knownRatio,
    speechSpeedLabel,
    unknownWords,
} from "../../utils/mediaCoverage.utils";
import type { WordKnowledge } from "../../utils/mediaCoverage.utils";
import { WORD_SORTS, isLearnableNow, sortWords } from "../../utils/wordOrder.utils";
import type { LearnerOrder, WordOrderContext, WordSort } from "../../utils/wordOrder.utils";
import { JitenCredit, MediaCover, VocabularyOnlyNote } from "./listeningShared";
import { useWordOrdering } from "./useWordOrdering";

/** Words shown at first in a "words to learn" list, and how many more each "Show more" adds. */
const PAGE_SIZE = 10;
const MORE_SIZE = 20;
const SORT_STORAGE_KEY = 'gokan.listening.wordSort';

/** Everything a "words to learn" list needs besides its own words. */
interface WordListProps {
    knowledge: Map<string, WordKnowledge>;
    sort: WordSort;
    onSortChange: (sort: WordSort) => void;
    orderContext: WordOrderContext | null;
    learner: LearnerOrder | null;
    onLearn: (vocab: Vocabulary) => void;
}

/**
 * Route /listening/:mediaId: one anime, with how much of the whole series and
 * of each episode the learner knows, a watched mark per episode (or all at
 * once), and the words they don't know yet, for the whole series and per
 * episode, sorted their way and addable to the learning list from here.
 */
export function ListeningTitleScreen() {
    const { mediaId = '' } = useParams<{ mediaId: string }>();
    const navigate = useNavigate();
    const { state, actions } = useQuiz();
    const [title, setTitle] = useState<MediaTitle | null>(null);
    const [failed, setFailed] = useState(false);
    const [expanded, setExpanded] = useState<number | 'series' | null>(null);
    const persisted = usePersistedControlsSnapshot<{ sort: WordSort }>(SORT_STORAGE_KEY);
    const [sort, setSort] = useState<WordSort>(persisted.sort ?? 'yours');
    usePersistControls(SORT_STORAGE_KEY, { sort }, [sort]);
    const { context: orderContext, learner } = useWordOrdering();

    useEffect(() => {
        MediaService.loadTitle(mediaId).then(setTitle).catch(() => setFailed(true));
    }, [mediaId]);

    const knowledge = useMemo(
        () => buildWordKnowledge(state.progress?.learningQueue ?? [], state.settings ?? undefined),
        [state.progress?.learningQueue, state.settings]
    );
    const watched = state.progress?.watchedEpisodes;
    const seriesWords = useMemo(() => (title ? aggregateEpisodeWords(title.episodes) : []), [title]);
    const seriesCoverage = useMemo(() => computeCoverage(seriesWords, knowledge), [seriesWords, knowledge]);

    if (failed) {
        return (
            <div className="w-full max-w-3xl mx-auto px-4 py-6">
                <PageHeader title="Listening" onBack={() => navigate('/listening')} className="mb-4" />
                <p className="font-gothic text-sm text-secondary">Could not load this title.</p>
            </div>
        );
    }

    if (!title) {
        return (
            <div className="w-full max-w-3xl mx-auto px-4 py-6">
                <p className="font-gothic text-sm text-secondary">Loading...</p>
            </div>
        );
    }

    const speed = speechSpeedLabel(title.speechSpeed);
    const watchedCount = countWatchedEpisodes(watched, title.id);
    const allWatched = watchedCount === title.episodeCount;
    const subtitle = [title.title.romaji, title.title.english].filter(Boolean).join(' · ');
    const toggle = (key: number | 'series') => setExpanded(prev => (prev === key ? null : key));
    const listProps: WordListProps = {
        knowledge,
        sort,
        onSortChange: setSort,
        orderContext,
        learner,
        onLearn: vocab => actions.saveVocabIntroChoice(vocab, 'learn'),
    };

    const setAllWatched = (isWatched: boolean) => actions.setEpisodesWatched(
        title.id,
        title.episodes.map(episode => ({
            number: episode.number,
            coverage: knownRatio(computeCoverage(episode.words, knowledge).occurrences),
        })),
        isWatched
    );

    return (
        <div className="w-full max-w-3xl mx-auto px-4 py-6">
            <PageHeader
                title={<span className="font-mincho">{title.title.original}</span>}
                onBack={() => navigate('/listening')}
                className="mb-4"
            />

            <section className="rounded-lg border border-divider bg-surface p-4 mb-6 flex gap-4">
                <MediaCover entry={title} hiRes className="w-24 sm:w-32 self-start" />
                <div className="min-w-0 flex-1">
                    {subtitle && <p className="font-serif text-sm text-secondary">{subtitle}</p>}
                    <p className="font-gothic text-xs text-tertiary mt-1">
                        {[
                            title.releaseYear,
                            `${title.episodeCount} episode${title.episodeCount > 1 ? 's' : ''}`,
                            speed && `${speed} speech (${title.speechSpeed} morae per minute)`,
                        ].filter(Boolean).join(' · ')}
                    </p>
                    {title.genres.length > 0 && (
                        <p className="font-gothic text-xs text-tertiary mt-1">{title.genres.join(' · ')}</p>
                    )}

                    <div className="mt-4 flex items-end justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <p className="font-gothic text-xs text-secondary mb-1.5">Whole series</p>
                            <ChapterProgressBar counts={seriesCoverage.occurrences} compact />
                            <p className="font-gothic text-xs text-tertiary mt-1.5 tabular-nums">
                                {seriesCoverage.unique.mastered + seriesCoverage.unique.learning} of {seriesCoverage.unique.total} distinct words known
                                {' · '}{watchedCount} of {title.episodeCount} watched
                            </p>
                        </div>
                        <p className="font-serif text-2xl text-primary tabular-nums leading-none shrink-0">
                            {formatPercent(knownRatio(seriesCoverage.occurrences))}
                        </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 font-gothic text-xs">
                            {title.links.anilist && <ExternalTextLink href={title.links.anilist}>AniList</ExternalTextLink>}
                            {title.links.myanimelist && <ExternalTextLink href={title.links.myanimelist}>MyAnimeList</ExternalTextLink>}
                            <ExternalTextLink href={title.source.url}>Jiten</ExternalTextLink>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAllWatched(!allWatched)}
                            className="inline-flex items-center gap-1 rounded border border-divider px-2 py-1 font-gothic text-xs text-secondary hover:border-accent hover:text-accent transition-colors cursor-pointer"
                        >
                            <Check size={12} aria-hidden="true" />
                            {allWatched ? 'Unmark all' : 'Mark all watched'}
                        </button>
                    </div>
                </div>
            </section>

            <div className="rounded-lg border border-divider bg-surface mb-6">
                <button
                    type="button"
                    onClick={() => toggle('series')}
                    aria-expanded={expanded === 'series'}
                    className="w-full flex items-center gap-3 p-3 text-left cursor-pointer"
                >
                    {expanded === 'series'
                        ? <ChevronDown size={16} className="shrink-0 text-tertiary" />
                        : <ChevronRight size={16} className="shrink-0 text-tertiary" />}
                    <span className="font-serif text-sm text-primary flex-1">Words to learn for the whole series</span>
                    <span className="font-gothic text-xs text-tertiary tabular-nums">
                        {seriesCoverage.unique.total - seriesCoverage.unique.mastered - seriesCoverage.unique.learning} unknown
                    </span>
                </button>
                {expanded === 'series' && <WordsToLearn words={seriesWords} countHint="Times used in the series" {...listProps} />}
            </div>

            <VocabularyOnlyNote className="mb-3" />

            <div className="flex flex-col gap-2">
                {title.episodes.map(episode => (
                    <EpisodeRow
                        key={episode.number}
                        episode={episode}
                        mark={watched?.[episodeKey(title.id, episode.number)]}
                        isOpen={expanded === episode.number}
                        onToggleOpen={() => toggle(episode.number)}
                        onToggleWatched={(isWatched, coverage) => actions.setEpisodesWatched(title.id, [{ number: episode.number, coverage }], isWatched)}
                        listProps={listProps}
                    />
                ))}
            </div>

            <JitenCredit url={title.source.url} className="mt-8" />
        </div>
    );
}

function ExternalTextLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
            {children}<ExternalLink size={12} aria-hidden="true" />
        </a>
    );
}

interface EpisodeRowProps {
    episode: MediaEpisode;
    mark: WatchedEpisode | undefined;
    isOpen: boolean;
    onToggleOpen: () => void;
    onToggleWatched: (watched: boolean, coverage: number) => void;
    listProps: WordListProps;
}

function EpisodeRow({ episode, mark, isOpen, onToggleOpen, onToggleWatched, listProps }: EpisodeRowProps) {
    const coverage = computeCoverage(episode.words, listProps.knowledge);
    const ratio = knownRatio(coverage.occurrences);
    const isWatched = mark?.watched === true;
    const speed = speechSpeedLabel(episode.speechSpeed);

    return (
        <div className="rounded-lg border border-divider bg-surface">
            <div className="flex items-center gap-2 p-3">
                <button
                    type="button"
                    onClick={onToggleOpen}
                    aria-expanded={isOpen}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
                >
                    {isOpen
                        ? <ChevronDown size={16} className="shrink-0 text-tertiary" />
                        : <ChevronRight size={16} className="shrink-0 text-tertiary" />}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className={`font-serif text-sm ${isWatched ? 'text-secondary' : 'text-primary'}`}>{episode.title}</span>
                            <span className="font-gothic text-sm text-primary tabular-nums">{formatPercent(ratio)}</span>
                        </div>
                        <div className="mt-1.5">
                            <ChapterProgressBar counts={coverage.occurrences} compact />
                        </div>
                        <p className="font-gothic text-[11px] text-tertiary mt-1 tabular-nums">
                            {coverage.unique.mastered + coverage.unique.learning} of {coverage.unique.total} words known
                            {speed && ` · ${speed} speech`}
                            {isWatched && mark?.coverageAtWatch !== undefined && ` · ${formatPercent(mark.coverageAtWatch)} when watched`}
                        </p>
                    </div>
                </button>
                <button
                    type="button"
                    onClick={() => onToggleWatched(!isWatched, ratio)}
                    aria-pressed={isWatched}
                    title={isWatched ? 'Mark as not watched' : 'Mark as watched'}
                    className={`shrink-0 inline-flex items-center gap-1 rounded border px-2 py-1 font-gothic text-xs transition-colors cursor-pointer ${
                        isWatched
                            ? 'border-accent text-accent'
                            : 'border-divider text-secondary hover:border-accent hover:text-accent'
                    }`}
                >
                    <Check size={12} aria-hidden="true" className={isWatched ? '' : 'opacity-40'} />
                    {isWatched ? 'Watched' : 'Watch'}
                </button>
            </div>

            {isOpen && <WordsToLearn words={episode.words} countHint="Times used in this episode" {...listProps} />}
        </div>
    );
}

/**
 * The words of an episode or series the learner doesn't know yet, in the order
 * they picked (their own learning order by default). A word whose kanji they
 * don't know yet is marked, since their queue would not introduce it now. A
 * word added here joins the learning list exactly as "Add to Learning List" on
 * its own page does, then drops off this list.
 */
function WordsToLearn({ words, countHint, knowledge, sort, onSortChange, orderContext, learner, onLearn }: WordListProps & {
    words: MediaWordCount[];
    countHint: string;
}) {
    const [shown, setShown] = useState(PAGE_SIZE);
    const sorted = useMemo(
        () => sortWords(unknownWords(words, knowledge), sort, orderContext, learner),
        [words, knowledge, sort, orderContext, learner]
    );
    const visible = useMemo(() => sorted.slice(0, shown), [sorted, shown]);
    const [vocabs, setVocabs] = useState<Map<string, Vocabulary>>(new Map());

    useEffect(() => {
        let cancelled = false;
        const missing = visible.filter(([id]) => !vocabs.has(id));
        if (missing.length === 0) return;
        Promise.all(missing.map(([id]) => VocabularyService.loadVocab(id).catch(() => null)))
            .then(loaded => {
                if (cancelled) return;
                setVocabs(prev => {
                    const next = new Map(prev);
                    for (const vocab of loaded) if (vocab) next.set(vocab.id, vocab);
                    return next;
                });
            });
        return () => { cancelled = true; };
    }, [visible, vocabs]);

    if (sorted.length === 0) {
        return (
            <div className="border-t border-divider p-3">
                <p className="font-gothic text-xs text-secondary">You know every word of this vocabulary.</p>
            </div>
        );
    }

    return (
        <div className="border-t border-divider p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="font-gothic text-xs text-secondary">{sorted.length} words you don't know yet</p>
                <label className="font-gothic text-xs text-secondary inline-flex items-center gap-2">
                    Order
                    <select
                        value={sort}
                        onChange={e => onSortChange(e.target.value as WordSort)}
                        className="bg-surface border border-divider rounded px-2 py-1 text-xs text-primary outline-none focus:border-accent cursor-pointer"
                    >
                        {WORD_SORTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </label>
            </div>
            <ul className="flex flex-col">
                {visible.map(([id, count]) => {
                    const vocab = vocabs.get(id);
                    const newKanji = orderContext && learner && !isLearnableNow(id, orderContext, learner);
                    return (
                        <li key={id} className="flex items-center gap-3 py-1.5 border-b border-divider last:border-b-0">
                            <Link to={`/vocab/${id}`} className="min-w-0 flex-1 flex items-baseline gap-2 hover:text-accent">
                                <span className="font-mincho text-base text-primary">{vocab?.writtenForm.kanji ?? '…'}</span>
                                {vocab && <span className="font-mincho text-xs text-secondary">{vocab.reading.primary}</span>}
                                {vocab && (
                                    <span className="font-serif text-xs text-tertiary truncate">
                                        {vocab.senses[0]?.glosses.slice(0, 2).join(', ')}
                                    </span>
                                )}
                            </Link>
                            {newKanji && (
                                <span className="shrink-0 font-gothic text-[10px] text-tertiary border border-divider rounded px-1" title="Uses a kanji you have not learned yet">
                                    new kanji
                                </span>
                            )}
                            <span className="font-gothic text-[11px] text-tertiary tabular-nums shrink-0" title={countHint}>
                                ×{count}
                            </span>
                            <button
                                type="button"
                                disabled={!vocab}
                                onClick={() => vocab && onLearn(vocab)}
                                className="shrink-0 rounded border border-divider px-2 py-0.5 font-gothic text-xs text-secondary hover:border-accent hover:text-accent transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
                            >
                                Learn
                            </button>
                        </li>
                    );
                })}
            </ul>
            {sorted.length > shown && (
                <button
                    type="button"
                    onClick={() => setShown(n => n + MORE_SIZE)}
                    className="mt-2 font-gothic text-xs text-accent hover:underline cursor-pointer"
                >
                    Show {Math.min(MORE_SIZE, sorted.length - shown)} more
                </button>
            )}
        </div>
    );
}
