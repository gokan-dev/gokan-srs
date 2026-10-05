import { createContext, useContext } from 'react';
import type { GoogleProfile } from '../services/sync/googleAccount';
import type { SyncEnvelope } from '../services/sync/types';

export interface GoogleUser extends GoogleProfile {
    access_token: string;
}

export interface GoogleDriveContextType {
    login: () => void;
    logout: () => void;
    downloadProgress: () => Promise<void>;
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
    lastDownloadTime: number | null;
    /** Bumped after a successful background sync that pulled in remote changes.
     *  Unlike lastDownloadTime, consumers should MERGE against this (not replace
     *  state wholesale) so an in-flight action isn't lost. */
    lastBackgroundMergeTime: number | null;
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
