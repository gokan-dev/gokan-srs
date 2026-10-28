import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUpdateAvailable } from '../hooks/useUpdateAvailable';
import { TextButton } from './ui/TextButton';

interface UpdateNoticeProps {
    version: string;
    onReload: () => void;
    onDismiss: () => void;
}

/**
 * The notice itself, apart from the poll, so it renders on its own. Neutral, not an alert:
 * nothing is wrong, and the learner picks the moment, since reloading in the middle of a review
 * would drop the answer being typed.
 */
export function UpdateNotice({ version, onReload, onDismiss }: UpdateNoticeProps) {
    return (
        <div className="w-full max-w-5xl mx-auto px-4 md:px-6 pt-3">
            <div
                role="status"
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 pl-3 pr-1 py-1 rounded-md border border-divider bg-surface text-sm font-sans text-primary"
            >
                <p className="min-w-0 flex-1 py-1">
                    A new version is available (v{version}).{' '}
                    <Link to="/whats-new" className="text-accent hover:underline">What's new</Link>
                </p>
                <div className="flex items-center gap-1 shrink-0">
                    <TextButton onClick={onReload} className="px-2 py-1">Reload</TextButton>
                    <button
                        type="button"
                        onClick={onDismiss}
                        aria-label="Dismiss"
                        className="p-2 rounded-md text-secondary hover:text-primary transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Shown once a newer version is live than the one this tab runs. Reload is safe: index.html
 * always revalidates while assets are immutable, so the fresh page names the new chunks, and
 * progress is already saved (StorageService). Not shown during a session (App).
 */
export function UpdateBanner() {
    const { version, dismiss } = useUpdateAvailable();
    if (!version) return null;
    return <UpdateNotice version={version} onReload={() => window.location.reload()} onDismiss={dismiss} />;
}
