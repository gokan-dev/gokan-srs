import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpenText, Puzzle } from 'lucide-react';
import { useQuiz } from '../../context/useQuiz';
import { DailyActivityCard } from './DailyActivityCard';
import { QuizSettingsMenu } from '../../components/QuizSettingsMenu';
import { VocabQuizSettings } from '../settings/sections/VocabQuizSettings';
import { GrammarQuizSettings } from '../settings/sections/GrammarQuizSettings';

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
        nextGrammarChapterTitle,
    } = useQuiz();
    const navigate = useNavigate();

    return (
        <div className="w-full max-w-3xl mx-auto py-8">
            <h1 className="text-2xl font-serif text-primary mb-1">Study</h1>
            <p className="text-sm text-secondary mb-8">Choose an activity to begin.</p>

            {state.progress && <DailyActivityCard progress={state.progress} />}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <QuizActivityCard
                    preview={nextSessionPreview}
                    nextReviewAt={nextReviewAt}
                    onClick={() => navigate('/quiz')}
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
                    nextChapterTitle={nextGrammarChapterTitle}
                    onClick={() => navigate('/grammar')}
                    settings={
                        <QuizSettingsMenu title="Grammar quiz settings">
                            <GrammarQuizSettings />
                        </QuizSettingsMenu>
                    }
                />
            </div>
        </div>
    );
};

const ActivityCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    description: React.ReactNode;
    onClick: () => void;
    /** The activity's own settings cog, pinned to the card's top right corner. */
    settings: React.ReactNode;
}> = ({ icon, title, description, onClick, settings }) => (
    <div className="relative h-full">
        <button
            onClick={onClick}
            className="w-full h-full text-left border border-divider rounded p-6 bg-surface hover:border-accent transition-colors duration-200 flex flex-col gap-3 cursor-pointer"
        >
            {icon}
            <div>
                <h2 className="font-serif text-lg text-primary mb-1">{title}</h2>
                <p className="text-sm text-secondary">{description}</p>
            </div>
        </button>

        {/*
          * A sibling of the card button rather than a child of it: a button
          * nested in a button is invalid HTML, and a nested cog's click would
          * bubble up and start the session instead of opening the settings.
          */}
        <div className="absolute top-5 right-4">
            {settings}
        </div>
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

const GrammarActivityCard: React.FC<{
    preview: SessionPreview;
    nextReviewAt: Date | null;
    /** The chapter the next NEW point would begin, named alongside the review/new/retry counts so the curriculum's arrangement is visible before the session starts. Null once nothing is left to introduce. */
    nextChapterTitle: string | null;
    onClick: () => void;
    settings: React.ReactNode;
}> = ({ preview, nextReviewAt, nextChapterTitle, onClick, settings }) => (
    <ActivityCard
        icon={<Puzzle size={22} className="text-accent" />}
        title="Grammar quiz session"
        description={
            <>
                {renderSessionPreviewDescription(preview, nextReviewAt)}
                {nextChapterTitle && preview.new > 0 && (
                    <span className="block text-tertiary">Next chapter: {nextChapterTitle}</span>
                )}
            </>
        }
        onClick={onClick}
        settings={settings}
    />
);
