/**
 * Serving the two production builds the way CloudFront does (routes, SPA fallback, brotli), and the
 * one representative page per type that the browser checks measure. Shared by
 * scripts/check-layout.ts (each app on its own port, driven through onboarding) and
 * scripts/check-lighthouse.ts (both on one origin, the SRS at `/` and the dictionary under
 * `/dictionary/`, so Lighthouse sees the real URLs).
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';
import { publishedDatasetFile } from '@gokan/deploy/published-dataset';
import { checkoutData } from '../../apps/gokan-dictionary/src/lib/dataset.server';
import { SERVED_LOCALES } from '../../apps/gokan-dictionary/src/lib/locale';
import { isDictionaryFilePath } from '../../apps/gokan-dictionary/src/lib/servedPaths';

const ROOT = process.cwd();
const SRS_DIST = join(ROOT, 'apps/gokan-srs/dist');
const DICTIONARY_DIST = join(ROOT, 'apps/gokan-dictionary/dist');
/** The dictionary's server (adapter-node), which renders the entity pages of an on-request build. */
const DICTIONARY_SERVER = join(ROOT, 'apps/gokan-dictionary/build/index.js');
/** The dataset the SRS reads from /dataset/: deployed on its own (the data site), so served here from the checkout. */
const DATASET_DIR = join(ROOT, 'apps/gokan-srs/dataset/compiled');

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

/** `body` as CloudFront sends it: brotli for a text type in the size range, when the browser accepts it. */
function compressed(body: Buffer, extension: string, acceptEncoding: string, cacheKey?: string): { body: Buffer; brotli: boolean } {
    const compressible = COMPRESSED_TYPES.has(extension) && body.length >= COMPRESSED_SIZES.min && body.length <= COMPRESSED_SIZES.max;
    if (!compressible || !/\bbr\b/.test(acceptEncoding)) return { body, brotli: false };
    let encoded = cacheKey === undefined ? undefined : brotliCache.get(cacheKey);
    if (!encoded) {
        encoded = brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } });
        if (cacheKey !== undefined) brotliCache.set(cacheKey, encoded);
    }
    return { body: encoded, brotli: true };
}

function encodedBody(file: string, acceptEncoding: string): { body: Buffer; brotli: boolean } {
    return compressed(readFileSync(file), extname(file), acceptEncoding, file);
}

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();
/** A resolved path is inside `base`, so an encoded `..` in a request cannot escape the build. */
const within = (base: string, target: string) => {
    const [root, path] = [resolve(base), resolve(target)];
    return path === root || path.startsWith(root + sep);
};

/**
 * A path naming a file, as CloudFront tells one: a dot in it (the /dictionary/*.* behavior; the
 * SRS's routing function looks at the last segment, where every SRS route has none).
 */
const namesFile = (pathname: string): boolean => (pathname.split('/').at(-1) ?? '').includes('.');

/**
 * The SRS as its routing function serves it (terraform/modules/spa-fallback): /dataset/ with the
 * published files, a file as itself or a 404, any other path (a route) with the app's index.
 */
export function srsFile(pathname: string): string | null {
    const dataset = publishedDatasetFile(pathname);
    if (dataset !== null && isFile(join(DATASET_DIR, dataset))) return join(DATASET_DIR, dataset);
    const direct = join(SRS_DIST, pathname);
    if (within(SRS_DIST, direct) && isFile(direct)) return direct;
    return namesFile(pathname) ? null : join(SRS_DIST, 'index.html');
}

/** The dictionary lives under `/dictionary/`; a directory serves its index.html, anything else 404s. */
export function dictionaryFile(pathname: string): string | null {
    if (!pathname.startsWith('/dictionary')) return null;
    const inside = pathname.slice('/dictionary'.length) || '/';
    const file = join(DICTIONARY_DIST, inside.endsWith('/') ? `${inside}index.html` : inside);
    return within(DICTIONARY_DIST, file) ? file : null;
}

/**
 * Where a request no file answers goes instead, as CloudFront sends a dictionary page (a path
 * with no dot, the /dictionary/* behavior) to the dictionary's server: its origin, or null for a
 * 404.
 */
export type Fallback = (pathname: string) => string | null;

/**
 * The request, answered by the server at `origin`: its status, type, cache-control and body,
 * compressed as CloudFront compresses a function's response.
 */
async function proxy(origin: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
    const upstream = await fetch(`${origin}${request.url ?? '/'}`, { redirect: 'manual' });
    const headers: Record<string, string> = { vary: 'accept-encoding' };
    for (const name of ['content-type', 'cache-control', 'location']) {
        const value = upstream.headers.get(name);
        if (value !== null) headers[name] = value;
    }
    const html = (headers['content-type'] ?? '').startsWith('text/html');
    const { body, brotli } = compressed(Buffer.from(await upstream.arrayBuffer()), html ? '.html' : '', String(request.headers['accept-encoding'] ?? ''));
    response.writeHead(upstream.status, { ...headers, ...(brotli ? { 'content-encoding': 'br' } : {}) }).end(body);
}

/**
 * A static server. `resolve` maps a decoded request path to an absolute file, or null for a 404;
 * `fallback`, when given, answers a path no file does. Port 0 picks a free one; pass a fixed port
 * when the URLs are listed ahead of time.
 */
export function serve(resolve: (pathname: string) => string | null, port = 0, fallback?: Fallback): Promise<{ server: Server; port: number }> {
    const server = createServer((request, response) => {
        const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
        // /dictionary/* does not match /dictionary: the routing function sends it there.
        if (pathname === '/dictionary') {
            response.writeHead(301, { location: '/dictionary/' }).end();
            return;
        }
        const file = resolve(pathname);
        if (!file || !isFile(file)) {
            const origin = fallback?.(pathname) ?? null;
            if (origin === null) response.writeHead(404).end('not found');
            else proxy(origin, request, response).catch((error: unknown) => response.writeHead(502).end(String(error)));
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
export function serveBoth(port = 0, fallback?: Fallback): Promise<{ server: Server; port: number }> {
    return serve(pathname => (pathname.startsWith('/dictionary') ? dictionaryFile(pathname) : srsFile(pathname)), port, fallback);
}

/**
 * Both apps on one origin, as production serves them, whichever way the dictionary was built: its
 * static files alone, or with its server behind them (serveDictionaryOnRequest). `stop` ends it.
 */
export async function serveProduction(port = 0): Promise<{ port: number; stop: () => void }> {
    if (dictionaryOnRequest()) return serveDictionaryOnRequest(port);
    const { server, port: listening } = await serveBoth(port);
    return { port: listening, stop: () => { server.close(); } };
}

/** Whether the dictionary's build renders its entity pages on request: its server built, and no word page in dist/. */
export function dictionaryOnRequest(): boolean {
    return existsSync(DICTIONARY_SERVER) && !readdirSync(join(DICTIONARY_DIST, 'vocab')).some(name => /^\d+$/.test(name));
}

/**
 * Production's dictionary, locally, routed as CloudFront routes it (terraform, #209): both apps
 * on one origin, a dictionary file (a path with a dot) from dist/, a dictionary page (any other
 * path) from its server (build/, an on-request build), which renders the entity pages and serves
 * the prerendered list pages from its own bundle. The server reads the published dataset and the
 * search index from this same origin, as the function reads them through CloudFront. `stop` ends
 * both.
 */
export async function serveDictionaryOnRequest(port = 0): Promise<{ port: number; stop: () => void }> {
    let serverOrigin: string | null = null;
    // Routed by the rule the build is held to, so this stand-in cannot drift from CloudFront.
    const isDictionaryFile = (pathname: string) => isDictionaryFilePath(pathname.slice('/dictionary/'.length));
    const site = await serve(
        pathname => (pathname.startsWith('/dictionary') ? (isDictionaryFile(pathname) ? dictionaryFile(pathname) : null) : srsFile(pathname)),
        port,
        pathname => (pathname.startsWith('/dictionary/') && !isDictionaryFile(pathname) ? serverOrigin : null),
    );
    const probe = await serve(() => null);
    const serverPort = probe.port;
    probe.server.close();
    // Node, as in production (the function's runtime), whatever runs this script.
    const child = spawn('node', [DICTIONARY_SERVER], {
        env: { ...process.env, HOST: '127.0.0.1', PORT: String(serverPort), DATASET_ORIGIN: `http://127.0.0.1:${site.port}` },
        stdio: ['ignore', 'inherit', 'inherit'],
    });
    const origin = `http://127.0.0.1:${serverPort}`;
    for (let attempt = 0; ; attempt++) {
        try {
            await fetch(`${origin}/search/`);
            break;
        } catch (error) {
            if (attempt > 100 || child.exitCode !== null) throw new Error(`The dictionary's server did not start at ${origin}: ${String(error)}`);
            await new Promise(done => setTimeout(done, 100));
        }
    }
    serverOrigin = origin;
    return { port: site.port, stop: () => { child.kill(); site.server.close(); } };
}

const firstEntry = (dir: string, filter: (name: string) => boolean) => readdirSync(dir).filter(filter).sort()[0];

/**
 * The first word with a Chinese page (the dictionary's own answer, LocaleText.wordText), when the
 * build serves Chinese (VITE_DICTIONARY_LOCALES, as the build reads it): measured as English's
 * word page is, from the first sprint of #170 on.
 */
async function chineseWordPages(): Promise<{ path: string; ready: string }[]> {
    if (!SERVED_LOCALES.includes('zh-hans')) return [];
    const text = checkoutData(DATASET_DIR, 'zh-hans').localeText;
    if (text === null) throw new Error('A zh-hans checkout reads no Chinese text.');
    const id = await text.firstWordId();
    if (id !== null) return [{ path: `/zh-hans/vocab/${id}/`, ready: 'Meanings' }];
    throw new Error('The dataset has no word with Chinese text shown, but the build serves zh-hans.');
}

/**
 * One representative page per dictionary type (home, word, word list, kanji index, kanji, grammar
 * index, grammar point), and a Chinese word page when the build serves Chinese. The word and the
 * point are the dataset's first, which have a page in either build: prerendered in dist/, or
 * rendered on request.
 */
export async function dictionaryPages(): Promise<{ path: string; ready: string }[]> {
    const grammarPoint = firstEntry(join(DATASET_DIR, 'grammar', 'points'), name => /^n\d-.*\.json$/.test(name)).replace(/\.json$/, '');
    const dictionaryVocab = firstEntry(join(DATASET_DIR, 'vocab'), name => /^\d+\.json$/.test(name)).replace(/\.json$/, '');
    return [
        { path: '/', ready: 'Dictionary' },
        { path: `/vocab/${dictionaryVocab}/`, ready: 'Meanings' },
        { path: '/vocab/jlpt-n5/', ready: 'N5' },
        { path: '/kanji/', ready: 'Kanji' },
        { path: `/kanji/${encodeURIComponent('学')}/`, ready: 'In kanji courses' },
        { path: `/kanji/${encodeURIComponent('一')}/`, ready: 'Words with' },
        { path: '/kanji/orders/', ready: 'Vocabulary by kanji learning order' },
        { path: '/kanji/orders/kklc/', ready: 'Steps 1 to 100' },
        // The heaviest range page (check-build): the most words to lay out.
        { path: '/kanji/orders/jlpt/301-400/', ready: 'Words by step' },
        { path: '/grammar/', ready: 'Grammar' },
        { path: `/grammar/${grammarPoint}/`, ready: 'Grammar' },
        ...(await chineseWordPages()),
    ];
}

/**
 * The app after onboarding, at its main routes. Each waits for a word the page always shows, and
 * `settled`, a selector, when part of the page loads after that word.
 */
export function srsRoutes(): { path: string; ready: string; settled?: string }[] {
    const vocabId = firstEntry(join(DATASET_DIR, 'vocab'), name => name.endsWith('.json')).replace(/\.json$/, '');
    return [
        { path: '/', ready: 'Study' },
        { path: '/vocab', ready: 'Vocabulary' },
        // Its sentences load after the entry: waiting for them (loaded or failed, so a word with no
        // English sentence settles too) is what lets check-layout measure the linked words in a
        // sentence, not a page that has not rendered one yet.
        { path: `/vocab/${vocabId}`, ready: 'Meanings', settled: '[data-sentences="settled"]' },
        { path: '/kanji', ready: 'Kanji learning method' },
        { path: `/kanji/${encodeURIComponent('学')}`, ready: 'Components' },
        { path: '/grammar/browse', ready: 'Grammar' },
        { path: '/listening', ready: 'Listening' },
        { path: '/stats', ready: 'Stats' },
        { path: '/settings', ready: 'Settings' },
        // Its list loads from /changelog.json after the page: the marked entry is in it.
        { path: '/whats-new', ready: 'Your version' },
    ];
}

/**
 * The version the gokan-srs build baked in, from the version.json it wrote beside it: what the
 * footer and About must show, and what an open tab compares against.
 */
export function srsVersion(): string {
    const body: unknown = JSON.parse(readFileSync(join(SRS_DIST, 'version.json'), 'utf-8'));
    const version = typeof body === 'object' && body !== null && 'version' in body ? body.version : undefined;
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('The gokan-srs build wrote no version in version.json.');
    return version;
}

/**
 * Two listening titles of more than one episode, for the library rows that show a status: the
 * first is marked watched in full (Completed), the second for one episode (Watching).
 */
export function listeningTitlesToMark(): [completed: string, watching: string] {
    const index: unknown = JSON.parse(readFileSync(join(DATASET_DIR, 'media/index.json'), 'utf-8'));
    const ids = (Array.isArray(index) ? index : []).flatMap((entry: unknown) =>
        typeof entry === 'object' && entry !== null && 'id' in entry && typeof entry.id === 'string'
            && 'episodeCount' in entry && typeof entry.episodeCount === 'number' && entry.episodeCount > 1 ? [entry.id] : []);
    if (ids.length < 2) throw new Error('The listening library has fewer than two titles of several episodes.');
    return [ids[0], ids[1]];
}
