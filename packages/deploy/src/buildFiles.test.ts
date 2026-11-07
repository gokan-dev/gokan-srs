import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashBuild, listFiles } from './buildFiles';

let dir = '';
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-files-'));
});
afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('listFiles', () => {
    it('lists every file, nested ones included, relative and forward-slash separated', () => {
        fs.mkdirSync(path.join(dir, 'vocab', '1'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), 'a');
        fs.writeFileSync(path.join(dir, 'vocab', '1', 'index.html'), 'b');
        fs.mkdirSync(path.join(dir, 'empty'));
        expect(listFiles(dir).sort()).toEqual(['index.html', 'vocab/1/index.html']);
    });
});

describe('hashBuild', () => {
    it('hashes two pages differing only in a hashed-asset reference apart by bytes, alike by content', () => {
        fs.mkdirSync(path.join(dir, 'a'));
        fs.mkdirSync(path.join(dir, 'b'));
        const page = (stylesheet: string): string => `<link rel="stylesheet" href="/assets/${stylesheet}"><p>本</p>`;
        fs.writeFileSync(path.join(dir, 'a', 'index.html'), page('app-1a2b.css'));
        fs.writeFileSync(path.join(dir, 'b', 'index.html'), page('app-3c4d.css'));

        const { files, hashes, content } = hashBuild(dir);
        expect(files).toEqual(listFiles(dir));
        expect(hashes['a/index.html']).not.toBe(hashes['b/index.html']);
        expect(content['a/index.html']).toBe(content['b/index.html']);
    });
});
