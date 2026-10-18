import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useGoogleDrive } from "../../../context/useGoogleDrive";
import { StorageService } from "../../../services/storage.service";

/** An action set in a sentence: a button, so it is underlined like the link it reads as. */
const INLINE_ACTION = "cursor-pointer text-accent underline underline-offset-[3px] transition-colors duration-200 hover:text-accent-hover";

/**
 * The Drive restore, inline in the hero's small print ("Used Gokan on another device? Restore
 * from Google Drive"). Each state shows in the same place: the link, the restore under way,
 * and a retry when signed in but nothing came down.
 */
export function GoogleLoginButton({ onSyncComplete }: { onSyncComplete: () => void }) {
    const { login, isDownloading, isAuthenticated, downloadProgress } = useGoogleDrive();
    const [hasAttemptedAutoRestore, setHasAttemptedAutoRestore] = useState(false);

    // Auto-restore effect:
    useEffect(() => {
        let mounted = true;
        const tryRestore = async () => {
            if (isAuthenticated && !isDownloading) {
                // 1. Check if we already have progress (e.g. from login download)
                if (StorageService.loadProgress()) {
                    onSyncComplete();
                    return;
                }

                // 2. If not, and we haven't tried yet (e.g. page reload), try explicit download
                if (!hasAttemptedAutoRestore) {
                    setHasAttemptedAutoRestore(true);
                    await downloadProgress();
                    if (mounted) {
                        onSyncComplete();
                    }
                }
            }
        };
        void tryRestore();
        return () => { mounted = false; };
    }, [isAuthenticated, isDownloading, hasAttemptedAutoRestore, downloadProgress, onSyncComplete]);

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
            <button type="button" onClick={() => void downloadProgress().then(onSyncComplete)} className={INLINE_ACTION}>
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
