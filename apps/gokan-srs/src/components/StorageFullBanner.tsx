import { AlertTriangle } from 'lucide-react';
import { useGoogleDrive } from '../context/useGoogleDrive';
import { useProgressSaveFailed } from '../hooks/useProgressSaveFailed';

/**
 * Shown while progress cannot be saved in this browser. The app keeps working on the
 * in-memory copy (and Drive sync keeps uploading it), but closing the tab without sync
 * would lose what was studied since, so the learner has to know. Disappears on the next
 * successful save.
 */
export function StorageFullBanner() {
    const saveFailed = useProgressSaveFailed();
    const { isAuthenticated } = useGoogleDrive();
    if (!saveFailed) return null;

    return (
        <div className="w-full px-4 pb-2 md:px-8 md:pb-4">
            <div
                role="alert"
                className="flex w-full items-start gap-2 px-3 py-2 rounded border border-error/40 bg-error/5 text-sm font-gothic text-primary md:max-w-5xl md:mx-auto"
            >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-error" aria-hidden="true" />
                <p className="min-w-0">
                    Your progress could not be saved in this browser: its storage is full.{' '}
                    {isAuthenticated
                        ? 'It is still being synced to Google Drive.'
                        : 'Sign in to Google Drive in Settings so it is not lost when you close this tab.'}
                </p>
            </div>
        </div>
    );
}
