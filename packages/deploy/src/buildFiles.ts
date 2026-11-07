// The one walk and hashing of a built dist/: the deploy (scripts/deploy-s3.ts) uploads from it,
// and the dictionary's `check:parity` compares two builds by it. Shared so the two never disagree
// about which files a build holds (one skipping a directory the other uploads), or about what
// counts as a page's content changing (parity's "content changed" is the deploy's).

import fs from 'node:fs';
import path from 'node:path';

import { contentHash, pageContentHash, type BuildManifest } from './deployManifest';

/**
 * Every file under `dir`, as POSIX-separated paths relative to it (the keys a deploy uploads to),
 * keeping only those `include` accepts when it is given (a site's `include`, deployManifest.ts).
 */
export function listFiles(dir: string, include?: (file: string) => boolean): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) walk(full);
            else out.push(path.relative(dir, full).split(path.sep).join('/'));
        }
    };
    walk(dir);
    return include ? out.filter(include) : out;
}

/** A built dist/: its files (`listFiles`), each one's upload hash and its page content hash. */
export interface BuildHashes {
    files: string[];
    hashes: BuildManifest;
    content: BuildManifest;
}

/** Every file under `dir`, hashed by bytes (`contentHash`) and by content (`pageContentHash`), from one read of each. */
export function hashBuild(dir: string, include?: (file: string) => boolean): BuildHashes {
    const files = listFiles(dir, include);
    const hashes: BuildManifest = {};
    const content: BuildManifest = {};
    for (const file of files) {
        const bytes = fs.readFileSync(path.join(dir, file));
        hashes[file] = contentHash(bytes);
        content[file] = pageContentHash(file, bytes);
    }
    return { files, hashes, content };
}
