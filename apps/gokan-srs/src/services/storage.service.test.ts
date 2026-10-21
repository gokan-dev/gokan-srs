import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { CONSTANTS } from '../commons/constants';
import { reviewLog, srsEntry, userProgress, vocabProgress } from '../test/fixtures';
import { compactProgress } from './progressCompaction';
import { migrateAndHydrateProgress, toPlainProgressJSON } from './progressSerialization';
import type { ProgressWithMetadata } from './sync/types';

const KEYS = CONSTANTS.storage;
const [BACKUP_KEY, SETTINGS_BACKUP_KEY] = KEYS.obsoleteKeys;
const DAY = 86_400_000;

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
}

const progress = userProgress({
    learningQueue: [vocabProgress({ vocabId: '42', introductionAt: new Date(Date.UTC(2026, 0, 1)), reading: srsEntry({ memoryStrength: 12.5 }) })],
});

/** What a stored payload holds: progress as the codec writes it. */
const payloadOf = (value: ProgressWithMetadata) => JSON.stringify(compactProgress(toPlainProgressJSON(value)));

/** Loaded progress equals saved progress hydrated the readable way (the load re-derives nextReviewAt and fills defaults). */
const asLoaded = (value: ProgressWithMetadata) => migrateAndHydrateProgress(toPlainProgressJSON(value), undefined);

let storage: QuotaStorage;
function installLocalStorage(quota: number): void {
    storage = new QuotaStorage(quota);
    vi.stubGlobal('localStorage', storage);
}

/** A fresh StorageService (its store is opened once per module), against the storage stubbed now. */
async function freshService() {
    vi.resetModules();
    return import('./storage.service');
}

/** The progress record in IndexedDB, read the way the layout check reads it. */
async function idbRecord(): Promise<unknown> {
    const done = <T,>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('request failed'));
    });
    const db = await done(indexedDB.open(KEYS.progressDatabaseName, 1));
    const value: unknown = await done(db.transaction(KEYS.progressObjectStore).objectStore(KEYS.progressObjectStore).get(KEYS.progressStorageKey));
    db.close();
    return value;
}

beforeEach(() => {
    // A load re-derives due dates from the clock; IndexedDB's own timers stay real.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 9, 20, 12));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    installLocalStorage(1_000_000);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('StorageService where IndexedDB is unavailable (localStorage, as before #153)', () => {
    beforeEach(() => vi.stubGlobal('indexedDB', undefined));

    it('saves progress compacted and loads it back as the same progress', async () => {
        const { StorageService } = await freshService();
        expect(await StorageService.saveProgress(progress)).toBe(true);
        expect(storage.getItem(KEYS.progressStorageKey)).toContain('"~":1');
        const loaded = await StorageService.loadProgress();
        expect(loaded?.learningQueue[0].vocabId).toBe('42');
        expect(loaded?.learningQueue[0].reading.memoryStrength).toBe(12.5);
        expect(loaded?.learningQueue[0].introductionAt).toEqual(new Date(Date.UTC(2026, 0, 1)));
    });

    it('still loads progress saved in the readable form by an earlier build', async () => {
        storage.setItem(KEYS.progressStorageKey, JSON.stringify({ learningQueue: [{ vocabId: '7', stage: 'learning' }], _formatVersion: 12 }));
        const { StorageService } = await freshService();
        expect((await StorageService.loadProgress())?.learningQueue[0].vocabId).toBe('7');
    });

    it('deletes the obsolete pre-v8 backups on load, and never writes them again', async () => {
        storage.setItem(BACKUP_KEY, 'x'.repeat(1000));
        storage.setItem(SETTINGS_BACKUP_KEY, '{}');
        const { StorageService } = await freshService();
        await StorageService.saveProgress(progress);
        await StorageService.loadProgress();
        expect(storage.getItem(BACKUP_KEY)).toBeNull();
        expect(storage.getItem(SETTINGS_BACKUP_KEY)).toBeNull();
    });

    it('frees the obsolete backups and retries when storage is full (the reported production crash)', async () => {
        installLocalStorage(4000);
        // Leave less room than the progress needs, so only freeing the backup lets it fit.
        storage.setItem(BACKUP_KEY, 'x'.repeat(4000 - BACKUP_KEY.length - 20));
        const { StorageService } = await freshService();
        expect(await StorageService.saveProgress(progress)).toBe(true);
        expect(storage.getItem(BACKUP_KEY)).toBeNull();
        expect(StorageService.progressSaveFailed()).toBe(false);
    });

    it('reports a save it cannot make instead of throwing, and clears the report once a save succeeds', async () => {
        const { StorageService } = await freshService();
        const listener = vi.fn();
        const unsubscribe = StorageService.subscribeToSaveStatus(listener);
        installLocalStorage(10);

        expect(await StorageService.saveProgress(progress)).toBe(false);
        expect(StorageService.progressSaveFailed()).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);

        installLocalStorage(1_000_000);
        expect(await StorageService.saveProgress(progress)).toBe(true);
        expect(StorageService.progressSaveFailed()).toBe(false);
        expect(listener).toHaveBeenCalledTimes(2);
        unsubscribe();
    });

    it('never throws when a small value cannot be written either', async () => {
        installLocalStorage(10);
        const { StorageService } = await freshService();
        expect(() => StorageService.saveTheme('dark')).not.toThrow();
        expect(() => StorageService.saveLastAccessDay('Mon Oct 06 2026')).not.toThrow();
    });
});

describe('StorageService with IndexedDB', () => {
    beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));

    it('keeps progress in IndexedDB, not in localStorage', async () => {
        const { StorageService } = await freshService();
        expect(await StorageService.saveProgress(progress)).toBe(true);
        expect(await idbRecord()).toBe(payloadOf(progress));
        expect(storage.getItem(KEYS.progressStorageKey)).toBeNull();
        expect(await StorageService.loadProgress()).toEqual(asLoaded(progress));
        expect(await StorageService.progressInIndexedDb()).toBe(true);
    });

    it('reads nothing on a device with no progress (onboarding)', async () => {
        const { StorageService } = await freshService();
        expect(await StorageService.loadProgress()).toBeNull();
    });

    it('moves progress found only in localStorage, removing the key once the copy reads back equal', async () => {
        const payload = payloadOf(progress);
        storage.setItem(KEYS.progressStorageKey, payload);
        const { StorageService } = await freshService();

        expect(await StorageService.loadProgress()).toEqual(asLoaded(progress));
        expect(await idbRecord()).toBe(payload);
        expect(storage.getItem(KEYS.progressStorageKey)).toBeNull();
        expect(storage.getItem(KEYS.progressInIndexedDbKey)).not.toBeNull();
    });

    it('keeps localStorage, untouched and in use, when the copy reads back different', async () => {
        const payload = payloadOf(progress);
        storage.setItem(KEYS.progressStorageKey, payload);
        // The read-back answers something other than the payload just written.
        const get = vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
            return this.count(key);
        });
        const { StorageService } = await freshService();

        expect(await StorageService.loadProgress()).toEqual(asLoaded(progress));
        expect(get).toHaveBeenCalled();
        expect(storage.getItem(KEYS.progressStorageKey)).toBe(payload);
        expect(await StorageService.progressInIndexedDb()).toBe(false);
    });

    it('keeps localStorage, untouched and in use, when IndexedDB cannot be written', async () => {
        const payload = payloadOf(progress);
        storage.setItem(KEYS.progressStorageKey, payload);
        vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
        const { StorageService } = await freshService();

        expect(await StorageService.loadProgress()).toEqual(asLoaded(progress));
        expect(storage.getItem(KEYS.progressStorageKey)).toBe(payload);
        vi.restoreAllMocks();
        // Later saves keep going to localStorage, where the progress is.
        const answered = userProgress({ learningQueue: [vocabProgress({ vocabId: '43' })] });
        expect(await StorageService.saveProgress(answered)).toBe(true);
        expect(storage.getItem(KEYS.progressStorageKey)).toBe(payloadOf(answered));
    });

    it('keeps localStorage, untouched and in use, when IndexedDB cannot be opened (a blocked or private storage)', async () => {
        const payload = payloadOf(progress);
        storage.setItem(KEYS.progressStorageKey, payload);
        vi.stubGlobal('indexedDB', { open: () => { throw new DOMException('denied', 'SecurityError'); } });
        const { StorageService } = await freshService();

        expect(await StorageService.loadProgress()).toEqual(asLoaded(progress));
        expect(storage.getItem(KEYS.progressStorageKey)).toBe(payload);
    });

    it('fails loudly, never offering a fresh start, when progress was moved to IndexedDB and it cannot be opened now', async () => {
        storage.setItem(KEYS.progressInIndexedDbKey, '1');
        vi.stubGlobal('indexedDB', { open: () => { throw new DOMException('denied', 'SecurityError'); } });
        const { StorageService, ProgressUnavailableError } = await freshService();
        await expect(StorageService.loadProgress()).rejects.toBeInstanceOf(ProgressUnavailableError);
    });

    it('merges a localStorage copy left by another tab into the IndexedDB record, never writing over it', async () => {
        // Word A reviewed after the move; word B answered meanwhile in a tab still on a build before IndexedDB.
        const first = await freshService();
        await first.StorageService.saveProgress(userProgress({ learningQueue: [vocabProgress({ vocabId: 'A', reading: srsEntry({ memoryStrength: 9 }) })] }));
        storage.setItem(KEYS.progressStorageKey, payloadOf(userProgress({ learningQueue: [vocabProgress({ vocabId: 'B' })] })));

        const { StorageService } = await freshService();
        const loaded = await StorageService.loadProgress();
        expect(loaded?.learningQueue.map(word => word.vocabId).sort()).toEqual(['A', 'B']);
        expect(loaded?.learningQueue.find(word => word.vocabId === 'A')?.reading.memoryStrength).toBe(9);
        expect(storage.getItem(KEYS.progressStorageKey)).toBeNull();
    });

    it('keeps the record\'s sync version when it merges a leftover copy: a local move is not a sync step', async () => {
        const first = await freshService();
        await first.StorageService.saveProgress(userProgress({ _sync: { version: 7, lastModified: Date.UTC(2026, 9, 1) } }));
        storage.setItem(KEYS.progressStorageKey, payloadOf(userProgress({ _sync: { version: 3, lastModified: Date.UTC(2026, 8, 1) } })));

        const { StorageService } = await freshService();
        expect((await StorageService.loadProgress())?._sync?.version).toBe(7);
    });

    it('keeps every kanji either copy marked known, and the further step on one method, when it merges a leftover copy', async () => {
        const first = await freshService();
        await first.StorageService.saveProgress(userProgress({ kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: new Set(['日']) } }));
        storage.setItem(KEYS.progressStorageKey, payloadOf(userProgress({ kanjiKnowledge: { method: 'kklc', step: 12, kanjiSet: new Set(['月']) } })));

        const { StorageService } = await freshService();
        const knowledge = (await StorageService.loadProgress())?.kanjiKnowledge;
        expect(knowledge?.method).toBe('kklc');
        expect(knowledge?.step).toBe(12);
        expect([...knowledge?.kanjiSet ?? []].sort()).toEqual(['日', '月'].sort());
    });

    it('keeps the record\'s method and step when the leftover copy follows another method', async () => {
        // A step counts the first N kanji of its own method, so the leftover's step means nothing on the record's.
        const first = await freshService();
        await first.StorageService.saveProgress(userProgress({ kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: new Set(['日']) } }));
        storage.setItem(KEYS.progressStorageKey, payloadOf(userProgress({ kanjiKnowledge: { method: 'rtk', step: 30, kanjiSet: new Set(['月']) } })));

        const { StorageService } = await freshService();
        const knowledge = (await StorageService.loadProgress())?.kanjiKnowledge;
        expect(knowledge?.method).toBe('kklc');
        expect(knowledge?.step).toBe(10);
        expect([...knowledge?.kanjiSet ?? []].sort()).toEqual(['日', '月'].sort());
    });

    it('writes in order: of saves queued together, the latest is what is stored, and a load waits for it', async () => {
        const { StorageService } = await freshService();
        const versions = [1, 2, 3].map(n => userProgress({ learningQueue: [vocabProgress({ vocabId: `v${n}` })] }));
        const put = vi.spyOn(IDBObjectStore.prototype, 'put');

        const saves = versions.map(version => StorageService.saveProgress(version));
        const loaded = StorageService.loadProgress();
        expect(await Promise.all(saves)).toEqual([true, true, true]);
        expect(await loaded).toEqual(asLoaded(versions[2]));
        expect(await idbRecord()).toBe(payloadOf(versions[2]));
        // Queued before the first could start, the three were written once.
        expect(put).toHaveBeenCalledTimes(1);
    });

    it('reports a write IndexedDB refuses (StorageFullBanner)', async () => {
        const { StorageService } = await freshService();
        await StorageService.saveProgress(progress);
        vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
        expect(await StorageService.saveProgress(progress)).toBe(false);
        expect(StorageService.progressSaveFailed()).toBe(true);
        // The copy already stored is kept.
        expect(await idbRecord()).toBe(payloadOf(progress));
    });

    it('clears progress', async () => {
        const { StorageService } = await freshService();
        await StorageService.saveProgress(progress);
        await StorageService.clearProgress();
        expect(await StorageService.loadProgress()).toBeNull();
    });

    it('offers onboarding, not the fatal error, after a reset when IndexedDB later cannot be opened', async () => {
        const first = await freshService();
        await first.StorageService.saveProgress(progress);
        await first.StorageService.clearProgress();

        vi.stubGlobal('indexedDB', { open: () => { throw new DOMException('denied', 'SecurityError'); } });
        const { StorageService } = await freshService();
        expect(await StorageService.loadProgress()).toBeNull();
    });

    it('a reset in a session that ran on localStorage also removes the IndexedDB record, so the next load does not bring it back', async () => {
        const first = await freshService();
        await first.StorageService.saveProgress(progress);

        // A session where IndexedDB could not be opened, but localStorage held progress.
        const factory = indexedDB;
        storage.setItem(KEYS.progressStorageKey, payloadOf(progress));
        vi.stubGlobal('indexedDB', { open: () => { throw new DOMException('denied', 'SecurityError'); } });
        const local = await freshService();
        expect(await local.StorageService.progressInIndexedDb()).toBe(false);
        vi.stubGlobal('indexedDB', factory);
        expect(await local.StorageService.clearProgress()).toBe(true);

        const { StorageService } = await freshService();
        expect(await StorageService.loadProgress()).toBeNull();
        expect(storage.getItem(KEYS.progressInIndexedDbKey)).toBeNull();
    });

    // Past localStorage's ceiling of about 5M chars (docs/ARCHITECTURE.md, Storage Service).
    it('round-trips a heavy learner: 10,000 words with full histories', async () => {
        const history = (offset: number) => Array.from({ length: 20 }, (_, i) => reviewLog({
            date: Date.UTC(2025, 0, 1) + (offset + i * 7) * DAY + i * 61_237,
            result: i % 6 === 5 ? 'wrong' : 'correct',
            interval: Math.round((1.3 + i * 2.17) * 100) / 100,
            latency: 2000 + ((offset * 31 + i * 733) % 9000),
        }));
        const entry = (offset: number) => srsEntry({ memoryStrength: 40 + (offset % 50), interval: 30 + (offset % 90), history: history(offset) });
        const heavy = userProgress({
            learningQueue: Array.from({ length: 10_000 }, (_, n) => vocabProgress({
                vocabId: String(1_000_000 + n),
                stage: 'graduated',
                introductionAt: new Date(Date.UTC(2025, 0, 1) + n * 60_000),
                totalReviews: 60,
                reading: entry(n),
                meaning: entry(n + 1),
                production: entry(n + 2),
            })),
        });

        const { StorageService } = await freshService();
        expect(await StorageService.saveProgress(heavy)).toBe(true);
        const record = await idbRecord();
        expect(typeof record === 'string' && record.length).toBeGreaterThan(5_000_000);
        expect(await StorageService.loadProgress()).toEqual(asLoaded(heavy));
    }, 60_000);
});
