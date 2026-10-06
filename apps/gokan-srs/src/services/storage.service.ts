import type { UserProgress, UserSettings } from "../models/user.model";
import { CONSTANTS } from "../commons/constants";
import { DEFAULT_SETTINGS } from "../models/user.model";
import { isTheme, type Theme } from "../models/theme.model";
import { toPlainProgressJSON, migrateAndHydrateProgress } from "./progressSerialization";
import { parseStoredSettings, toStoredProgress } from "./progressHydration";
import { compactProgress, expandProgress } from "./progressCompaction";
import type { ProgressWithMetadata } from "./sync/types";

const KEYS = CONSTANTS.storage;

/** Whether a failed write was the origin running out of storage (each engine names it differently). */
function isQuotaError(error: unknown): boolean {
    if (!(error instanceof DOMException)) return false;
    return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22 || error.code === 1014;
}

type SaveListener = () => void;

/**
 * The only module that touches localStorage. Everything goes through typed accessors
 * here, so a key, a serialization or a parse rule exists in exactly one place.
 *
 * Progress is stored compacted (progressCompaction.ts) and no write ever throws: a full
 * origin used to throw out of a React effect and take the app down. A failed progress
 * save is reported through `progressSaveFailed` instead, which the app shows as a banner.
 */
export class StorageService {
    private static saveFailed = false;
    private static readonly listeners = new Set<SaveListener>();

    /** Writes progress. Returns false when it could not be stored (the app keeps running on the in-memory copy). */
    static saveProgress(progress: UserProgress): boolean {
        const value = JSON.stringify(compactProgress(toPlainProgressJSON(progress)));
        let saved = this.trySet(KEYS.progressStorageKey, value);
        // Space taken by something we no longer need is the first thing to give back.
        if (!saved && this.removeObsoleteKeys()) saved = this.trySet(KEYS.progressStorageKey, value);
        this.reportSave(saved);
        return saved;
    }

    static loadProgress(): ProgressWithMetadata | null {
        this.removeObsoleteKeys();
        const stored = localStorage.getItem(KEYS.progressStorageKey);
        if (!stored) return null;

        // Settings must inform the migration pass's nextReviewAt re-derivation,
        // or a disabled meaning quiz makes every load disagree with every merge.
        const parsed: unknown = JSON.parse(stored);
        return migrateAndHydrateProgress(toStoredProgress(expandProgress(parsed)), this.loadSettings() ?? undefined);
    }

    static clearProgress(): void {
        localStorage.removeItem(KEYS.progressStorageKey);
    }

    /** True while the latest progress save failed (storage full or unavailable). */
    static progressSaveFailed(): boolean {
        return this.saveFailed;
    }

    /** Subscribes to changes of progressSaveFailed(); returns the unsubscribe function. */
    static subscribeToSaveStatus(listener: SaveListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    static saveSettings(settings: UserSettings): void {
        this.trySet(KEYS.settingsStorageKey, JSON.stringify(settings));
    }

    static loadSettings(): UserSettings | null {
        const stored = localStorage.getItem(KEYS.settingsStorageKey);
        if (!stored) return null;
        return parseStoredSettings(stored, DEFAULT_SETTINGS);
    }

    static clearSettings(): void {
        localStorage.removeItem(KEYS.settingsStorageKey);
    }

    static loadGoogleDriveToken(): string | null {
        return localStorage.getItem(KEYS.googleDriveTokenKey);
    }

    static saveGoogleDriveToken(token: string): void {
        this.trySet(KEYS.googleDriveTokenKey, token);
    }

    static clearGoogleDriveToken(): void {
        localStorage.removeItem(KEYS.googleDriveTokenKey);
    }

    /** The stored theme, or null when none was chosen (or the stored value is not a theme). */
    static loadTheme(): Theme | null {
        const stored = localStorage.getItem(KEYS.themeStorageKey);
        return isTheme(stored) ? stored : null;
    }

    static saveTheme(theme: Theme): void {
        this.trySet(KEYS.themeStorageKey, theme);
    }

    /** The calendar day (Date.toDateString) the app was last opened on, for the daily-stats reset. */
    static loadLastAccessDay(): string | null {
        return localStorage.getItem(KEYS.lastAccessDateKey);
    }

    static saveLastAccessDay(day: string): void {
        this.trySet(KEYS.lastAccessDateKey, day);
    }

    /**
     * Removes keys older builds wrote and nothing reads any more: the write-once pre-v8
     * backups each held a full copy of progress, so with them a large history needed
     * twice its size and filled the origin. Returns whether anything was removed.
     */
    private static removeObsoleteKeys(): boolean {
        let removed = false;
        for (const key of KEYS.obsoleteKeys) {
            if (localStorage.getItem(key) === null) continue;
            localStorage.removeItem(key);
            removed = true;
        }
        return removed;
    }

    private static trySet(key: string, value: string): boolean {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.error(`[StorageService] Could not write ${key}${isQuotaError(error) ? ': storage is full' : ''}`, error);
            return false;
        }
    }

    private static reportSave(saved: boolean): void {
        if (this.saveFailed === !saved) return;
        this.saveFailed = !saved;
        for (const listener of this.listeners) listener();
    }
}
