import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { englishView } from '@gokan/dataset-schema/english';
import { datasetPathOf } from '../test/datasetFiles';
import { fetchDatasetFile } from './http';

// The app's loader against the file it read until now. Until #211 the build wrote
// englishView(compiled/).json(file) into public/data/compiled/ and the app fetched that; now it
// fetches the published inputs from /dataset/ and builds the file itself. For every file of that
// view (a superset of what the app loads), the loader's file, over the checkout's published files,
// equals the view's. With gokan-dataset's check:english, the app sees exactly what it saw before.
const COMPILED = fileURLToPath(new URL('../../dataset/compiled/', import.meta.url));
const view = englishView(COMPILED);

// Reading every file twice (about 70k files, their core and their text) is the whole cost: a
// hang guard sized for a slow disk, not a loosening, since every file is still compared.
const WHOLE_DATASET_TIMEOUT_MS = 300_000;

beforeAll(() => {
    vi.stubGlobal('fetch', (url: string) => {
        try {
            return Promise.resolve(new Response(readFileSync(join(COMPILED, datasetPathOf(url)))));
        } catch {
            return Promise.resolve(new Response('', { status: 404, statusText: 'Not Found' }));
        }
    });
});
afterAll(() => { vi.unstubAllGlobals(); });

describe('fetchDatasetFile over the published dataset', () => {
    it('gives every file exactly as the English view the app read until now', { timeout: WHOLE_DATASET_TIMEOUT_MS }, async () => {
        const files = view.files().filter(file => file.endsWith('.json'));
        expect(files.length).toBeGreaterThan(60_000);
        const differing: string[] = [];
        // In batches: all at once would hold every file in memory twice.
        for (let start = 0; start < files.length; start += 500) {
            await Promise.all(files.slice(start, start + 500).map(async file => {
                if (!isDeepStrictEqual(await fetchDatasetFile<unknown>(file), view.json(file))) differing.push(file);
            }));
        }
        expect(differing).toEqual([]);
    });
});
