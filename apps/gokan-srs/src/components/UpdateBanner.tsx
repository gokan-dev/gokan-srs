import { X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useQuiz } from '../context/useQuiz';
import { hasSessionInProgress } from '../context/quiz/quizSelectors';
import { useUpdateAvailable } from '../hooks/useUpdateAvailable';
import { WHATS_NEW } from '../utils/navigation.utils';
import { isWhatsNewPath } from '../utils/seo.utils';
import { TextButton } from './ui/TextButton';

interface UpdateNoticeProps {
    version: string;
    /** False on What's new itself, where the link would lead to the page the learner is on. */
    linkWhatsNew: boolean;
    onReload: () => void;
    onDismiss: () => void;
}

/**
 * The notice itself, apart from the poll, so it renders on its own. Neutral, not an alert:
 * nothing is wrong, and the learner picks the moment. Its controls are 44px tall, like
 * ResumeSessionBar in the same slot.
 */
export function UpdateNotice({ version, linkWhatsNew, onReload, onDismiss }: UpdateNoticeProps) {
    return (
        <div className="w-full max-w-5xl mx-auto px-4 md:px-6 pt-3">
            <div
                role="status"
                data-update-banner
                className="flex w-full flex-wrap items-center gap-x-4 pl-3 pr-1 rounded-md border border-divider bg-surface text-sm font-sans text-primary"
            >
                <p className="min-w-0 flex-1 py-2">
                    A new version is available (version {version}).
                    {linkWhatsNew && (
                        <>
                            {' '}
                            <Link to={WHATS_NEW.to} className="text-accent hover:underline">{WHATS_NEW.label}</Link>
                        </>
                    )}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                    <TextButton onClick={onReload} className="min-h-11 px-2">Reload</TextButton>
                    <button
                        type="button"
                        onClick={onDismiss}
                        aria-label="Dismiss"
                        className="flex items-center justify-center min-h-11 min-w-11 rounded-md text-secondary hover:text-primary transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Shown once a newer version is live than the one this tab runs. Reload keeps saved progress
 * (StorageService), and index.html always revalidates while assets are immutable, so the fresh
 * page names the new chunks. A study session is not saved: its task set lives only in the quiz
 * state, so the notice waits while one is in progress, paused on a consult page included
 * (`hasSessionInProgress`).
 */
export function UpdateBanner() {
    const { state } = useQuiz();
    const { pathname } = useLocation();
    const { version, dismiss } = useUpdateAvailable();
    if (!version || hasSessionInProgress(state)) return null;
    return (
        <UpdateNotice
            version={version}
            linkWhatsNew={!isWhatsNewPath(pathname)}
            onReload={() => window.location.reload()}
            onDismiss={dismiss}
        />
    );
}
