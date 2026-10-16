/**
 * Serving the two production builds the way CloudFront does (routes, SPA fallback, brotli), and the
 * one representative page per type that the browser checks measure. Shared by
 * scripts/check-layout.ts (each app on its own port, driven through onboarding) and
 * scripts/check-lighthouse.ts (both on one origin, the SRS at `/` and the dictionary under
 * `/dictionary/`, so Lighthouse sees the real URLs).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';

const ROOT = process.cwd();
const SRS_DIST = join(ROOT, 'apps/gokan-srs/dist');
const DICTIONARY_DIST = join(ROOT, 'apps/gokan-dictionary/dist');

export function buildMissing(): string | null {
    for (const [dist, app] of [[SRS_DIST, 'gokan-srs'], [DICTIONARY_DIST, 'gokan-dictionary']]) {
        if (!existsSync(join(dist, 'index.html'))) return `No build of ${app} in ${dist}. Build it first: bun run --cwd apps/${app} build`;
    }
    return null;
}

const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
    '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json',
};

/**
 * What CloudFront compresses: text types, from 1,000 bytes to 10 MB, for a browser that accepts
 * it. Served uncompressed, the SRS hub weighed 9 MB here against about 1.5 MB in production, and
 * Lighthouse timed that gap instead of the page (#134).
 */
const COMPRESSED_TYPES = new Set(['.html', '.js', '.css', '.json', '.svg', '.xml', '.txt', '.webmanifest']);
const COMPRESSED_SIZES = { min: 1_000, max: 10_000_000 };
/**
 * CloudFront compresses on the fly, well below brotli's best. Quality 3 lands within about 8% of
 * what it serves, on either side (measured 2026-10-14: `frequency.json` 380 KB here, 405 KB from
 * CloudFront; `library.json` 492 and 463 KB; the main bundle 133 and 123 KB), so the checks
 * neither flatter production nor penalise it. Quality 11 would give 267 KB for `frequency.json`.
 */
const BROTLI_QUALITY = 3;
const brotliCache = new Map<string, Buffer>();

function encodedBody(file: string, acceptEncoding: string): { body: Buffer; brotli: boolean } {
    const body = readFileSync(file);
    const compressible = COMPRESSED_TYPES.has(extname(file)) && body.length >= COMPRESSED_SIZES.min && body.length <= COMPRESSED_SIZES.max;
    if (!compressible || !/\bbr\b/.test(acceptEncoding)) return { body, brotli: false };
    let compressed = brotliCache.get(file);
    if (!compressed) {
        compressed = brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } });
        brotliCache.set(file, compressed);
    }
    return { body: compressed, brotli: true };
}

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();
/** A resolved path is inside `base`, so an encoded `..` in a request cannot escape the build. */
const within = (base: string, target: string) => {
    const [root, path] = [resolve(base), resolve(target)];
    return path === root || path.startsWith(root + sep);
};

/** The SRS answers every route with its index, as CloudFront's SPA fallback does. */
export function srsFile(pathname: string): string {
    const direct = join(SRS_DIST, pathname);
    return within(SRS_DIST, direct) && isFile(direct) ? direct : join(SRS_DIST, 'index.html');
}

/** The dictionary lives under `/dictionary/`; a directory serves its index.html, anything else 404s. */
export function dictionaryFile(pathname: string): string | null {
    if (!pathname.startsWith('/dictionary')) return null;
    const inside = pathname.slice('/dictionary'.length) || '/';
    const file = join(DICTIONARY_DIST, inside.endsWith('/') ? `${inside}index.html` : inside);
    return within(DICTIONARY_DIST, file) ? file : null;
}

/**
 * A static server. `resolve` maps a decoded request path to an absolute file, or null for a 404.
 * Port 0 picks a free one; pass a fixed port when the URLs are listed ahead of time.
 */
export function serve(resolve: (pathname: string) => string | null, port = 0): Promise<{ server: Server; port: number }> {
    const server = createServer((request, response) => {
        const file = resolve(decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname));
        if (!file || !isFile(file)) {
            response.writeHead(404).end('not found');
            return;
        }
        const { body, brotli } = encodedBody(file, String(request.headers['accept-encoding'] ?? ''));
        response.writeHead(200, {
            'content-type': MIME[extname(file)] ?? 'application/octet-stream',
            vary: 'accept-encoding',
            ...(brotli ? { 'content-encoding': 'br' } : {}),
        }).end(body);
    });
    return new Promise(done => server.listen(port, '127.0.0.1', () => done({ server, port: (server.address() as AddressInfo).port })));
}

/** One origin carrying both apps, as production does: the dictionary under `/dictionary/`, the SRS at the root. */
export function serveBoth(port = 0): Promise<{ server: Server; port: number }> {
    return serve(pathname => (pathname.startsWith('/dictionary') ? dictionaryFile(pathname) : srsFile(pathname)), port);
}

const firstEntry = (dir: string, filter: (name: string) => boolean) => readdirSync(dir).filter(filter).sort()[0];

/** One representative page per dictionary type (home, word, word list, kanji index, kanji, grammar index, grammar point). */
export function dictionaryPages(): { path: string; ready: string }[] {
    const grammarPoint = firstEntry(join(DICTIONARY_DIST, 'grammar'), name => /^n\d-/.test(name));
    const dictionaryVocab = firstEntry(join(DICTIONARY_DIST, 'vocab'), name => /^\d+$/.test(name));
    return [
        { path: '/', ready: 'Dictionary' },
        { path: `/vocab/${dictionaryVocab}/`, ready: 'Meanings' },
        { path: '/vocab/jlpt-n5/', ready: 'N5' },
        { path: '/kanji/', ready: 'Kanji' },
        { path: `/kanji/${encodeURIComponent('学')}/`, ready: 'In kanji courses' },
        { path: `/kanji/${encodeURIComponent('一')}/`, ready: 'Words with' },
        { path: '/grammar/', ready: 'Grammar' },
        { path: `/grammar/${grammarPoint}/`, ready: 'Grammar' },
    ];
}

/** The app after onboarding, at its main routes (each waits for a word the page always shows). */
export function srsRoutes(): { path: string; ready: string }[] {
    const vocabId = firstEntry(join(SRS_DIST, 'data/compiled/vocab'), name => name.endsWith('.json')).replace(/\.json$/, '');
    return [
        { path: '/', ready: 'Study' },
        { path: '/vocab', ready: 'Vocabulary' },
        // Its sentences load after the entry: waiting for them is what lets check-layout measure
        // the linked words in a sentence, not a page that has not rendered one yet.
        { path: `/vocab/${vocabId}`, ready: 'Example sentences' },
        { path: '/kanji', ready: 'Kanji learning method' },
        { path: `/kanji/${encodeURIComponent('学')}`, ready: 'Components' },
        { path: '/grammar/browse', ready: 'Grammar' },
        { path: '/listening', ready: 'Listening' },
        { path: '/stats', ready: 'Stats' },
        { path: '/settings', ready: 'Settings' },
    ];
}
