import type { UserProgress, UserSettings } from "../models/user.model";
import { CONSTANTS } from "../commons/constants";
import { DEFAULT_SETTINGS } from "../models/user.model";
import { isTheme, type Theme } from "../models/theme.model";
import { toPlainProgressJSON, migrateAndHydrateProgress } from "./progressSerialization";
import { parseStoredSettings, toStoredProgress } from "./progressHydration";
import { compactProgress, expandProgress } from "./progressCompaction";
import { mergeProgress } from "./sync/mergeProgress";
import type { ProgressWithMetadata } from "./sync/types";

const KEYS = CONSTANTS.storage;

/** Whether a failed write was the origin running out of storage (each engine names it differently). */
function isQuotaError(error: unknown): boolean {
    if (!(error instanceof DOMException)) return false;
    return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22 || error.code === 1014;
}

type SaveListener = () => void;

/** Where progress lives on this device: IndexedDB, or localStorage where IndexedDB cannot be used (a blocked or private storage). */
type ProgressStore = { backend: 'indexedDB'; db: IDBDatabase } | { backend: 'localStorage' };

const LOCAL_STORE: ProgressStore = { backend: 'localStorage' };

/**
 * Progress was moved to IndexedDB on this device, and IndexedDB cannot be opened now. Thrown
 * rather than reading an empty localStorage: that would offer a learner with progress a fresh
 * start, and the fresh progress would then be saved over nothing they can get back.
 */
export class ProgressUnavailableError extends Error {
    constructor(cause: unknown) {
        super('Your progress is kept in this browser\'s storage, which could not be opened. Reload the page to try again.', { cause });
        this.name = 'ProgressUnavailableError';
    }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
}

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        // Throws (a SecurityError, or a ReferenceError where there is no IndexedDB at all) reject the promise.
        const request = indexedDB.open(KEYS.progressDatabaseName, 1);
        request.onupgradeneeded = () => { request.result.createObjectStore(KEYS.progressObjectStore); };
        request.onsuccess = () => {
            const db = request.result;
            // A later build that upgrades the database must not wait on this tab.
            db.onversionchange = () => db.close();
            resolve(db);
        };
        request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened'));
    });
}

async function readRecord(db: IDBDatabase): Promise<string | null> {
    const store = db.transaction(KEYS.progressObjectStore, 'readonly').objectStore(KEYS.progressObjectStore);
    const value: unknown = await requestResult(store.get(KEYS.progressStorageKey));
    return typeof value === 'string' ? value : null;
}

/** Writes (or, for null, deletes) the progress record; resolves once the transaction has committed. */
function writeRecord(db: IDBDatabase, value: string | null): Promise<void> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(KEYS.progressObjectStore, 'readwrite');
        const store = transaction.objectStore(KEYS.progressObjectStore);
        if (value === null) store.delete(KEYS.progressStorageKey);
        else store.put(value, KEYS.progressStorageKey);
        transaction.oncomplete = () => resolve();
        // A full origin aborts the transaction with a QuotaExceededError.
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write aborted'));
    });
}

/**
 * The only module that touches browser storage. Everything goes through typed accessors
 * here, so a key, a serialization or a parse rule exists in exactly one place.
 *
 * Progress lives in IndexedDB (an origin's quota there is a share of the disk, against about
 * 5 MB for localStorage), as one record holding the same compacted payload localStorage held.
 * Settings, the Drive token, the theme and the last-access day are small and stay in
 * localStorage, read synchronously.
 *
 * No write ever throws: a full origin used to throw out of a React effect and take the app
 * down. A failed progress save is reported through `progressSaveFailed` instead, which the
 * app shows as a banner.
 */
export class StorageService {
    private static saveFailed = false;
    private static readonly listeners = new Set<SaveListener>();
    private static store: Promise<ProgressStore> | null = null;
    /** The latest progress not yet written (null: delete it), taken by the next write in the chain. */
    private static pending: { value: string | null } | null = null;
    private static writes: Promise<boolean> = Promise.resolve(true);
    private static markedInIndexedDb = false;

    /**
     * Writes progress, in order behind any write still in flight; when several are queued
     * only the latest is written. Resolves to false when it could not be stored (the app
     * keeps running on the in-memory copy). Never rejects.
     */
    static saveProgress(progress: UserProgress): Promise<boolean> {
        // Serialized now, so the write stores the progress as it was when saved.
        return this.enqueue(this.serialize(progress));
    }

    /** Reads progress, after any write still in flight. Rejects with ProgressUnavailableError when it cannot be read. */
    static async loadProgress(): Promise<ProgressWithMetadata | null> {
        this.removeObsoleteKeys();
        const store = await this.openStore();
        await this.writes;
        const stored = store.backend === 'indexedDB' ? await readRecord(store.db) : localStorage.getItem(KEYS.progressStorageKey);
        if (!stored) return null;
        return this.parse(stored);
    }

    static clearProgress(): Promise<boolean> {
        return this.enqueue(null);
    }

    /** Whether progress is kept in IndexedDB on this device (false: localStorage, IndexedDB being unavailable). */
    static async progressInIndexedDb(): Promise<boolean> {
        try {
            return (await this.openStore()).backend === 'indexedDB';
        } catch {
            return false;
        }
    }

    /** Whether the browser keeps this origin's storage under disk pressure; null where it cannot say. */
    static async storageIsPersistent(): Promise<boolean | null> {
        if (typeof navigator === 'undefined' || typeof navigator.storage?.persisted !== 'function') return null;
        try {
            return await navigator.storage.persisted();
        } catch {
            return null;
        }
    }

    /**
     * Asks the browser not to evict this origin's storage under disk pressure. Firefox shows a
     * permission prompt for it, so it is only called from an action that says why (Settings),
     * never on load. Resolves to whether storage is persistent now.
     */
    static async requestPersistentStorage(): Promise<boolean> {
        if (typeof navigator === 'undefined' || typeof navigator.storage?.persist !== 'function') return false;
        try {
            return await navigator.storage.persist();
        } catch (error) {
            console.error('[StorageService] Persistent storage request failed', error);
            return false;
        }
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

    private static serialize(progress: UserProgress): string {
        return JSON.stringify(compactProgress(toPlainProgressJSON(progress)));
    }

    private static parse(stored: string): ProgressWithMetadata {
        // Settings must inform the migration pass's nextReviewAt re-derivation,
        // or a disabled meaning quiz makes every load disagree with every merge.
        const parsed: unknown = JSON.parse(stored);
        return migrateAndHydrateProgress(toStoredProgress(expandProgress(parsed)), this.loadSettings() ?? undefined);
    }

    /**
     * The value to store when localStorage holds progress and IndexedDB may too. With no record
     * the localStorage copy moves as it is. With one, neither copy is assumed newer: a tab
     * still running a build from before IndexedDB keeps writing localStorage after another tab
     * moved progress and went on studying, so the two are merged per entry, as Drive merges.
     */
    private static async movedProgress(db: IDBDatabase, legacy: string): Promise<string> {
        const existing = await readRecord(db);
        if (existing === null) return legacy;
        const settings = this.loadSettings() ?? undefined;
        const merged = mergeProgress(this.parse(existing), this.parse(legacy), settings);
        return merged ? this.serialize(merged) : legacy;
    }

    /** Records that progress has been written to IndexedDB (see ProgressUnavailableError). */
    private static markProgressInIndexedDb(): void {
        if (this.markedInIndexedDb) return;
        this.markedInIndexedDb = this.trySet(KEYS.progressInIndexedDbKey, '1');
    }

    /** No progress is kept anywhere now, so a later visit that cannot open IndexedDB has nothing to protect. */
    private static unmarkProgressInIndexedDb(): void {
        localStorage.removeItem(KEYS.progressInIndexedDbKey);
        this.markedInIndexedDb = false;
    }

    /**
     * Opens IndexedDB and, on the first load of a build that has it, moves progress over from
     * localStorage. The localStorage copy may be the only one, so it is removed only once the
     * IndexedDB copy has been read back equal; anything failing on the way keeps localStorage in
     * use, exactly as before. Progress found in localStorage on a later load (written by a
     * session that could not open IndexedDB, or by a tab still on an older build) is merged
     * into the IndexedDB record, never written over it.
     */
    private static async openProgressStore(): Promise<ProgressStore> {
        let db: IDBDatabase;
        try {
            db = await openDatabase();
        } catch (error) {
            const movedAway = localStorage.getItem(KEYS.progressInIndexedDbKey) !== null;
            if (movedAway && localStorage.getItem(KEYS.progressStorageKey) === null) throw new ProgressUnavailableError(error);
            console.warn('[StorageService] IndexedDB is unavailable; progress stays in localStorage', error);
            return LOCAL_STORE;
        }

        const legacy = localStorage.getItem(KEYS.progressStorageKey);
        if (legacy === null) return { backend: 'indexedDB', db };

        try {
            const moved = await this.movedProgress(db, legacy);
            await writeRecord(db, moved);
            if (await readRecord(db) !== moved) throw new Error('the copy read back differs from what was written');
        } catch (error) {
            console.error('[StorageService] Could not move progress to IndexedDB; it stays in localStorage', error);
            return LOCAL_STORE;
        }
        localStorage.removeItem(KEYS.progressStorageKey);
        this.markProgressInIndexedDb();
        return { backend: 'indexedDB', db };
    }

    private static openStore(): Promise<ProgressStore> {
        this.store ??= this.openProgressStore();
        return this.store;
    }

    private static enqueue(value: string | null): Promise<boolean> {
        this.pending = { value };
        this.writes = this.writes.then(previous => {
            const next = this.pending;
            // An earlier link already wrote this value, or a later one: it has the say.
            if (!next) return previous;
            this.pending = null;
            return this.write(next.value);
        });
        return this.writes;
    }

    private static async write(value: string | null): Promise<boolean> {
        let saved: boolean;
        try {
            const store = await this.openStore();
            if (store.backend === 'indexedDB') {
                await writeRecord(store.db, value);
                if (value !== null) this.markProgressInIndexedDb();
                else this.unmarkProgressInIndexedDb();
                saved = true;
            } else {
                saved = this.writeLocalProgress(value);
            }
        } catch (error) {
            console.error(`[StorageService] Could not write progress${isQuotaError(error) ? ': storage is full' : ''}`, error);
            saved = false;
        }
        if (value !== null) this.reportSave(saved);
        return saved;
    }

    private static writeLocalProgress(value: string | null): boolean {
        if (value === null) {
            localStorage.removeItem(KEYS.progressStorageKey);
            return true;
        }
        let saved = this.trySet(KEYS.progressStorageKey, value);
        // Space taken by something we no longer need is the first thing to give back.
        if (!saved && this.removeObsoleteKeys()) saved = this.trySet(KEYS.progressStorageKey, value);
        return saved;
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
