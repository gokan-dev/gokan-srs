import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useGoogleDrive } from "../../../context/useGoogleDrive";

/** An action set in a sentence: a button, so it is underlined like the link it reads as. */
const INLINE_ACTION = "cursor-pointer text-accent underline underline-offset-[3px] transition-colors duration-200 hover:text-accent-hover";

/**
 * The Drive restore, inline in the hero's small print ("Used Gokan on another device? Restore
 * from Google Drive"). Each state shows in the same place: the link, the restore under way,
 * and a retry when signed in but nothing came down. A restore hands its progress to the app,
 * which leaves onboarding on its own.
 */
export function GoogleLoginButton() {
    const { login, isDownloading, isAuthenticated, downloadProgress, lastDownload } = useGoogleDrive();
    const attemptedAutoRestore = useRef(false);

    // Signed in (a page reload with a stored token) but nothing restored yet: try one download.
    useEffect(() => {
        if (!isAuthenticated || isDownloading || lastDownload?.envelope || attemptedAutoRestore.current) return;
        attemptedAutoRestore.current = true;
        void downloadProgress();
    }, [isAuthenticated, isDownloading, lastDownload, downloadProgress]);

    if (isDownloading) {
        return (
            <span className="inline-flex items-center gap-1.5 text-feedback-correct">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Restoring your progress...
            </span>
        );
    }

    if (isAuthenticated) {
        // Signed in but still here (the auto-restore finished or failed): a manual retry.
        return (
            <button type="button" onClick={() => void downloadProgress()} className={INLINE_ACTION}>
                Retry restore
            </button>
        );
    }

    return (
        <button type="button" onClick={() => login()} className={INLINE_ACTION}>
            Restore from Google Drive
        </button>
    );
}
