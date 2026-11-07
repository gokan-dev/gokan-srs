// The one walk of a built dist/: the deploy (scripts/deploy-s3.ts) uploads from it, and the
// dictionary's `check:parity` compares two builds by it. Shared so the two never disagree about
// which files a build holds (one skipping a directory the other uploads).

import fs from 'node:fs';
import path from 'node:path';

/** Every file under `dir`, as POSIX-separated paths relative to it (the keys a deploy uploads to). */
export function listFiles(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) walk(full);
            else out.push(path.relative(dir, full).split(path.sep).join('/'));
        }
    };
    walk(dir);
    return out;
}
