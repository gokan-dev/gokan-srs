import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpenText, Headphones, Puzzle } from 'lucide-react';
import { useQuiz } from '../../context/useQuiz';
import { DailyActivityCard } from './DailyActivityCard';
import { QuizSettingsMenu } from '../../components/QuizSettingsMenu';
import { VocabQuizSettings } from '../settings/sections/VocabQuizSettings';
import { GrammarQuizSettings } from '../settings/sections/GrammarQuizSettings';
import { ChapterProgressBar } from '../../components/ChapterProgressBar';
import type { HubChapterStatus } from '../../context/quiz/grammarSelectors';
import type { MediaIndexEntry, MediaLibraryWords } from '../../models/media.model';
import { buildWordKnowledge, rankLibrary } from '../../utils/mediaCoverage.utils';
import { MediaService } from '../../services/media.service';
import { MediaCover } from '../listening/listeningShared';

/**
 * The activity hub - the app's landing page after setup. Activities (the main
 * actions a user can take) are presented as cards here; supporting pages
 * (Settings, Stats, Kanji) live in the global header toolbar instead, since
 * they aren't activities themselves. See issue #16.
 */
export const MainScreen: React.FC = () => {
    const {
        state,
        actions,
        nextReviewAt,
        nextSessionPreview,
        grammarNextReviewAt,
        nextGrammarSessionPreview,
        grammarHubChapter,
    } = useQuiz();
    const navigate = useNavigate();
    // The Listening card's covers: the four best fits for this learner under
    // their genre filter, i.e. the top of the library page's own ranking
    // (rankLibrary), from the same cached files. Loaded after the hub has
    // rendered and purely decorative: if either file fails, the card simply
    // shows without covers.
    const [media, setMedia] = useState<{ index: MediaIndexEntry[]; words: MediaLibraryWords } | null>(null);
    useEffect(() => {
        Promise.all([MediaService.loadIndex(), MediaService.loadLibraryWords()])
            .then(([index, words]) => setMedia({ index, words }))
            .catch(() => setMedia(null));
    }, []);
    const bestFits = useMemo(() => {
        if (!media || !state.progress) return [];
        const knowledge = buildWordKnowledge(state.progress.learningQueue, state.settings ?? undefined);
        return rankLibrary(media.index, media.words, knowledge, state.settings?.listeningGenres ?? [], '')
            .slice(0, 4)
            .map(row => row.entry);
    }, [media, state.progress, state.settings]);

    return (
        <div className="w-full max-w-3xl mx-auto py-8">
            <h1 className="text-2xl font-serif text-primary mb-1">Study</h1>
            <p className="text-sm text-secondary mb-8">Choose an activity to begin.</p>

            {state.progress && <DailyActivityCard progress={state.progress} />}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <QuizActivityCard
                    preview={nextSessionPreview}
                    nextReviewAt={nextReviewAt}
                    onClick={() => void navigate('/quiz')}
                    settings={
                        <QuizSettingsMenu title="Vocabulary quiz settings">
                            <VocabQuizSettings
                                settings={state.settings!}
                                onUpdateSettings={actions.saveSettings}
                                dense
                            />
                        </QuizSettingsMenu>
                    }
                />
                <GrammarActivityCard
                    preview={nextGrammarSessionPreview}
                    nextReviewAt={grammarNextReviewAt}
                    hubChapter={grammarHubChapter}
                    onClick={() => void navigate('/grammar')}
                    settings={
                        <QuizSettingsMenu title="Grammar quiz settings">
                            <GrammarQuizSettings />
                        </QuizSettingsMenu>
                    }
                />
                <ActivityCard
                    className="sm:col-span-2"
                    icon={<Headphones size={22} className="text-accent" />}
                    title="Listening"
                    description={renderListeningDescription(watchedEpisodeCount(state.progress?.watchedEpisodes))}
                    onClick={() => void navigate('/listening')}
                    aside={bestFits.length > 0 && (
                        <div className="flex gap-2 shrink-0" aria-hidden="true">
                            {bestFits.map(entry => (
                                <MediaCover key={entry.id} entry={entry} className="w-14 sm:w-16" />
                            ))}
                        </div>
                    )}
                />
            </div>
        </div>
    );
};

function watchedEpisodeCount(watched: Record<string, { watched: boolean }> | undefined): number {
    return watched ? Object.values(watched).filter(entry => entry.watched).length : 0;
}

function renderListeningDescription(watchedCount: number): string {
    const lead = 'Find anime you can follow with the words you know, and track each episode.';
    return watchedCount > 0 ? `${lead} ${watchedCount} episode${watchedCount > 1 ? 's' : ''} watched so far.` : lead;
}

const ActivityCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    description: React.ReactNode;
    onClick: () => void;
    /** The activity's own settings cog, pinned to the card's top right corner. Omitted for an activity with no settings. */
    settings?: React.ReactNode;
    /**
     * An optional secondary link, e.g. "View all chapters", pinned to the card's
     * bottom right corner INSIDE its border. It used to sit below the card, which
     * made that card's grid cell taller than its neighbour's card and left the two
     * borders misaligned. A sibling of the button for the same reason `settings` is.
     */
    footer?: React.ReactNode;
    /** Optional content beside the text from `sm` up (below it on a phone), e.g. the Listening card's covers. */
    aside?: React.ReactNode;
    className?: string;
}> = ({ icon, title, description, onClick, settings, footer, aside, className = '' }) => (
    <div className={`relative h-full ${className}`}>
        <button
            onClick={onClick}
            className={`w-full h-full text-left border border-divider rounded p-6 bg-surface hover:border-accent transition-colors duration-200 flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer ${footer ? 'pb-12' : ''}`}
        >
            <div className="flex flex-col gap-3 min-w-0 flex-1 self-stretch">
                {icon}
                <div>
                    <h2 className="font-serif text-lg text-primary mb-1">{title}</h2>
                    <p className="text-sm text-secondary">{description}</p>
                </div>
            </div>
            {aside}
        </button>

        {/*
          * A sibling of the card button rather than a child of it: a button
          * nested in a button is invalid HTML, and a nested cog's click would
          * bubble up and start the session instead of opening the settings.
          */}
        {settings && (
            <div className="absolute top-5 right-4">
                {settings}
            </div>
        )}

        {footer && <div className="absolute bottom-4 right-6">{footer}</div>}
    </div>
);

/** Minutes-until-next-review, rounded up, matching WaitingScreen's phrasing. */
function formatNextReview(nextReviewAt: Date): string {
    const minutes = Math.max(1, Math.ceil((nextReviewAt.getTime() - Date.now()) / 60000));
    return `Next review in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
}

interface SessionPreview {
    review: number;
    new: number;
    retries: number;
    /** Cards due beyond what the next session can hold. Vocab only: grammar sessions are uncapped, so its preview omits this. */
    remaining?: number;
}

/** Shared by every activity card that previews an upcoming SRS session (vocab, grammar): "{review} review · {new} new", appending retries in the error color, falling back to a caught-up message with an ETA when known. */
function renderSessionPreviewDescription(preview: SessionPreview, nextReviewAt: Date | null): React.ReactNode {
    const { review, new: newCount, retries } = preview;
    const remaining = preview.remaining ?? 0;
    const caughtUp = review === 0 && newCount === 0 && retries === 0;

    if (caughtUp) {
        return nextReviewAt ? formatNextReview(nextReviewAt) : "You're all caught up.";
    }

    const parts: React.ReactNode[] = [`${review} review`, `${newCount} new`];
    if (retries > 0) {
        parts.push(<span key="retries" className="text-error">{retries} retries</span>);
    }
    const counts = parts.reduce<React.ReactNode[]>((acc, part, i) => {
        if (i > 0) acc.push(<span key={`sep-${i}`} className="text-tertiary"> · </span>);
        acc.push(part);
        return acc;
    }, []);

    // Only the vocab card can overflow: its session is capped, grammar's is not.
    // Saying so up front is the difference between "this session is the work" and
    // "this session is a slice of it", which changes whether the user stops after it.
    if (remaining > 0) {
        return (
            <>
                {counts}
                <span className="block text-tertiary">
                    {remaining} more after this session
                </span>
            </>
        );
    }

    return counts;
}

const QuizActivityCard: React.FC<{
    preview: SessionPreview;
    nextReviewAt: Date | null;
    onClick: () => void;
    settings: React.ReactNode;
}> = ({ preview, nextReviewAt, onClick, settings }) => (
    <ActivityCard
        icon={<BookOpenText size={22} className="text-accent" />}
        title="Vocabulary quiz session"
        description={renderSessionPreviewDescription(preview, nextReviewAt)}
        onClick={onClick}
        settings={settings}
    />
);

/** The hub's chapter line: "Current chapter: Chapter {n}: {title}", "Next chapter: ...", or "All {count} chapters introduced". */
function renderHubChapterLine(hubChapter: HubChapterStatus): string {
    switch (hubChapter.status) {
        case 'current':
            return `Current chapter: Chapter ${hubChapter.chapterNumber}: ${hubChapter.chapterTitle}`;
        case 'next':
            return `Next chapter: Chapter ${hubChapter.chapterNumber}: ${hubChapter.chapterTitle}`;
        case 'complete':
            return `All ${hubChapter.totalChapters} chapters introduced`;
    }
}

const GrammarActivityCard: React.FC<{
    preview: SessionPreview;
    nextReviewAt: Date | null;
    /**
     * The hub's grammar chapter status (current/next/complete) plus its
     * progress bar counts - null before it's loaded or when the teaching
     * order failed to load (see describeHubChapter). Shown unconditionally,
     * regardless of preview.new/review/retries (issue #87) - preview.new only
     * counts points queued-but-never-reviewed, which reads 0 for the ordinary
     * state between chapters once every introduced point has been reviewed at
     * least once, so gating on it hid the chapter line and bar exactly when a
     * learner was between chapters rather than mid-session.
     */
    hubChapter: HubChapterStatus | null;
    onClick: () => void;
    settings: React.ReactNode;
}> = ({ preview, nextReviewAt, hubChapter, onClick, settings }) => (
    <ActivityCard
        icon={<Puzzle size={22} className="text-accent" />}
        title="Grammar quiz session"
        description={
            <>
                {renderSessionPreviewDescription(preview, nextReviewAt)}
                {hubChapter && (
                    <span className="block text-tertiary mt-1">{renderHubChapterLine(hubChapter)}</span>
                )}
                {hubChapter && hubChapter.counts.total > 0 && (
                    <span className="block mt-1">
                        <ChapterProgressBar counts={hubChapter.counts} compact />
                    </span>
                )}
            </>
        }
        onClick={onClick}
        settings={settings}
        footer={
            <Link
                to="/grammar/chapters"
                onClick={e => e.stopPropagation()}
                className="text-xs text-accent font-gothic hover:underline"
            >
                View all chapters &rarr;
            </Link>
        }
    />
);
