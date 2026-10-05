import type { UserProgress, UserSettings } from "../models/user.model";
import { CONSTANTS } from "../commons/constants";
import { DEFAULT_SETTINGS } from "../models/user.model";
import { isTheme, type Theme } from "../models/theme.model";
import { BackupService } from "./backup.service";
import { toPlainProgressJSON, migrateAndHydrateProgress } from "./progressSerialization";
import { parseStoredProgress, parseStoredSettings } from "./progressHydration";
import type { ProgressWithMetadata } from "./sync/types";

const KEYS = CONSTANTS.storage;

/**
 * The only module that touches localStorage for app state (BackupService keeps its
 * own write-once snapshots). Everything goes through typed accessors here, so a key,
 * a serialization or a parse rule exists in exactly one place.
 */
export class StorageService {
    static saveProgress(progress: UserProgress): void {
        localStorage.setItem(KEYS.progressStorageKey, JSON.stringify(toPlainProgressJSON(progress)));
    }

    static loadProgress(): ProgressWithMetadata | null {
        const stored = localStorage.getItem(KEYS.progressStorageKey);
        if (!stored) return null;

        // Snapshot the raw pre-migration bytes exactly once, before anything (including
        // this load) has a chance to rewrite them. No-op after the first successful call.
        BackupService.ensureLocalBackupOnce(stored);

        // Settings must inform the migration pass's nextReviewAt re-derivation,
        // or a disabled meaning quiz makes every load disagree with every merge.
        return migrateAndHydrateProgress(parseStoredProgress(stored), this.loadSettings() ?? undefined);
    }

    static clearProgress(): void {
        localStorage.removeItem(KEYS.progressStorageKey);
    }

    static saveSettings(settings: UserSettings): void {
        localStorage.setItem(KEYS.settingsStorageKey, JSON.stringify(settings));
    }

    static loadSettings(): UserSettings | null {
        const stored = localStorage.getItem(KEYS.settingsStorageKey);
        if (!stored) return null;

        BackupService.ensureLocalSettingsBackupOnce(stored);

        return parseStoredSettings(stored, DEFAULT_SETTINGS);
    }

    static clearSettings(): void {
        localStorage.removeItem(KEYS.settingsStorageKey);
    }

    static loadGoogleDriveToken(): string | null {
        return localStorage.getItem(KEYS.googleDriveTokenKey);
    }

    static saveGoogleDriveToken(token: string): void {
        localStorage.setItem(KEYS.googleDriveTokenKey, token);
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
        localStorage.setItem(KEYS.themeStorageKey, theme);
    }

    /** The calendar day (Date.toDateString) the app was last opened on, for the daily-stats reset. */
    static loadLastAccessDay(): string | null {
        return localStorage.getItem(KEYS.lastAccessDateKey);
    }

    static saveLastAccessDay(day: string): void {
        localStorage.setItem(KEYS.lastAccessDateKey, day);
    }
}
