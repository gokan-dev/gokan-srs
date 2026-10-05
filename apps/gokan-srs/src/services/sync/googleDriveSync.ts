import { CONSTANTS } from '../../commons/constants';
import { DEFAULT_SETTINGS, type UserSettings } from '../../models/user.model';
import { MigrationService } from '../migration.service';
import { BackupService } from '../backup.service';
import { StorageService } from '../storage.service';
import { toPlainProgressJSON, migrateAndHydrateProgress, progressUploadSignature, stableStringify } from '../progressSerialization';
import type { StoredProgress } from '../progressHydration';
import { DriveClient } from './driveClient';
import { mergeProgress, mergeSettings } from './mergeProgress';
import type { ProgressWithMetadata, SyncEnvelope } from './types';
import { GoogleAuthError } from './types';

export { GoogleAuthError };
export type { SyncEnvelope, ProgressWithMetadata } from './types';

const DRIVE_FILE_NAME = CONSTANTS.storage.googleDriveFileName;
const DRIVE_FOLDER_NAME = CONSTANTS.storage.googleDriveFolderName;
const MAX_SYNC_RETRIES = 3;

/** The Drive file's JSON: the {progress, settings} envelope, or a bare progress object from the oldest builds. */
type StoredEnvelope = StoredProgress & { progress?: StoredProgress; settings?: Partial<UserSettings> };

/** What this client writes to the Drive file. */
interface SerializedEnvelope {
    progress: StoredProgress;
    settings: UserSettings;
}

export interface SyncOutcome {
    envelope: SyncEnvelope;
    /** True when this sync incorporated remote content this client had not itself
     *  written - i.e. the caller's live state may now be stale and should reconcile.
     *  False for routine fast-forward uploads of local-only changes. */
    pulledRemoteChanges: boolean;
}

function combineTwoEnvelopes(a: SyncEnvelope, b: SyncEnvelope): SyncEnvelope {
    const localVersion = a.progress._sync?.version ?? 0;
    const remoteVersion = b.progress._sync?.version ?? 0;
    return {
        progress: mergeProgress(a.progress, b.progress, a.settings)!,
        settings: mergeSettings(a.settings, b.settings, localVersion, remoteVersion),
    };
}

/**
 * Orchestrates a lossless, concurrency-aware sync cycle against Google Drive:
 * - Optimistic concurrency: the file's modifiedTime is re-checked immediately
 *   before writing; if it changed since we based our merge on it, we re-fetch
 *   and re-merge rather than blindly overwriting another device's write.
 * - Duplicate-file reconciliation: if two devices both created the progress
 *   file concurrently, all copies are merged together and only one canonical
 *   file is kept (the rest are trashed).
 * - A write-once remote backup of the live file is captured before the first
 *   write this instance ever performs, as a safety net for the migration wave.
 */
export class GoogleDriveSync {
    private readonly driveClient: DriveClient;
    private folderId: string | null = null;
    private latestLocalVersion: number = 0;
    private remoteBackupChecked = false;
    // Content signatures of the envelope this instance last wrote to Drive. When
    // the remote file still matches them on the next sync, local state is a strict
    // descendant of remote and the merge can be skipped (fast-forward).
    private lastWrittenProgressSignature: string | null = null;
    private lastWrittenSettingsSignature: string | null = null;

    constructor(accessToken: string) {
        this.driveClient = new DriveClient(accessToken);
    }

    async initialize(localEnvelope?: SyncEnvelope): Promise<SyncEnvelope | null> {
        await this.ensureFolder();
        const resolved = await this.resolveCanonicalFile();
        let remoteProgress = resolved.envelope?.progress ?? null;
        const remoteSettings = resolved.envelope?.settings ?? null;

        if (remoteProgress && MigrationService.needsMigration(remoteProgress)) {
            remoteProgress = await MigrationService.migrateAsync(remoteProgress);
        }

        if (!localEnvelope) {
            const localProgress = this.getLocalProgress();
            const localSettings = this.getLocalSettings();
            if (localProgress && localSettings) {
                localEnvelope = { progress: localProgress, settings: localSettings };
            }
        }

        const localVersion = localEnvelope?.progress._sync?.version ?? 0;
        const remoteVersion = remoteProgress?._sync?.version ?? 0;

        let mergedSettings = remoteSettings;
        if (localEnvelope) {
            mergedSettings = mergeSettings(localEnvelope.settings, remoteSettings, localVersion, remoteVersion);
        } else if (!mergedSettings) {
            mergedSettings = this.getLocalSettings() ?? DEFAULT_SETTINGS;
        }

        const mergedProgress = mergeProgress(localEnvelope?.progress ?? null, remoteProgress, mergedSettings ?? undefined);

        if (mergedProgress?._sync?.version) {
            this.latestLocalVersion = mergedProgress._sync.version;
        }

        if (!mergedProgress) return null;
        return { progress: mergedProgress, settings: mergedSettings };
    }

    /**
     * Full read-merge-write cycle, protected by optimistic concurrency: the
     * remote file's modifiedTime is captured when we read it and re-verified
     * immediately before writing. If another device wrote in between, we
     * re-fetch and re-merge instead of clobbering that write.
     */
    /**
     * Pushes local state to Drive, merging with whatever is there.
     *
     * `authoritative: true` skips the merge and writes local as-is. Needed
     * because the merge cannot represent a DELETION: mergeGrammarQueues and
     * mergeLearningQueues are pure unions by id, so anything removed locally is
     * restored from the remote copy on the very next upload. A scoped reset
     * (settings -> Reset grammar progress) has to be able to say "this is the
     * truth now", or it silently undoes itself.
     *
     * Only ever appropriate for an explicit, user-confirmed destructive action:
     * it discards whatever another device wrote since this client last read.
     * `ensureRemoteBackupOnce` still snapshots the live remote first.
     */
    async sync(localEnvelope: SyncEnvelope, options: { authoritative?: boolean } = {}): Promise<SyncOutcome | null> {
        await this.ensureFolder();
        await this.ensureRemoteBackupOnce();

        const incomingVersion = localEnvelope.progress._sync?.version ?? 0;
        let effectiveLocalEnvelope = localEnvelope;
        if (incomingVersion < this.latestLocalVersion) {
            // Stale metadata detected (React state trailing a background write this
            // same instance already made) - patch the version so we don't regress it.
            effectiveLocalEnvelope = {
                ...localEnvelope,
                progress: {
                    ...localEnvelope.progress,
                    _sync: { lastModified: Date.now(), version: this.latestLocalVersion },
                },
            };
        }

        for (let attempt = 0; attempt < MAX_SYNC_RETRIES; attempt++) {
            const resolved = await this.resolveCanonicalFile();
            let remoteProgress = resolved.envelope?.progress ?? null;
            const remoteSettings = resolved.envelope?.settings ?? null;

            if (remoteProgress && MigrationService.needsMigration(remoteProgress)) {
                remoteProgress = await MigrationService.migrateAsync(remoteProgress);
            }

            const localVersion = effectiveLocalEnvelope.progress._sync?.version ?? 0;
            const remoteVersion = remoteProgress?._sync?.version ?? 0;

            // FAST-FORWARD: if the remote file's content is exactly what this client
            // last wrote, local state is a strict descendant of it - there is nothing
            // to merge; just upload local as-is (with a version bump). Skipping the
            // merge here matters beyond performance: a self-merge is NOT a no-op
            // (mergeEntry's max() safety net resurrects a pre-answer memoryStrength
            // after a failed review, and needsRetry gets re-canonicalized), so it
            // would make every routine upload look like a remote change and force
            // the UI to reconcile - and reload the quiz card - after every answer.
            const remoteIsOwnLastWrite =
                options.authoritative ||
                remoteProgress !== null &&
                this.lastWrittenProgressSignature !== null &&
                progressUploadSignature(remoteProgress) === this.lastWrittenProgressSignature &&
                stableStringify(remoteSettings) === this.lastWrittenSettingsSignature;

            // Diagnostic: after this instance's first write, remote should normally
            // still be that write (single-device usage). A miss here means either a
            // genuine other-device write (fine, rare) or a broken serialize->parse
            // round trip (fast-forward silently degrading to merge-every-upload). If
            // this line appears after every answer, suspect the round trip.
            if (!options.authoritative && !remoteIsOwnLastWrite && remoteProgress !== null && this.lastWrittenProgressSignature !== null) {
                console.warn('[GoogleDriveSync] Remote diverged from this client\'s last write - performing full merge.');
            }

            let mergedEnvelope: SyncEnvelope;
            if (remoteIsOwnLastWrite) {
                mergedEnvelope = {
                    progress: {
                        ...effectiveLocalEnvelope.progress,
                        _sync: { lastModified: Date.now(), version: Math.max(localVersion, remoteVersion) + 1 },
                    },
                    settings: effectiveLocalEnvelope.settings,
                };
            } else {
                const mergedSettings = mergeSettings(effectiveLocalEnvelope.settings, remoteSettings, localVersion, remoteVersion);
                const mergedProgress = mergeProgress(effectiveLocalEnvelope.progress, remoteProgress, mergedSettings);
                if (!mergedProgress) return null;
                mergedEnvelope = { progress: mergedProgress, settings: mergedSettings };
            }

            const pulledRemoteChanges = !options.authoritative && remoteProgress !== null && !remoteIsOwnLastWrite;

            if (!resolved.fileId) {
                // No remote file exists yet - safe to create unconditionally.
                await this.driveClient.uploadNewFile(this.folderId!, DRIVE_FILE_NAME, this.serializeEnvelope(mergedEnvelope));
                this.finishSync(mergedEnvelope);
                return { envelope: mergedEnvelope, pulledRemoteChanges };
            }

            // Optimistic concurrency check: has the file changed since we just read it?
            const currentMeta = await this.driveClient.getFileMetadata(resolved.fileId);
            if (currentMeta.modifiedTime !== resolved.modifiedTime) {
                continue; // Someone else wrote in between - retry with fresh data.
            }

            await this.driveClient.updateFile(resolved.fileId, this.serializeEnvelope(mergedEnvelope));
            this.finishSync(mergedEnvelope);
            return { envelope: mergedEnvelope, pulledRemoteChanges };
        }

        console.error('[GoogleDriveSync] Sync CAS retries exhausted under high write contention; the next auto-upload will retry.');
        return null;
    }

    private finishSync(envelope: SyncEnvelope): void {
        this.saveLocalEnvelope(envelope);
        this.lastWrittenProgressSignature = progressUploadSignature(envelope.progress);
        this.lastWrittenSettingsSignature = stableStringify(envelope.settings);
        if (envelope.progress._sync?.version) {
            this.latestLocalVersion = envelope.progress._sync.version;
        }
    }

    /**
     * Write-once safety net: before this instance's first write, snapshot the
     * current live remote file under a backup name. No-ops if a backup already
     * exists (never overwritten) or if there's nothing live to back up yet.
     * Failures are logged but non-fatal - the local backup (backup.service.ts)
     * is the primary safety net; this is defense in depth for cross-device sync.
     */
    async ensureRemoteBackupOnce(): Promise<void> {
        if (this.remoteBackupChecked) return;
        this.remoteBackupChecked = true;

        try {
            if (!this.folderId) await this.ensureFolder();

            const existingBackups = await this.driveClient.listFilesByName(this.folderId!, BackupService.REMOTE_BACKUP_FILE_NAME);
            if (existingBackups.length > 0) return;

            const liveFiles = await this.driveClient.listFilesByName(this.folderId!, DRIVE_FILE_NAME);
            if (liveFiles.length === 0) return;

            const raw = await this.driveClient.downloadFileContent(liveFiles[0].id);
            await this.driveClient.uploadNewFile(this.folderId!, BackupService.REMOTE_BACKUP_FILE_NAME, raw);
        } catch (e) {
            console.error('[GoogleDriveSync] Remote backup failed (non-fatal):', e);
        }
    }

    private async ensureFolder(): Promise<void> {
        if (this.folderId) return;
        this.folderId = await this.driveClient.findFolder(DRIVE_FOLDER_NAME);
        if (!this.folderId) {
            this.folderId = await this.driveClient.createFolder(DRIVE_FOLDER_NAME);
        }
    }

    /**
     * Resolves the single canonical progress file. If more than one file with
     * the expected name exists (a duplicate-file split-brain from two devices
     * both creating it concurrently), all copies are merged together, the
     * merge is written back to one canonical file, and the rest are trashed.
     */
    private async resolveCanonicalFile(): Promise<{ fileId: string | null; modifiedTime: string | null; envelope: SyncEnvelope | null }> {
        const files = await this.driveClient.listFilesByName(this.folderId!, DRIVE_FILE_NAME);
        if (files.length === 0) return { fileId: null, modifiedTime: null, envelope: null };

        if (files.length === 1) {
            const raw = await this.driveClient.downloadFileContent(files[0].id);
            return { fileId: files[0].id, modifiedTime: files[0].modifiedTime, envelope: this.parseEnvelope(raw) };
        }

        console.error(`[GoogleDriveSync] Found ${files.length} duplicate progress files - reconciling into one.`);
        const canonical = files[0];

        const envelopes: SyncEnvelope[] = [];
        for (const file of files) {
            const raw = await this.driveClient.downloadFileContent(file.id);
            envelopes.push(this.parseEnvelope(raw));
        }
        const merged: SyncEnvelope = envelopes.reduce((accumulated, next) => combineTwoEnvelopes(accumulated, next));

        for (const file of files) {
            if (file.id === canonical.id) continue;
            try {
                await this.driveClient.trashFile(file.id);
            } catch (e) {
                console.error('[GoogleDriveSync] Failed to trash duplicate file', e);
            }
        }

        await this.driveClient.updateFile(canonical.id, this.serializeEnvelope(merged));

        const canonicalMeta = await this.driveClient.getFileMetadata(canonical.id);
        return { fileId: canonical.id, modifiedTime: canonicalMeta.modifiedTime, envelope: merged };
    }

    private parseEnvelope(data: unknown): SyncEnvelope {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            throw new Error('The Drive progress file is not a JSON object');
        }
        const stored = data as StoredEnvelope;
        // BACKWARD COMPATIBILITY: raw UserProgress with no {progress, settings} wrapper.
        if (!stored.settings && stored.learningQueue) {
            const settings = this.getLocalSettings() ?? DEFAULT_SETTINGS;
            return {
                progress: migrateAndHydrateProgress(stored, settings),
                settings,
            };
        }
        const settings = { ...DEFAULT_SETTINGS, ...stored.settings };
        return {
            progress: migrateAndHydrateProgress(stored.progress ?? {}, settings),
            settings,
        };
    }

    private serializeEnvelope(envelope: SyncEnvelope): SerializedEnvelope {
        return { progress: toPlainProgressJSON(envelope.progress), settings: envelope.settings };
    }

    private getLocalProgress(): ProgressWithMetadata | null {
        return StorageService.loadProgress();
    }

    private getLocalSettings(): UserSettings | null {
        return StorageService.loadSettings();
    }

    private saveLocalEnvelope(envelope: SyncEnvelope): void {
        StorageService.saveProgress(envelope.progress);
        StorageService.saveSettings(envelope.settings);
    }
}
