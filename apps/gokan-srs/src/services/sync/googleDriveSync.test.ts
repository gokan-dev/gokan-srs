import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GoogleDriveSync } from './googleDriveSync';
import { toPlainProgressJSON } from '../progressSerialization';
import { CURRENT_FORMAT_VERSION, MigrationService } from '../migration.service';
import type { StoredProgress } from '../progressHydration';
import { DEFAULT_SETTINGS } from '../../models/user.model';
import type { SyncEnvelope } from './types';

/** A real Response, so the body goes through the same JSON round trip a Drive download does. */
function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
}

/** An envelope as it sits in the Drive file. */
function stored(envelope: SyncEnvelope): { progress: StoredProgress; settings: SyncEnvelope['settings'] } {
    return { progress: toPlainProgressJSON(envelope.progress), settings: envelope.settings };
}

function makeEnvelope(version: number, overrides: StoredProgress = {}): SyncEnvelope {
    return {
        progress: MigrationService.migrateUserProgress({
            kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: ['A'] },
            learningQueue: [],
            stats: { totalReviews: 0, totalLearned: 0, newLearnedToday: 0 },
            dailyOverride: false,
            adaptive: { level: 1.0, history: [] },
            _sync: { lastModified: 0, version },
            // Already at the terminal migration version so these sync-focused tests
            // don't also need to mock the async passes' fetches (the homograph
            // merge-map, and the grammar alias index).
            _formatVersion: CURRENT_FORMAT_VERSION,
            ...overrides,
        }),
        settings: { ...DEFAULT_SETTINGS, preferredLearningOrder: 'frequency', enableMeaningQuiz: true, learningFrequency: 'medium' },
    };
}

function urlOf(input: RequestInfo | URL): string {
    if (typeof input === 'string') return input;
    return input instanceof URL ? input.href : input.url;
}

/**
 * Routes a mocked fetch call by URL/method pattern. Each handler receives the
 * call count for its own pattern so tests can vary responses across retries
 * (e.g. simulating a file's modifiedTime changing between reads).
 */
function createFetchRouter(handlers: Array<{
    match: (url: string, method: string) => boolean;
    respond: (callIndex: number, url: string, init?: RequestInit) => Response | Promise<Response>;
}>) {
    const counts = new Map<number, number>();
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlOf(input);
        const method = init?.method ?? 'GET';
        for (let i = 0; i < handlers.length; i++) {
            if (handlers[i].match(url, method)) {
                const count = counts.get(i) ?? 0;
                counts.set(i, count + 1);
                return handlers[i].respond(count, url, init);
            }
        }
        throw new Error(`Unmocked fetch call: ${method} ${url}`);
    });
}

const isFolderSearch = (url: string) => url.includes("mimeType='application/vnd.google-apps.folder'");
const isFileList = (url: string, name: string) => url.includes(`name='${name}'`) && url.includes('files?q=');
const isMetadata = (url: string) => url.includes('fields=modifiedTime');
const isContent = (url: string) => url.includes('alt=media');
const isUpload = (url: string, method: string) => url.includes('/upload/drive/v3/files') && (method === 'POST' || method === 'PATCH');
const isTrash = (url: string, method: string) => method === 'PATCH' && !url.includes('/upload/');

type Route = Parameters<typeof createFetchRouter>[0][number];

/**
 * The common Drive layout: the app folder, an existing backup, and one live progress file
 * at modifiedTime T1 whose content is `content()`. Uploads succeed unless `upload` is given.
 */
function singleFileRoutes(content: () => unknown, upload?: Route['respond']): Route[] {
    return [
        { match: isFolderSearch, respond: () => jsonResponse({ files: [{ id: 'folder-1' }] }) },
        { match: (url) => isFileList(url, 'kanji-progress.pre-v8-backup.json'), respond: () => jsonResponse({ files: [{ id: 'backup-1' }] }) },
        { match: (url) => isFileList(url, 'kanji-progress.json'), respond: () => jsonResponse({ files: [{ id: 'file-1', name: 'kanji-progress.json', modifiedTime: 'T1' }] }) },
        { match: isContent, respond: () => jsonResponse(content()) },
        { match: isMetadata, respond: () => jsonResponse({ modifiedTime: 'T1' }) },
        { match: isUpload, respond: upload ?? (() => jsonResponse({ id: 'file-1' })) },
    ];
}

/** Minimal in-memory localStorage polyfill - this suite runs under Node, which has no DOM storage. */
function installLocalStorageStub(): void {
    const store = new Map<string, string>();
    const stub: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
        removeItem: (key: string) => { store.delete(key); },
        clear: () => { store.clear(); },
    };
    vi.stubGlobal('localStorage', stub);
}

/** The progress file a multipart Drive upload carries. */
async function uploadedFile(init: RequestInit | undefined): Promise<{ progress?: StoredProgress } | null> {
    if (!(init?.body instanceof FormData)) return null;
    const file = init.body.get('file');
    if (!(file instanceof Blob)) return null;
    const parsed: unknown = JSON.parse(await file.text());
    return parsed as { progress?: StoredProgress };
}

describe('GoogleDriveSync', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        installLocalStorageStub();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('creates a new remote file when none exists yet', async () => {
        vi.stubGlobal('fetch', createFetchRouter([
            { match: isFolderSearch, respond: () => jsonResponse({ files: [{ id: 'folder-1' }] }) },
            { match: (url) => isFileList(url, 'kanji-progress.pre-v8-backup.json'), respond: () => jsonResponse({ files: [] }) },
            { match: (url) => isFileList(url, 'kanji-progress.json'), respond: () => jsonResponse({ files: [] }) },
            { match: isUpload, respond: () => jsonResponse({ id: 'new-file-id' }) },
        ]));

        const sync = new GoogleDriveSync('token');
        const local = makeEnvelope(1);
        const result = await sync.sync(local);

        expect(result).not.toBeNull();
        expect(result!.envelope.progress._sync?.version).toBe(2); // addSyncMetadata bump from mergeProgress(local, null)
        expect(result!.pulledRemoteChanges).toBe(false); // no remote existed, nothing was pulled in
    });

    it('retries with fresh data when the remote file changed between read and write (CAS)', async () => {
        const remoteEnvelope = makeEnvelope(5);

        vi.stubGlobal('fetch', createFetchRouter([
            { match: isFolderSearch, respond: () => jsonResponse({ files: [{ id: 'folder-1' }] }) },
            { match: (url) => isFileList(url, 'kanji-progress.pre-v8-backup.json'), respond: () => jsonResponse({ files: [{ id: 'backup-1', modifiedTime: 'T0' }] }) },
            {
                match: (url) => isFileList(url, 'kanji-progress.json'),
                respond: (count) => jsonResponse({
                    files: [{ id: 'file-1', name: 'kanji-progress.json', modifiedTime: count === 0 ? 'T1' : 'T2' }],
                }),
            },
            { match: isContent, respond: () => jsonResponse(stored(remoteEnvelope)) },
            {
                match: isMetadata,
                respond: (count) => jsonResponse({ modifiedTime: count === 0 ? 'T2' : 'T2' }), // differs from first list's T1, matches second list's T2
            },
            { match: isUpload, respond: () => jsonResponse({ id: 'file-1' }) },
        ]));

        const sync = new GoogleDriveSync('token');
        const local = makeEnvelope(1);
        const result = await sync.sync(local);

        expect(result).not.toBeNull();
        // Confirms the retry happened and the final write succeeded rather than
        // throwing or silently clobbering - the CAS mismatch triggered a re-fetch.
        const listCallsForFile = vi.mocked(fetch).mock.calls.filter(
            ([input]) => isFileList(urlOf(input), 'kanji-progress.json')
        );
        expect(listCallsForFile.length).toBeGreaterThanOrEqual(2);
    });

    it('reconciles duplicate remote files: merges all copies, trashes the non-canonical ones', async () => {
        const fileA = makeEnvelope(1, { stats: { totalReviews: 10, totalLearned: 1, newLearnedToday: 0 } });
        const fileB = makeEnvelope(1, { stats: { totalReviews: 3, totalLearned: 5, newLearnedToday: 0 } });

        const trashedIds: string[] = [];

        vi.stubGlobal('fetch', createFetchRouter([
            { match: isFolderSearch, respond: () => jsonResponse({ files: [{ id: 'folder-1' }] }) },
            { match: (url) => isFileList(url, 'kanji-progress.pre-v8-backup.json'), respond: () => jsonResponse({ files: [{ id: 'backup-1' }] }) }, // already backed up
            {
                match: (url) => isFileList(url, 'kanji-progress.json'),
                respond: () => jsonResponse({
                    files: [
                        { id: 'dup-A', name: 'kanji-progress.json', modifiedTime: 'T1' },
                        { id: 'dup-B', name: 'kanji-progress.json', modifiedTime: 'T2' },
                    ],
                }),
            },
            {
                match: isContent,
                respond: (_count, url) => {
                    // downloadFileContent is called per-fileId; route by presence of the id in the URL.
                    if (url.includes('dup-A')) return jsonResponse(stored(fileA));
                    return jsonResponse(stored(fileB));
                },
            },
            {
                match: (url, method) => isTrash(url, method),
                respond: (_count, url) => {
                    const id = url.split('/files/')[1];
                    trashedIds.push(id);
                    return jsonResponse({});
                },
            },
            { match: isUpload, respond: () => jsonResponse({}) },
            { match: isMetadata, respond: () => jsonResponse({ modifiedTime: 'T-final' }) },
        ]));

        const sync = new GoogleDriveSync('token');
        const local = makeEnvelope(1);
        const result = await sync.sync(local);

        expect(result).not.toBeNull();
        // dup-A is the canonical (files[0]) - dup-B must be trashed, not dup-A.
        expect(trashedIds).toContain('dup-B');
        expect(trashedIds).not.toContain('dup-A');
        // Both duplicates' stats must survive the reconciliation (max-merged).
        expect(result!.envelope.progress.stats.totalReviews).toBeGreaterThanOrEqual(10);
        expect(result!.envelope.progress.stats.totalLearned).toBeGreaterThanOrEqual(5);
    });

    it('fast-forwards when remote is its own last write: no merge, no reconcile signal', async () => {
        const remoteEnvelope = makeEnvelope(5, { stats: { totalReviews: 10, totalLearned: 0, newLearnedToday: 0 } });
        // Serialized content of whatever the previous sync uploaded; null until then.
        let uploadedBody: ReturnType<typeof stored> | null = null;

        vi.stubGlobal('fetch', createFetchRouter(singleFileRoutes(() => uploadedBody ?? stored(remoteEnvelope))));

        const sync = new GoogleDriveSync('token');

        // First sync: remote has diverged content (totalReviews 10) -> full merge.
        const first = await sync.sync(makeEnvelope(1));
        expect(first!.pulledRemoteChanges).toBe(true);
        expect(first!.envelope.progress.stats.totalReviews).toBe(10);

        // Remote now serves back exactly what the first sync wrote.
        uploadedBody = stored(first!.envelope);

        // Second sync: a local-only change on top of the first result. Remote is
        // recognized as this client's own last write -> fast-forward, no merge.
        const localNext: SyncEnvelope = {
            progress: {
                ...first!.envelope.progress,
                stats: { ...first!.envelope.progress.stats, totalReviews: 11 },
            },
            settings: first!.envelope.settings,
        };
        const second = await sync.sync(localNext);

        expect(second!.pulledRemoteChanges).toBe(false);
        // Local content passed through untouched (no merge artifacts), version bumped.
        expect(second!.envelope.progress.stats.totalReviews).toBe(11);
        expect(second!.envelope.progress._sync!.version).toBeGreaterThan(first!.envelope.progress._sync!.version);
    });

    it('a normal sync RESURRECTS grammar entries deleted locally - the union merge cannot express a deletion', async () => {
        // Not a bug report against the merge, which is right to union for the case
        // it was built for (two devices each adding points). It is the reason a
        // scoped reset needs the authoritative path below: without it, clearing
        // grammar locally is undone by the very upload meant to publish it.
        const remoteEnvelope = makeEnvelope(5, {
            grammarQueue: [{ grammarId: 'n5-040', stage: 'learning', totalReviews: 3, entry: {} }],
        });

        vi.stubGlobal('fetch', createFetchRouter(singleFileRoutes(() => stored(remoteEnvelope))));

        const sync = new GoogleDriveSync('token');
        const cleared = makeEnvelope(6, { grammarQueue: [] });
        const result = await sync.sync(cleared);

        expect(result!.envelope.progress.grammarQueue).toHaveLength(1);
    });

    it('an authoritative sync publishes the deletion instead of merging it away', async () => {
        const remoteEnvelope = makeEnvelope(5, {
            grammarQueue: [{ grammarId: 'n5-040', stage: 'learning', totalReviews: 3, entry: {} }],
        });
        // A holder object, since TypeScript cannot see the callback below assign a plain variable.
        const upload: { body: { progress?: StoredProgress } | null } = { body: null };

        vi.stubGlobal('fetch', createFetchRouter(singleFileRoutes(() => stored(remoteEnvelope), async (_i, _url, init) => {
            // Capture what actually goes to Drive: the local check below
            // would pass even if the write still carried the old queue.
            upload.body = await uploadedFile(init);
            return jsonResponse({ id: 'file-1' });
        })));

        const sync = new GoogleDriveSync('token');
        const cleared = makeEnvelope(6, { grammarQueue: [] });
        const result = await sync.sync(cleared, { authoritative: true });

        expect(result!.envelope.progress.grammarQueue).toEqual([]);
        // And the remote write itself carries the empty queue.
        expect(upload.body?.progress?.grammarQueue).toEqual([]);
        // Not reported as a remote pull: nothing was taken from the remote copy,
        // so the UI must not reconcile (which would reload the active card).
        expect(result!.pulledRemoteChanges).toBe(false);
    });

    it('an authoritative sync leaves vocab and kanji alone', async () => {
        // The whole point of a SCOPED reset: only grammar is cleared.
        const remoteEnvelope = makeEnvelope(5, {
            grammarQueue: [{ grammarId: 'n5-040', stage: 'learning', totalReviews: 3, entry: {} }],
        });

        vi.stubGlobal('fetch', createFetchRouter(singleFileRoutes(() => stored(remoteEnvelope))));

        const sync = new GoogleDriveSync('token');
        const cleared = makeEnvelope(6, {
            grammarQueue: [],
            learningQueue: [{ vocabId: 'v-1' }],
        });
        const result = await sync.sync(cleared, { authoritative: true });

        expect(result!.envelope.progress.grammarQueue).toEqual([]);
        expect(result!.envelope.progress.learningQueue).toHaveLength(1);
        expect(result!.envelope.progress.kanjiKnowledge.kanjiSet).toEqual(new Set(['A']));
    });

    it('ensureRemoteBackupOnce uploads exactly once even if called multiple times', async () => {
        let backupListCallCount = 0;
        let backupUploadCount = 0;

        vi.stubGlobal('fetch', createFetchRouter([
            { match: isFolderSearch, respond: () => jsonResponse({ files: [{ id: 'folder-1' }] }) },
            {
                match: (url) => isFileList(url, 'kanji-progress.pre-v8-backup.json'),
                respond: () => {
                    backupListCallCount++;
                    // First call: no backup exists. After the first upload, pretend one now exists.
                    return jsonResponse({ files: backupUploadCount > 0 ? [{ id: 'backup-1' }] : [] });
                },
            },
            { match: (url) => isFileList(url, 'kanji-progress.json'), respond: () => jsonResponse({ files: [{ id: 'live-1', modifiedTime: 'T1' }] }) },
            { match: isContent, respond: () => jsonResponse(stored(makeEnvelope(1))) },
            {
                match: isUpload,
                respond: (_count, _url, init) => {
                    if (init?.method === 'POST') backupUploadCount++;
                    return jsonResponse({ id: 'backup-1' });
                },
            },
        ]));

        const sync = new GoogleDriveSync('token');
        await sync.ensureRemoteBackupOnce();
        await sync.ensureRemoteBackupOnce(); // second call should be a pure no-op (instance-level guard)

        expect(backupUploadCount).toBe(1);
        expect(backupListCallCount).toBe(1); // the instance-level `remoteBackupChecked` flag short-circuits the second call entirely
    });
});
