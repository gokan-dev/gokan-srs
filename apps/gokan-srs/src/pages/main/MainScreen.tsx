import React, { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpenText, Puzzle } from 'lucide-react';
import { useQuiz } from '../../context/useQuiz';
import { DailyActivityCard } from './DailyActivityCard';
import { QuizSettingsMenu } from '../../components/QuizSettingsMenu';
import { VocabQuizSettings } from '../settings/sections/VocabQuizSettings';
import { GrammarQuizSettings } from '../settings/sections/GrammarQuizSettings';
import { ChapterProgressBar } from '../../components/ChapterProgressBar';
import type { HubChapterStatus } from '../../context/quiz/grammarSelectors';
import { buildWordKnowledge, formatPercent, knownRatio, rankLibrary } from '../../utils/mediaCoverage.utils';
import { MediaService } from '../../services/media.service';
import { MediaCover } from '../listening/listeningShared';
import { Page } from '../../components/Page';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useNow } from '../../hooks/useNow';
import { formatDurationUntil } from '../../utils/time.utils';
import { hubPrimaryActivity, hubSummary, type ActivityWork } from '../../utils/hub.utils';

/**
 * The Study hub, the landing page after setup: what is due, the two study
 * activities with one primary button between them (the first with work,
 * `hubPrimaryActivity`), Listening, and the week's reviews.
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
    // The Listening row: the best fits for this learner under their genre filter,
    // the top of the library page's own ranking (rankLibrary), from the same cached
    // files. Loaded after the hub renders; if either file fails, the row shows
    // without a best match.
    const media = useAsyncData('listening-library', async () => {
        const [index, words] = await Promise.all([MediaService.loadIndex(), MediaService.loadLibraryWords()]);
        return { index, words };
    }).data;
    const now = useNow();
    const ranked = useMemo(() => {
        if (!media || !state.progress) return [];
        const knowledge = buildWordKnowledge(state.progress.learningQueue, state.settings ?? undefined);
        return rankLibrary(media.index, media.words, knowledge, state.settings?.listeningGenres ?? [], '').slice(0, 3);
    }, [media, state.progress, state.settings]);

    const primary = hubPrimaryActivity(nextSessionPreview, nextGrammarSessionPreview);
    const reviewsDue = nextSessionPreview.review + nextSessionPreview.retries
        + nextGrammarSessionPreview.review + nextGrammarSessionPreview.retries;

    return (
        <Page width="narrow">
            <PageHeader
                title="Study"
                subtitle={hubSummary(reviewsDue, [nextReviewAt, grammarNextReviewAt], now)}
                className="mb-8"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ActivityCard
                    icon={<BookOpenText size={18} aria-hidden="true" />}
                    title="Vocabulary"
                    work={nextSessionPreview}
                    nextReviewAt={nextReviewAt}
                    now={now}
                    primary={primary === 'vocab'}
                    onStart={() => void navigate('/quiz')}
                    settings={
                        <QuizSettingsMenu title="Vocabulary quiz settings">
                            <VocabQuizSettings
                                settings={state.settings!}
                                onUpdateSettings={actions.saveSettings}
                                dense
                            />
                        </QuizSettingsMenu>
                    }
                    details={(nextSessionPreview.remaining ?? 0) > 0 && (
                        <p className="type-meta">+{nextSessionPreview.remaining} more after this session</p>
                    )}
                />
                <ActivityCard
                    icon={<Puzzle size={18} aria-hidden="true" />}
                    title="Grammar"
                    work={nextGrammarSessionPreview}
                    nextReviewAt={grammarNextReviewAt}
                    now={now}
                    primary={primary === 'grammar'}
                    onStart={() => void navigate('/grammar')}
                    settings={
                        <QuizSettingsMenu title="Grammar quiz settings">
                            <GrammarQuizSettings />
                        </QuizSettingsMenu>
                    }
                    details={grammarHubChapter && <GrammarChapterLine hubChapter={grammarHubChapter} />}
                />
            </div>

            <section className="mt-4 rounded-md border border-divider bg-surface p-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <h2 className="type-subsection">Listening</h2>
                    {ranked[0] ? (
                        <p className="type-support mt-1">
                            Best match: <span className="font-mincho text-primary">{ranked[0].entry.title.original}</span>
                            {' · '}{formatPercent(knownRatio(ranked[0].coverage.occurrences))} of its vocabulary known
                        </p>
                    ) : (
                        <p className="type-support mt-1">Find anime you can follow with the words you know.</p>
                    )}
                    <Link to="/listening" className="inline-block mt-2 font-sans text-sm text-accent hover:underline">
                        Browse library
                    </Link>
                </div>
                {ranked.length > 0 && (
                    <div className="flex gap-2 shrink-0" aria-hidden="true">
                        {ranked.map(row => <MediaCover key={row.entry.id} entry={row.entry} size="hub" />)}
                    </div>
                )}
            </section>

            {state.progress && <DailyActivityCard progress={state.progress} />}
        </Page>
    );
};

interface SessionPreview extends ActivityWork {
    /** Cards due beyond what the next session can hold. Vocab only: grammar sessions are uncapped. */
    remaining?: number;
}

/**
 * One study activity: its name and settings, the reviews due as the big figure,
 * what else is waiting, and an explicit button pinned to the bottom. Caught up,
 * the button reads "Open": the session's waiting screen offers to learn more.
 */
function ActivityCard({ icon, title, work, nextReviewAt, now, primary, onStart, settings, details }: {
    icon: React.ReactNode;
    title: string;
    work: SessionPreview;
    nextReviewAt: Date | null;
    now: number;
    primary: boolean;
    onStart: () => void;
    settings: React.ReactNode;
    details?: React.ReactNode;
}) {
    const due = work.review + work.retries;
    const caughtUp = due === 0 && work.new === 0;

    return (
        <section className="rounded-md border border-divider bg-surface p-5 flex flex-col">
            <div className="flex items-center gap-2">
                <span className="text-secondary">{icon}</span>
                <h2 className="type-subsection flex-1">{title}</h2>
                {settings}
            </div>

            <div className="mt-4 flex-1 space-y-1">
                {caughtUp ? (
                    <>
                        <p className="font-sans text-xl text-primary">All caught up</p>
                        {nextReviewAt && <p className="type-meta">Next review in {formatDurationUntil(nextReviewAt, now)}</p>}
                    </>
                ) : (
                    <>
                        <p className="flex items-baseline gap-2">
                            <span className="font-sans text-4xl text-primary tabular-nums">{due.toLocaleString('en-US')}</span>
                            <span className="type-support">review{due === 1 ? '' : 's'} due</span>
                        </p>
                        {work.new > 0 && <p className="type-support">{work.new} new</p>}
                        {work.retries > 0 && <p className="type-support">{work.retries} to retry</p>}
                    </>
                )}
                {details}
            </div>

            <Button variant={primary ? 'primary' : 'secondary'} onClick={onStart} className="mt-5 w-full">
                {caughtUp ? 'Open' : 'Start review'}
            </Button>
        </section>
    );
}

/** "Chapter 14 · Plain verb forms: past and negative", its progress bar and a link to the curriculum. */
function GrammarChapterLine({ hubChapter }: { hubChapter: HubChapterStatus }) {
    return (
        <div className="pt-2 space-y-1.5">
            <p className="type-meta">
                {hubChapter.status === 'complete'
                    ? `All ${hubChapter.totalChapters} chapters introduced`
                    : `Chapter ${hubChapter.chapterNumber} · ${hubChapter.chapterTitle}`}
            </p>
            {hubChapter.counts.total > 0 && <ChapterProgressBar counts={hubChapter.counts} compact />}
            <Link to="/grammar/chapters" className="inline-block font-sans text-sm text-accent hover:underline">
                View curriculum
            </Link>
        </div>
    );
}
