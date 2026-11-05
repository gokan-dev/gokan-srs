import fs from 'fs';
import path from 'path';
import { englishView } from '@gokan/dataset-schema/english';

// The compiled dataset lives in the gokan-dataset submodule (apps/gokan-srs/dataset), not in
// this repo. This writes its English view into public/data/compiled, so Vite's public-dir
// passthrough and the runtime fetch('/data/compiled/...') calls keep working unchanged: the
// dataset keeps each file's text apart from its core, per language, and this app reads English
// only, in the shape it was written for. Only English is written, so no other language's text is
// shipped or uploaded. Run automatically before dev/build (see package.json); not committed.

const SRC = path.join(__dirname, '..', 'dataset', 'compiled');
const DEST = path.join(__dirname, '..', 'public', 'data', 'compiled');
// Outside DEST (and outside public/ entirely) so it's never swept up by Vite's
// public-dir passthrough into dist/ and deployed - this is a build-time cache
// marker, not app data.
const MARKER = path.join(__dirname, '..', 'node_modules', '.cache', 'sync-dataset-signature');

if (!fs.existsSync(SRC)) {
    console.error(
        `[sync-dataset] Submodule not found at ${SRC}.\n` +
        `Run: git submodule update --init --recursive`
    );
    process.exit(1);
}

// A cheap staleness signature: the latest mtime across every file in SRC. Only
// stats files (no content reads), so it's fast even across tens of thousands
// of small files - orders of magnitude cheaper than the full write this guards.
// Catches real rebuilds (the dataset's layout stage rewrites compiled/) but won't
// notice a file being deleted from SRC without anything else changing. If that
// ever happens (or you just don't trust the cache), delete public/data/compiled
// to force a full resync.
function latestMtimeMs(dir: string): number {
    let latest = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        latest = Math.max(latest, entry.isDirectory() ? latestMtimeMs(full) : fs.statSync(full).mtimeMs);
    }
    return latest;
}

const signature = String(latestMtimeMs(SRC));

if (fs.existsSync(DEST) && fs.existsSync(MARKER) && fs.readFileSync(MARKER, 'utf-8') === signature) {
    console.log('[sync-dataset] Already up to date, skipping.');
    process.exit(0);
}

fs.rmSync(DEST, { recursive: true, force: true });
const view = englishView(SRC);
let written = 0;
for (const relative of view.files()) {
    const target = path.join(DEST, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (relative.endsWith('.json')) fs.writeFileSync(target, JSON.stringify(view.json(relative)));
    else fs.copyFileSync(path.join(SRC, relative), target);
    written++;
}
fs.mkdirSync(path.dirname(MARKER), { recursive: true });
fs.writeFileSync(MARKER, signature);

console.log(`[sync-dataset] Wrote the English view of ${SRC} (${written} files) -> ${DEST}`);
