import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service';
import { CONSTANTS } from '../commons/constants';
import { srsEntry, userProgress, vocabProgress } from '../test/fixtures';

const KEYS = CONSTANTS.storage;
const [BACKUP_KEY, SETTINGS_BACKUP_KEY] = KEYS.obsoleteKeys;

/** An in-memory localStorage that throws like a browser once its contents exceed `quota` characters. */
class QuotaStorage implements Storage {
    private readonly items = new Map<string, string>();
    private readonly quota: number;
    constructor(quota: number) { this.quota = quota; }
    get length(): number { return this.items.size; }
    clear(): void { this.items.clear(); }
    getItem(key: string): string | null { return this.items.get(key) ?? null; }
    key(index: number): string | null { return [...this.items.keys()][index] ?? null; }
    removeItem(key: string): void { this.items.delete(key); }
    setItem(key: string, value: string): void {
        const others = [...this.items].filter(([k]) => k !== key).reduce((sum, [k, v]) => sum + k.length + v.length, 0);
        if (others + key.length + value.length > this.quota) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        this.items.set(key, value);
    }
    used(): number { return [...this.items].reduce((sum, [k, v]) => sum + k.length + v.length, 0); }
}

const progress = userProgress({
    learningQueue: [vocabProgress({ vocabId: '42', introductionAt: new Date(Date.UTC(2026, 0, 1)), reading: srsEntry({ memoryStrength: 12.5 }) })],
});

let storage: QuotaStorage;
function install(quota: number): void {
    storage = new QuotaStorage(quota);
    vi.stubGlobal('localStorage', storage);
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    install(1_000_000);
});

afterEach(() => {
    // Leave the shared status clean for the next test.
    install(1_000_000);
    StorageService.saveProgress(progress);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('StorageService progress persistence', () => {
    it('saves progress compacted and loads it back as the same progress', () => {
        expect(StorageService.saveProgress(progress)).toBe(true);
        expect(storage.getItem(KEYS.progressStorageKey)).toContain('"~":1');
        const loaded = StorageService.loadProgress();
        expect(loaded?.learningQueue[0].vocabId).toBe('42');
        expect(loaded?.learningQueue[0].reading.memoryStrength).toBe(12.5);
        expect(loaded?.learningQueue[0].introductionAt).toEqual(new Date(Date.UTC(2026, 0, 1)));
    });

    it('still loads progress saved in the readable form by an earlier build', () => {
        storage.setItem(KEYS.progressStorageKey, JSON.stringify({ learningQueue: [{ vocabId: '7', stage: 'learning' }], _formatVersion: 12 }));
        expect(StorageService.loadProgress()?.learningQueue[0].vocabId).toBe('7');
    });

    it('deletes the obsolete pre-v8 backups on load, and never writes them again', () => {
        storage.setItem(BACKUP_KEY, 'x'.repeat(1000));
        storage.setItem(SETTINGS_BACKUP_KEY, '{}');
        StorageService.saveProgress(progress);
        StorageService.loadProgress();
        StorageService.loadSettings();
        expect(storage.getItem(BACKUP_KEY)).toBeNull();
        expect(storage.getItem(SETTINGS_BACKUP_KEY)).toBeNull();
    });

    it('frees the obsolete backups and retries when storage is full (the reported production crash)', () => {
        install(4000);
        // Leave less room than the progress needs, so only freeing the backup lets it fit.
        storage.setItem(BACKUP_KEY, 'x'.repeat(4000 - BACKUP_KEY.length - 20));
        expect(StorageService.saveProgress(progress)).toBe(true);
        expect(storage.getItem(BACKUP_KEY)).toBeNull();
        expect(StorageService.progressSaveFailed()).toBe(false);
    });

    it('reports a save it cannot make instead of throwing, and clears the report once a save succeeds', () => {
        const listener = vi.fn();
        const unsubscribe = StorageService.subscribeToSaveStatus(listener);
        install(10);

        expect(() => StorageService.saveProgress(progress)).not.toThrow();
        expect(StorageService.progressSaveFailed()).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);

        install(1_000_000);
        expect(StorageService.saveProgress(progress)).toBe(true);
        expect(StorageService.progressSaveFailed()).toBe(false);
        expect(listener).toHaveBeenCalledTimes(2);
        unsubscribe();
    });

    it('never throws when a small value cannot be written either', () => {
        install(10);
        expect(() => StorageService.saveTheme('dark')).not.toThrow();
        expect(() => StorageService.saveLastAccessDay('Mon Oct 06 2026')).not.toThrow();
    });
});
