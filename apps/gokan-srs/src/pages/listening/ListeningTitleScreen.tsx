import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import type { MediaEpisode, MediaTitle, WatchedEpisode } from "../../models/media.model";
import type { Vocabulary } from "../../models/vocabulary.model";
import { MediaService } from "../../services/media.service";
import { VocabularyService } from "../../services/vocabulary.service";
import { useQuiz } from "../../context/useQuiz";
import { PageHeader } from "../../components/PageHeader";
import { ChapterProgressBar } from "../../components/ChapterProgressBar";
import {
    aggregateEpisodeWords,
    buildWordKnowledge,
    computeCoverage,
    countWatchedEpisodes,
    episodeKey,
    formatPercent,
    knownRatio,
    speechSpeedLabel,
    wordsToLearn,
} from "../../utils/mediaCoverage.utils";
import type { WordKnowledge } from "../../utils/mediaCoverage.utils";
import { JitenCredit, VocabularyOnlyNote } from "./listeningShared";

/** How many unknown words an episode suggests learning before watching it. */
const WORDS_TO_LEARN = 10;

/**
 * Route /listening/:mediaId: one anime, with how much of the whole series and
 * of each episode the learner knows, a watched mark per episode, and for each
 * episode the most frequent words they don't know yet, which can be added to
 * the learning list from here.
 */
export function ListeningTitleScreen() {
    const { mediaId = '' } = useParams<{ mediaId: string }>();
    const navigate = useNavigate();
    const { state, actions } = useQuiz();
    const [title, setTitle] = useState<MediaTitle | null>(null);
    const [failed, setFailed] = useState(false);
    const [expanded, setExpanded] = useState<number | null>(null);

    useEffect(() => {
        MediaService.loadTitle(mediaId).then(setTitle).catch(() => setFailed(true));
    }, [mediaId]);

    const knowledge = useMemo(
        () => buildWordKnowledge(state.progress?.learningQueue ?? [], state.settings ?? undefined),
        [state.progress?.learningQueue, state.settings]
    );
    const watched = state.progress?.watchedEpisodes;
    const seriesCoverage = useMemo(
        () => (title ? computeCoverage(aggregateEpisodeWords(title.episodes), knowledge) : null),
        [title, knowledge]
    );

    if (failed) {
        return (
            <div className="w-full max-w-3xl mx-auto px-4 py-6">
                <PageHeader title="Listening" onBack={() => navigate('/listening')} className="mb-4" />
                <p className="font-gothic text-sm text-secondary">Could not load this title.</p>
            </div>
        );
    }

    if (!title || !seriesCoverage) {
        return (
            <div className="w-full max-w-3xl mx-auto px-4 py-6">
                <p className="font-gothic text-sm text-secondary">Loading...</p>
            </div>
        );
    }

    const speed = speechSpeedLabel(title.speechSpeed);
    const watchedCount = countWatchedEpisodes(watched, title.id);
    const subtitle = [title.title.romaji, title.title.english].filter(Boolean).join(' · ');

    return (
        <div className="w-full max-w-3xl mx-auto px-4 py-6">
            <PageHeader
                title={<span className="font-mincho">{title.title.original}</span>}
                onBack={() => navigate('/listening')}
                className="mb-4"
            />

            <section className="rounded-lg border border-divider bg-surface p-4 mb-6">
                {subtitle && <p className="font-serif text-sm text-secondary">{subtitle}</p>}
                <p className="font-gothic text-xs text-tertiary mt-1">
                    {[
                        title.releaseYear,
                        `${title.episodeCount} episodes`,
                        speed && `${speed} speech (${title.speechSpeed} morae per minute)`,
                    ].filter(Boolean).join(' · ')}
                </p>

                <div className="mt-4 flex items-end justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <p className="font-gothic text-xs text-secondary mb-1.5">Whole series</p>
                        <ChapterProgressBar counts={seriesCoverage.occurrences} compact />
                        <p className="font-gothic text-xs text-tertiary mt-1.5 tabular-nums">
                            {seriesCoverage.unique.mastered + seriesCoverage.unique.learning} of {seriesCoverage.unique.total} distinct words known
                            {' · '}{watchedCount} of {title.episodeCount} episodes watched
                        </p>
                    </div>
                    <p className="font-serif text-2xl text-primary tabular-nums leading-none shrink-0">
                        {formatPercent(knownRatio(seriesCoverage.occurrences))}
                    </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-gothic text-xs">
                    {title.links.anilist && <ExternalTextLink href={title.links.anilist}>AniList</ExternalTextLink>}
                    {title.links.myanimelist && <ExternalTextLink href={title.links.myanimelist}>MyAnimeList</ExternalTextLink>}
                    <ExternalTextLink href={title.source.url}>Jiten</ExternalTextLink>
                </div>
            </section>

            <VocabularyOnlyNote className="mb-3" />

            <div className="flex flex-col gap-2">
                {title.episodes.map(episode => (
                    <EpisodeRow
                        key={episode.number}
                        episode={episode}
                        knowledge={knowledge}
                        mark={watched?.[episodeKey(title.id, episode.number)]}
                        isOpen={expanded === episode.number}
                        onToggleOpen={() => setExpanded(prev => (prev === episode.number ? null : episode.number))}
                        onToggleWatched={(isWatched, coverage) => actions.setEpisodeWatched(title.id, episode.number, isWatched, coverage)}
                        onLearn={vocab => actions.saveVocabIntroChoice(vocab, 'learn')}
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
    knowledge: Map<string, WordKnowledge>;
    mark: WatchedEpisode | undefined;
    isOpen: boolean;
    onToggleOpen: () => void;
    onToggleWatched: (watched: boolean, coverage: number) => void;
    onLearn: (vocab: Vocabulary) => void;
}

function EpisodeRow({ episode, knowledge, mark, isOpen, onToggleOpen, onToggleWatched, onLearn }: EpisodeRowProps) {
    const coverage = computeCoverage(episode.words, knowledge);
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

            {isOpen && <WordsToLearn episode={episode} knowledge={knowledge} onLearn={onLearn} />}
        </div>
    );
}

/**
 * The episode's most frequent words the learner doesn't know yet. Learning them
 * raises the episode's coverage the fastest. A word added here joins the
 * learning list exactly as "Add to Learning List" on its own page does, then
 * drops off this list and the next one takes its place.
 */
function WordsToLearn({ episode, knowledge, onLearn }: {
    episode: MediaEpisode;
    knowledge: Map<string, WordKnowledge>;
    onLearn: (vocab: Vocabulary) => void;
}) {
    const candidates = useMemo(() => wordsToLearn(episode.words, knowledge, WORDS_TO_LEARN), [episode, knowledge]);
    const [vocabs, setVocabs] = useState<Map<string, Vocabulary>>(new Map());

    useEffect(() => {
        let cancelled = false;
        const missing = candidates.filter(([id]) => !vocabs.has(id));
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
    }, [candidates, vocabs]);

    if (candidates.length === 0) {
        return (
            <div className="border-t border-divider p-3">
                <p className="font-gothic text-xs text-secondary">You know every word of this episode's vocabulary.</p>
            </div>
        );
    }

    return (
        <div className="border-t border-divider p-3">
            <p className="font-gothic text-xs text-secondary mb-2">
                Most frequent words you don't know yet. Learning them first raises this episode's coverage fastest.
            </p>
            <ul className="flex flex-col">
                {candidates.map(([id, count]) => {
                    const vocab = vocabs.get(id);
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
                            <span className="font-gothic text-[11px] text-tertiary tabular-nums shrink-0" title="Times used in this episode">
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
        </div>
    );
}
