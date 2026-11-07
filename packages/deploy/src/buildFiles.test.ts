import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listFiles } from './buildFiles';

describe('listFiles', () => {
    let dir = '';
    afterEach(() => {
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    it('lists every file, nested ones included, relative and forward-slash separated', () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-files-'));
        fs.mkdirSync(path.join(dir, 'vocab', '1'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), 'a');
        fs.writeFileSync(path.join(dir, 'vocab', '1', 'index.html'), 'b');
        fs.mkdirSync(path.join(dir, 'empty'));
        expect(listFiles(dir).sort()).toEqual(['index.html', 'vocab/1/index.html']);
    });
});
