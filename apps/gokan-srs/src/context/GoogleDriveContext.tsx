import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGoogleLogin, googleLogout, type TokenResponse } from '@react-oauth/google';
import { GoogleDriveSync, GoogleAuthError } from '../services/sync/googleDriveSync';
import { fetchGoogleProfile } from '../services/sync/googleAccount';
import { StorageService } from '../services/storage.service';
import { MigrationService } from '../services/migration.service';
import {DEFAULT_SETTINGS} from '../models/user.model';
import type { SyncEnvelope } from '../services/sync/types';
import { GoogleDriveContext, type GoogleUser } from './useGoogleDrive';

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
    const [lastDownloadTime, setLastDownloadTime] = useState<number | null>(null);
    const [lastBackgroundMergeTime, setLastBackgroundMergeTime] = useState<number | null>(null);
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

    // BLOCKING DOWNLOAD: Fetches remote, merges, updates local storage, triggers app reload
    const downloadProgress = async (service: GoogleDriveSync): Promise<void> => {
        setIsDownloading(true);
        await runDownload(service);
    };

    /** The download itself, for a caller that has already marked it as in progress. */
    const runDownload = async (service: GoogleDriveSync): Promise<void> => {
        const MIN_LOADING_TIME = 1000; // slightly longer for "heavy" feel

        try {
            await withMinimumDuration(() => syncDown(service), MIN_LOADING_TIME);
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

    const syncDown = async (service: GoogleDriveSync): Promise<void> => {
        let currentLocal = StorageService.loadProgress();
        const currentSettings = StorageService.loadSettings();

        // We use the sync method because it handles the logic of "Fetch Remote -> Merge"
        // We want to ensure we have the latest from cloud before we start.
        // If we have local data, we merge. If not, we initialize.
        if (currentLocal) {
            // Async migration before syncing to prevent local old IDs from duplicating with remote new IDs
            if (MigrationService.needsMigration(currentLocal)) {
                currentLocal = await MigrationService.migrateAsync(currentLocal);
                StorageService.saveProgress(currentLocal);
            }

            const envelopeToSync = {
                progress: currentLocal,
                settings: currentSettings ?? DEFAULT_SETTINGS
            };

            // Even on download, we might have local changes (offline).
            // sync() will upload them. This is technically a "Sync", but treated as a Download event for the UI.
            await service.sync(envelopeToSync);
        } else {
            const merged = await service.initialize();
            if (merged) {
                StorageService.saveProgress(merged.progress);
                StorageService.saveSettings(merged.settings);
            }
        }

        setSyncPaused(false);
        setLastDownloadTime(Date.now()); // Triggers a full reload in QuizContext
    };

    // Use generic type compatible with browser (number) and Node (object)
    const uploadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Read by the stable uploadProgress callback below - keeping these in refs
    // (instead of closing over state) is what lets uploadProgress keep one identity
    // for the provider's whole lifetime. Every sync toggles isUploading and bumps
    // lastBackgroundMergeTime, so a per-render uploadProgress would re-fire any
    // consumer effect that depends on it, on every sync, forever.
    // Mirrored from an effect, never written during render: a render can be thrown away.
    const syncServiceRef = useRef<GoogleDriveSync | null>(null);
    const isDownloadingRef = useRef(false);
    useEffect(() => { syncServiceRef.current = syncService; }, [syncService]);
    useEffect(() => { isDownloadingRef.current = isDownloading; }, [isDownloading]);

    // BACKGROUND UPLOAD: Pushes local changes to cloud. Does NOT trigger a full app reload -
    // instead bumps lastBackgroundMergeTime so callers can reconcile (merge) any remote
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
                // sync() does: Fetch Remote -> Merge (or fast-forward) -> Upload -> Save Local.
                const outcome = await service.sync(envelope);
                setSyncPaused(false);
                // Only signal a reconcile when the sync actually pulled in remote
                // content this client hadn't written itself. A routine upload of
                // local-only changes must not bump this - otherwise every answer
                // would trigger a reconcile pass and reload the active quiz card.
                if (outcome?.pulledRemoteChanges) {
                    setLastBackgroundMergeTime(Date.now());
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
        // Mount only: this restores the session a stored token represents, once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <GoogleDriveContext.Provider value={{
            login,
            logout,
            downloadProgress: () => syncService ? downloadProgress(syncService) : Promise.resolve(),
            uploadProgress,
            uploadAuthoritative,
            isDownloading,
            isUploading,
            user,
            isAuthenticated: !!user,
            isInitialLoadComplete,
            lastDownloadTime,
            lastBackgroundMergeTime,
            syncPaused,
        }}>
            {children}
        </GoogleDriveContext.Provider>
    );
};
