import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGoogleLogin, googleLogout, type TokenResponse } from '@react-oauth/google';
import { GoogleDriveSync, GoogleAuthError } from '../services/sync/googleDriveSync';
import { fetchGoogleProfile } from '../services/sync/googleAccount';
import { StorageService } from '../services/storage.service';
import {DEFAULT_SETTINGS} from '../models/user.model';
import type { SyncEnvelope } from '../services/sync/types';
import { GoogleDriveContext, type GoogleUser, type DriveDownload, type DriveMerge } from './useGoogleDrive';

/** Keeps a slow-feeling action on screen for at least `minimumMs`, so a fast one does not flash. */
async function withMinimumDuration<T>(task: () => Promise<T>, minimumMs: number): Promise<T> {
    const startedAt = Date.now();
    try {
        return await task();
    } finally {
        const elapsed = Date.now() - startedAt;
        if (elapsed < minimumMs) {
            await new Promise(resolve => setTimeout(resolve, minimumMs - elapsed));
        }
    }
}

export const GoogleDriveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [lastDownload, setLastDownload] = useState<DriveDownload | null>(null);
    const [lastBackgroundMerge, setLastBackgroundMerge] = useState<DriveMerge | null>(null);
    const [syncPaused, setSyncPaused] = useState(false);
    const [user, setUser] = useState<GoogleUser | null>(null);
    const [isDownloading, setIsDownloading] = useState(() => StorageService.loadGoogleDriveToken() !== null);
    const [isUploading, setIsUploading] = useState(false);
    // A token stored by an earlier visit restores the session on load, so the sync
    // service starts from it instead of being set from an effect after the first render.
    const [storedToken] = useState(() => StorageService.loadGoogleDriveToken());
    const [syncService, setSyncService] = useState<GoogleDriveSync | null>(() => storedToken ? new GoogleDriveSync(storedToken) : null);
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(storedToken === null);

    const logout = (triggerReauth: boolean = false) => {
        googleLogout();
        StorageService.clearGoogleDriveToken();
        setUser(null);
        setSyncService(null);
        setSyncPaused(false);

        if (triggerReauth) {
            setTimeout(() => {
                login();
            }, 100);
        }
    };

    // BLOCKING DOWNLOAD: fetches remote, merges, hands the result to the app
    const downloadProgress = async (service: GoogleDriveSync, local?: SyncEnvelope): Promise<void> => {
        setIsDownloading(true);
        await runDownload(service, local);
    };

    /** The download itself, for a caller that has already marked it as in progress. */
    const runDownload = async (service: GoogleDriveSync, local?: SyncEnvelope): Promise<void> => {
        const MIN_LOADING_TIME = 1000; // slightly longer for "heavy" feel

        try {
            await withMinimumDuration(() => syncDown(service, local), MIN_LOADING_TIME);
        } catch (error) {
            console.error('[GoogleDriveContext] Download failed:', error);
            if (error instanceof GoogleAuthError) {
                logout(true);
            }
        } finally {
            setIsDownloading(false);
            setIsInitialLoadComplete(true);
        }
    };

    /** `local` is the app's live state when it has one; storage can trail it when writes fail. */
    const syncDown = async (service: GoogleDriveSync, local?: SyncEnvelope): Promise<void> => {
        const envelope = local
            ? await service.download(local.progress, local.settings)
            : await service.download(await StorageService.loadProgress(), StorageService.loadSettings() ?? DEFAULT_SETTINGS);
        setSyncPaused(false);
        // Hands the merged progress to the app, which replaces its state with it and saves it.
        setLastDownload({ envelope });
    };

    // Use generic type compatible with browser (number) and Node (object)
    const uploadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Read by the stable uploadProgress callback below - keeping these in refs
    // (instead of closing over state) is what lets uploadProgress keep one identity
    // for the provider's whole lifetime. Every sync toggles isUploading and bumps
    // lastBackgroundMerge, so a per-render uploadProgress would re-fire any
    // consumer effect that depends on it, on every sync, forever.
    // Mirrored from an effect, never written during render: a render can be thrown away.
    const syncServiceRef = useRef<GoogleDriveSync | null>(null);
    const isDownloadingRef = useRef(false);
    useEffect(() => { syncServiceRef.current = syncService; }, [syncService]);
    useEffect(() => { isDownloadingRef.current = isDownloading; }, [isDownloading]);

    // BACKGROUND UPLOAD: Pushes local changes to cloud. Does NOT trigger a full app reload -
    // instead publishes lastBackgroundMerge so callers can reconcile (merge) any remote
    // changes into live state without discarding whatever the user is doing right now.
    const uploadProgress = useCallback((envelope: SyncEnvelope) => {
        if (uploadDebounceRef.current) {
            clearTimeout(uploadDebounceRef.current);
        }

        uploadDebounceRef.current = setTimeout(() => void (async () => {
            const service = syncServiceRef.current;
            if (!service || isDownloadingRef.current) return;

            setIsUploading(true);
            try {
                // sync() does: Fetch Remote -> Merge (or fast-forward) -> Upload.
                const outcome = await service.sync(envelope);
                setSyncPaused(false);
                // Only signal a reconcile when the sync actually pulled in remote
                // content this client hadn't written itself. A routine upload of
                // local-only changes must not bump this - otherwise every answer
                // would trigger a reconcile pass and reload the active quiz card.
                if (outcome?.pulledRemoteChanges) {
                    setLastBackgroundMerge({ envelope: outcome.envelope });
                }
            } catch (error) {
                console.error('[GoogleDriveContext] Background upload failed:', error);
                if (error instanceof GoogleAuthError) {
                    // Surface visibly rather than silently stopping - the user should know
                    // their progress isn't being backed up until they reconnect.
                    setSyncPaused(true);
                }
            } finally {
                setIsUploading(false);
                uploadDebounceRef.current = null;
            }
        })(), 2000); // 2 second debounce to gather rapid changes (e.g. typing or quick settings toggles)
    }, []);

    /**
     * Overwrite rather than merge - see the interface doc. Deliberately NOT
     * debounced: the caller is a one-shot user action, and a 2s window is long
     * enough for a routine auto-upload to interleave and merge the deleted
     * entries straight back in.
     */
    const uploadAuthoritative = useCallback(async (envelope: SyncEnvelope) => {
        const service = syncServiceRef.current;
        // THROW rather than return: the caller has already deleted data locally
        // and is relying on this to publish that. Returning quietly would report
        // success while leaving the remote copy intact, and the next load would
        // merge the deleted entries straight back in.
        if (!service) {
            throw new Error('No Drive sync service available - cannot publish the deletion.');
        }
        if (uploadDebounceRef.current) {
            clearTimeout(uploadDebounceRef.current);
            uploadDebounceRef.current = null;
        }
        setIsUploading(true);
        try {
            await service.sync(envelope, { authoritative: true });
            setSyncPaused(false);
        } catch (error) {
            console.error('[GoogleDriveContext] Authoritative upload failed:', error);
            if (error instanceof GoogleAuthError) setSyncPaused(true);
            throw error;
        } finally {
            setIsUploading(false);
        }
    }, []);

    const login = useGoogleLogin({
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        onSuccess: (tokenResponse: TokenResponse) => void (async () => {
            StorageService.saveGoogleDriveToken(tokenResponse.access_token);

            const profile = await fetchGoogleProfile(tokenResponse.access_token);
            setUser({ access_token: tokenResponse.access_token, ...profile });
            setSyncPaused(false);

            const service = new GoogleDriveSync(tokenResponse.access_token);
            setSyncService(service);

            // Auto-download on login
            await downloadProgress(service);
        })(),
        onError: error => {
            console.error('[GoogleDriveContext] Login failed:', error);
            logout();
        }
    });

    // Load persisted token on mount
    useEffect(() => {
        if (!storedToken || !syncService) return; // No user: the load is already complete (guest/setup).

        void fetchGoogleProfile(storedToken).then(profile => {
            setUser({ access_token: storedToken, ...profile });
        });

        // Blocking download on mount. isDownloading already starts true for a stored token.
        void runDownload(syncService);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only: restores the session a stored token represents, once
    }, []);

    return (
        <GoogleDriveContext.Provider value={{
            login,
            logout,
            downloadProgress: (local?: SyncEnvelope) => syncService ? downloadProgress(syncService, local) : Promise.resolve(),
            uploadProgress,
            uploadAuthoritative,
            isDownloading,
            isUploading,
            user,
            isAuthenticated: !!user,
            isInitialLoadComplete,
            lastDownload,
            lastBackgroundMerge,
            syncPaused,
        }}>
            {children}
        </GoogleDriveContext.Provider>
    );
};
