import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { datasetVersion } from './datasetVersion';

describe('datasetVersion', () => {
    it('is the pinned dataset commit, 12 hex digits, from any directory of the repo', () => {
        const here = fileURLToPath(new URL('.', import.meta.url));
        const pinned = execFileSync('git', ['ls-tree', 'HEAD', 'apps/gokan-srs/dataset'], { cwd: fileURLToPath(new URL('../../..', import.meta.url)), encoding: 'utf8' }).split(/\s+/)[2];
        const version = datasetVersion(here);
        expect(version).toMatch(/^[0-9a-f]{12}$/);
        expect(pinned.startsWith(version)).toBe(true);
        expect(datasetVersion(fileURLToPath(new URL('../../../apps/gokan-dictionary/', import.meta.url)))).toBe(version);
    });
});
