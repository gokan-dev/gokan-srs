import { createContext, useContext } from 'react';
import type { GoogleProfile } from '../services/sync/googleAccount';
import type { SyncEnvelope } from '../services/sync/types';

export interface GoogleUser extends GoogleProfile {
    access_token: string;
}

/**
 * A completed blocking download: the merged progress, or null when neither Drive nor this device
 * had any. Handed to the app directly rather than through storage, so a local write that fails
 * cannot roll the app back to the last copy that fit. A new object per download, so an effect
 * keyed on it runs once each time.
 */
export interface DriveDownload {
    envelope: SyncEnvelope | null;
}

/** A background sync that pulled in another device's changes, and the merged envelope it uploaded. */
export interface DriveMerge {
    envelope: SyncEnvelope;
}

export interface GoogleDriveContextType {
    login: () => void;
    logout: () => void;
    /** A blocking download, merged with `local` (the app's live progress) or, without it, with the stored copy. */
    downloadProgress: (local?: SyncEnvelope) => Promise<void>;
    /** Schedules a debounced background upload. */
    uploadProgress: (envelope: SyncEnvelope) => void;
    /**
     * Pushes local state to Drive WITHOUT merging, immediately (no debounce).
     * The union merge cannot express a deletion, so a scoped reset needs this or
     * the remote copy restores what was just removed. Explicit, confirmed
     * destructive actions only.
     */
    uploadAuthoritative: (envelope: SyncEnvelope) => Promise<void>;
    isDownloading: boolean;
    isUploading: boolean;
    user: GoogleUser | null;
    isAuthenticated: boolean;
    isInitialLoadComplete: boolean;
    /** The latest blocking download, with what it brought. The app REPLACES its state with it. */
    lastDownload: DriveDownload | null;
    /** The latest background sync that pulled in remote changes. Unlike lastDownload,
     *  consumers MERGE it into their state (not replace it) so an in-flight action isn't lost. */
    lastBackgroundMerge: DriveMerge | null;
    /** True when a background upload failed due to an expired/invalid token.
     *  Surfaces visibly instead of silently stopping sync. */
    syncPaused: boolean;
}

/** Kept apart from GoogleDriveProvider so that file exports only a component (React fast refresh). */
export const GoogleDriveContext = createContext<GoogleDriveContextType | null>(null);

export const useGoogleDrive = (): GoogleDriveContextType => {
    const context = useContext(GoogleDriveContext);
    if (!context) {
        throw new Error('useGoogleDrive must be used within a GoogleDriveProvider');
    }
    return context;
};
