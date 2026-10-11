import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useGoogleDrive } from '../../context/useGoogleDrive';

/** Drive sync state in the header: nothing when signed out, a reconnect button when paused. */
export function SyncStatusIndicator() {
    const { isUploading, isDownloading, isAuthenticated, syncPaused, login } = useGoogleDrive();

    if (!isAuthenticated) return null;

    if (syncPaused) {
        return (
            <button
                type="button"
                onClick={() => login()}
                title="Sync paused: your Google session expired. Click to reconnect."
                aria-label="Sync paused: reconnect Google Drive"
                className="text-error hover:text-primary transition-colors cursor-pointer"
            >
                <CloudOff size={18} />
            </button>
        );
    }

    if (isUploading || isDownloading) {
        return <RefreshCw size={18} className="animate-spin text-tertiary" aria-label="Syncing" />;
    }

    return (
        <span className="text-tertiary" title="Synced with Google Drive" aria-label="Synced with Google Drive">
            <Cloud size={18} />
        </span>
    );
}
