/**
 * The layout rules no static check can see (AGENTS.md, Design rules; docs/DESIGN_SYSTEM.md),
 * measured in a real browser on both production builds at phone widths (320 and 375px):
 *
 * - no page scrolls sideways;
 * - no text below the 12px floor (furigana, in `rt`, and SVG chart labels excepted);
 * - every text input is at least 16px, or iOS zooms into it on focus;
 * - the dictionary's nav links, pager links, toggles, tiles and disclosure summaries are at
 *   least 44px tall.
 *
 * Usage: build both apps (`bun run --cwd apps/gokan-srs build`, `bun run --cwd
 * apps/gokan-dictionary build`), then `bun run check:layout`. Needs Chrome or Chromium: found at
 * the usual paths, or named by CHROME_PATH. Run by CI (.github/workflows/ci-layout.yml).
 *
 * Chrome is driven over the DevTools protocol with Bun's own WebSocket: Playwright's transports
 * do not work under Bun on Windows, and this needs nothing installed.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = process.cwd();
const SRS_DIST = join(ROOT, 'apps/gokan-srs/dist');
const DICTIONARY_DIST = join(ROOT, 'apps/gokan-dictionary/dist');
const VIEWPORTS = [{ width: 320, height: 720 }, { width: 375, height: 812 }];

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

function fail(message: string): never {
    console.error(`[check-layout] ${message}`);
    process.exit(1);
}

for (const [dist, app] of [[SRS_DIST, 'gokan-srs'], [DICTIONARY_DIST, 'gokan-dictionary']]) {
    if (!existsSync(join(dist, 'index.html'))) fail(`No build of ${app} in ${dist}. Build it first: bun run --cwd apps/${app} build`);
}
const chromePath = CHROME_CANDIDATES.find(candidate => candidate && existsSync(candidate));
if (!chromePath) fail('No Chrome or Chromium found. Install one, or set CHROME_PATH.');

// -- Static servers for the two builds -----------------------------------------------------------

const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
    '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json',
};

/**
 * A static server for one build. `resolve` maps a decoded request path to a file under `dist`, or
 * null for a 404; the SRS answers every route with its index, as CloudFront's fallback does.
 */
function serve(dist: string, resolve: (pathname: string) => string | null): Promise<{ server: Server; port: number }> {
    const server = createServer((request, response) => {
        const pathname = resolve(decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname));
        const file = pathname === null ? null : join(dist, pathname);
        if (!file || !existsSync(file) || !statSync(file).isFile()) {
            response.writeHead(404).end('not found');
            return;
        }
        response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as AddressInfo).port })));
}
const isFile = (dist: string, pathname: string) => existsSync(join(dist, pathname)) && statSync(join(dist, pathname)).isFile();
const srs = await serve(SRS_DIST, pathname => (isFile(SRS_DIST, pathname) ? pathname : 'index.html'));
const dictionary = await serve(DICTIONARY_DIST, pathname => {
    if (!pathname.startsWith('/dictionary')) return null;
    const inside = pathname.slice('/dictionary'.length) || '/';
    return inside.endsWith('/') ? `${inside}index.html` : inside;
});

// -- A minimal DevTools protocol client -----------------------------------------------------------

const profile = mkdtempSync(join(tmpdir(), 'gokan-layout-'));
const debugPort = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(chromePath, [
    '--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--no-sandbox', 'about:blank',
], { stdio: 'ignore' });

interface Message { id?: number; result?: unknown; error?: { message: string } }
let socketUrl: string | null = null;
for (let attempt = 0; attempt < 80 && !socketUrl; attempt++) {
    try {
        const version = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json() as { webSocketDebuggerUrl: string };
        socketUrl = version.webSocketDebuggerUrl;
    } catch {
        await sleep(250);
    }
}
if (!socketUrl) fail(`Chrome did not open its debugging port (${chromePath}).`);
const socket = new WebSocket(socketUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let nextId = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data)) as Message;
    if (message.id === undefined) return;
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter?.reject(new Error(message.error.message));
    else waiter?.resolve(message.result);
});
function send<T>(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<T> {
    const id = ++nextId;
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => pending.set(id, { resolve: value => resolve(value as T), reject }));
}

class Tab {
    private constructor(private readonly session: string, private readonly context: string) {}

    static async open(width: number, height: number): Promise<Tab> {
        const { browserContextId } = await send<{ browserContextId: string }>('Target.createBrowserContext');
        const { targetId } = await send<{ targetId: string }>('Target.createTarget', { url: 'about:blank', browserContextId });
        const { sessionId } = await send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });
        await send('Page.enable', {}, sessionId);
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true }, sessionId);
        return new Tab(sessionId, browserContextId);
    }

    async evaluate<T>(expression: string): Promise<T> {
        const { result } = await send<{ result: { value: T } }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, this.session);
        return result.value;
    }

    async until(condition: string, what: string, timeout = 30000): Promise<void> {
        const end = Date.now() + timeout;
        while (Date.now() < end) {
            if (await this.evaluate<boolean>(`(() => { try { return Boolean(${condition}); } catch { return false; } })()`)) return;
            await sleep(200);
        }
        throw new Error(`timed out waiting for ${what}`);
    }

    async goto(url: string, readyText: string): Promise<void> {
        await send('Page.navigate', { url }, this.session);
        await this.until(`document.readyState === 'complete' && document.body.innerText.includes(${JSON.stringify(readyText)})`, `"${readyText}" on ${url}`);
        await sleep(300);
    }

    /** Clicks the first button, summary or link whose text starts with `text`. */
    async click(text: string): Promise<void> {
        const clicked = await this.evaluate<boolean>(`(() => {
            const el = [...document.querySelectorAll('button, summary, a')].find(e => e.textContent.trim().startsWith(${JSON.stringify(text)}));
            if (!el) return false;
            el.click();
            return true;
        })()`);
        if (!clicked) throw new Error(`nothing to click named "${text}"`);
        await sleep(400);
    }

    close(): Promise<unknown> {
        return send('Target.disposeBrowserContext', { browserContextId: this.context });
    }
}

// -- The measurements -----------------------------------------------------------------------------

/**
 * Runs in the page; returns one line per broken rule. Widths are measured against the device's,
 * not innerWidth: on a phone, content wider than the screen widens the layout viewport (the page
 * is zoomed out, every text shrinks), so innerWidth grows with it and hides the overflow.
 */
const MEASURE = (deviceWidth: number, tapTargets: string) => `(() => {
    const problems = [];
    const describe = el => (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '') + ' "' + (el.textContent || el.placeholder || '').trim().slice(0, 30) + '"');
    const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const overflow = document.documentElement.scrollWidth - ${deviceWidth};
    if (overflow > 1) {
        const wide = [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > ${deviceWidth} + 1 && visible(el)).slice(-3).map(describe);
        problems.push('scrolls sideways by ' + overflow + 'px (widest: ' + wide.join(', ') + ')');
    }
    const small = [];
    for (const el of document.querySelectorAll('body *')) {
        if (el.closest('rt, svg') || !visible(el)) continue;
        const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (hasText && parseFloat(getComputedStyle(el).fontSize) < 12) small.push(describe(el) + ' ' + getComputedStyle(el).fontSize);
    }
    if (small.length) problems.push('text below 12px: ' + small.slice(0, 4).join(', ') + (small.length > 4 ? ' (+' + (small.length - 4) + ')' : ''));
    const inputs = [...document.querySelectorAll('input, textarea, select')]
        .filter(el => !['checkbox', 'radio', 'range', 'hidden', 'button', 'submit'].includes(el.type) && visible(el) && parseFloat(getComputedStyle(el).fontSize) < 16);
    if (inputs.length) problems.push('input below 16px (iOS zooms in): ' + inputs.slice(0, 3).map(el => describe(el) + ' ' + getComputedStyle(el).fontSize).join(', '));
    const short = ${JSON.stringify(tapTargets)} ? [...document.querySelectorAll(${JSON.stringify(tapTargets)})].filter(el => visible(el) && el.getBoundingClientRect().height < 43.5) : [];
    if (short.length) problems.push('tap target under 44px: ' + short.slice(0, 3).map(el => describe(el) + ' ' + Math.round(el.getBoundingClientRect().height) + 'px').join(', '));
    return problems;
})()`;

const DICTIONARY_TAP_TARGETS = '.site-nav a, .pager a, summary, .kanji-tiles a, button.button';

const failures: string[] = [];
let checked = 0;
async function measure(tab: Tab, page: string, width: number, tapTargets = ''): Promise<void> {
    checked++;
    for (const problem of await tab.evaluate<string[]>(MEASURE(width, tapTargets))) failures.push(`${width}px ${page}: ${problem}`);
}

const firstEntry = (dir: string, filter: (name: string) => boolean) => readdirSync(dir).filter(filter).sort()[0];
const vocabId = firstEntry(join(SRS_DIST, 'data/compiled/vocab'), name => name.endsWith('.json')).replace(/\.json$/, '');
const grammarPoint = firstEntry(join(DICTIONARY_DIST, 'grammar'), name => /^n\d-/.test(name));
const dictionaryVocab = firstEntry(join(DICTIONARY_DIST, 'vocab'), name => /^\d+$/.test(name));

const DICTIONARY_PAGES: { path: string; ready: string }[] = [
    { path: '/', ready: 'Dictionary' },
    { path: `/vocab/${dictionaryVocab}/`, ready: 'Meanings' },
    { path: '/vocab/jlpt-n5/', ready: 'N5' },
    { path: '/kanji/', ready: 'Kanji' },
    { path: `/kanji/${encodeURIComponent('学')}/`, ready: 'In kanji courses' },
    { path: `/kanji/${encodeURIComponent('一')}/`, ready: 'Words with' },
    { path: '/grammar/', ready: 'Grammar' },
    { path: `/grammar/${grammarPoint}/`, ready: 'Grammar' },
];

/** The app after onboarding, at its main routes (each waits for a word the page always shows). */
const SRS_ROUTES: { path: string; ready: string }[] = [
    { path: '/', ready: 'Study' },
    { path: '/vocab', ready: 'Vocabulary' },
    { path: `/vocab/${vocabId}`, ready: 'Meanings' },
    { path: '/kanji', ready: 'Kanji learning method' },
    { path: `/kanji/${encodeURIComponent('学')}`, ready: 'Components' },
    { path: '/grammar/browse', ready: 'Grammar' },
    { path: '/listening', ready: 'Listening' },
    { path: '/stats', ready: 'Stats' },
    { path: '/settings', ready: 'Settings' },
];

try {
    for (const { width, height } of VIEWPORTS) {
        const tab = await Tab.open(width, height);
        const app = `http://127.0.0.1:${srs.port}`;
        await tab.goto(`${app}/`, 'I already know some kanji');
        await measure(tab, 'srs /welcome', width);
        await tab.click('I already know some kanji');
        await tab.until(`document.body.innerText.includes('Kanji learning method')`, 'the setup screen');
        await measure(tab, 'srs /setup', width);
        await tab.click('More methods');
        await measure(tab, 'srs /setup, every method', width);
        await tab.click('Start learning');
        for (const route of SRS_ROUTES) {
            await tab.goto(`${app}${route.path}`, route.ready);
            await measure(tab, `srs ${route.path}`, width);
        }
        for (const page of DICTIONARY_PAGES) {
            await tab.goto(`http://127.0.0.1:${dictionary.port}/dictionary${page.path}`, page.ready);
            await measure(tab, `dictionary ${page.path}`, width, DICTIONARY_TAP_TARGETS);
        }
        await tab.close();
    }
} catch (error) {
    failures.push(`could not finish: ${error instanceof Error ? error.message : String(error)}`);
} finally {
    socket.close();
    // Chrome holds its profile until it has exited (on Windows, a moment after the kill).
    const exited = new Promise(resolve => chrome.once('exit', resolve));
    chrome.kill();
    await Promise.race([exited, sleep(5000)]);
    srs.server.close();
    dictionary.server.close();
    try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
        console.warn(`[check-layout] could not remove the temporary profile ${profile}`);
    }
}

if (failures.length) {
    for (const failure of failures) console.error(`[check-layout] ${failure}`);
    fail(`${failures.length} layout problem(s) in ${checked} pages. See docs/DESIGN_SYSTEM.md; fix the page, never the check.`);
}
console.log(`[check-layout] ${checked} pages at ${VIEWPORTS.map(v => `${v.width}px`).join(' and ')}: no sideways scroll, nothing under 12px, inputs 16px, tap targets 44px.`);
