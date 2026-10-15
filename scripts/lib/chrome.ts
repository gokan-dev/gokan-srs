/**
 * A headless Chrome driven over the DevTools protocol with Bun's own WebSocket: Playwright's
 * transports do not work under Bun on Windows, and this needs nothing installed. Shared by
 * scripts/check-layout.ts (a tab per viewport, in its own browser context) and
 * scripts/check-lighthouse.ts (one tab in the default context, so the localStorage it seeds is the
 * storage Lighthouse then audits over `--port`).
 *
 * Chrome is found at the usual paths, or at CHROME_PATH.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

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

interface Message { id?: number; result?: unknown; error?: { message: string } }

export interface Tab {
    evaluate<T>(expression: string): Promise<T>;
    until(condition: string, what: string, timeout?: number): Promise<void>;
    goto(url: string, readyText: string): Promise<void>;
    /** Clicks the first button, summary or link whose text starts with `text`. */
    click(text: string): Promise<void>;
    close(): Promise<void>;
}

export interface Chrome {
    /** The DevTools port Lighthouse connects to with `--port`. */
    debugPort: number;
    /** A tab in its own browser context by default; `isolated: false` shares the default context's storage. */
    openTab(width: number, height: number, isolated?: boolean): Promise<Tab>;
    kill(): Promise<void>;
}

export async function launchChrome(): Promise<Chrome> {
    const chromePath = CHROME_CANDIDATES.find(candidate => candidate && existsSync(candidate));
    if (!chromePath) throw new Error('No Chrome or Chromium found. Install one, or set CHROME_PATH.');

    const profile = mkdtempSync(join(tmpdir(), 'gokan-chrome-'));
    const debugPort = 9300 + Math.floor(Math.random() * 500);
    const chrome = spawn(chromePath, [
        '--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--no-first-run',
        '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--no-sandbox', 'about:blank',
    ], { stdio: 'ignore' });
    const startup: { error: Error | null } = { error: null };
    chrome.once('error', error => { startup.error = error; });

    async function cleanUp(): Promise<void> {
        // Chrome holds its profile until it has exited (on Windows, a moment after the kill).
        if (chrome.exitCode === null && chrome.signalCode === null) {
            const exited = new Promise(resolve => chrome.once('exit', resolve));
            chrome.kill();
            await Promise.race([exited, sleep(5000)]);
        }
        try {
            rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
        } catch {
            console.warn(`[chrome] could not remove the temporary profile ${profile}`);
        }
    }

    // A cold CI runner can take well over 20 s to bring Chrome up: the old 20 s wait failed the
    // v1.25.0-rc.2 Lighthouse run with Chrome still starting, on a commit that passed twice (#134).
    // A Chrome that exits will never answer, so that fails at once instead of after the wait.
    const deadline = Date.now() + 60_000;
    let socketUrl: string | null = null;
    while (!socketUrl) {
        const failure = startup.error ? `could not start (${startup.error.message})`
            : chrome.exitCode !== null || chrome.signalCode !== null ? `exited (${chrome.exitCode ?? chrome.signalCode}) before opening its debugging port`
            : Date.now() > deadline ? 'did not open its debugging port within 60 s'
            : null;
        if (failure) {
            await cleanUp();
            throw new Error(`Chrome ${failure} (${chromePath}).`);
        }
        try {
            const version = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json() as { webSocketDebuggerUrl: string };
            socketUrl = version.webSocketDebuggerUrl;
        } catch {
            await sleep(250);
        }
    }

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

    async function openTab(width: number, height: number, isolated = true): Promise<Tab> {
        const context = isolated ? (await send<{ browserContextId: string }>('Target.createBrowserContext')).browserContextId : undefined;
        const { targetId } = await send<{ targetId: string }>('Target.createTarget', { url: 'about:blank', ...(context ? { browserContextId: context } : {}) });
        const { sessionId } = await send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });
        await send('Page.enable', {}, sessionId);
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true }, sessionId);

        const evaluate = async <T>(expression: string): Promise<T> => {
            const { result } = await send<{ result: { value: T } }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
            return result.value;
        };
        const until = async (condition: string, what: string, timeout = 30000): Promise<void> => {
            const end = Date.now() + timeout;
            while (Date.now() < end) {
                if (await evaluate<boolean>(`(() => { try { return Boolean(${condition}); } catch { return false; } })()`)) return;
                await sleep(200);
            }
            throw new Error(`timed out waiting for ${what}`);
        };
        const goto = async (url: string, readyText: string): Promise<void> => {
            await send('Page.navigate', { url }, sessionId);
            await until(`document.readyState === 'complete' && document.body.innerText.includes(${JSON.stringify(readyText)})`, `"${readyText}" on ${url}`);
            await sleep(300);
        };
        const click = async (text: string): Promise<void> => {
            const clicked = await evaluate<boolean>(`(() => {
                const el = [...document.querySelectorAll('button, summary, a')].find(e => e.textContent.trim().startsWith(${JSON.stringify(text)}));
                if (!el) return false;
                el.click();
                return true;
            })()`);
            if (!clicked) throw new Error(`nothing to click named "${text}"`);
            await sleep(400);
        };
        const close = async (): Promise<void> => {
            if (context) await send('Target.disposeBrowserContext', { browserContextId: context });
            else await send('Target.closeTarget', { targetId });
        };
        return { evaluate, until, goto, click, close };
    }

    async function kill(): Promise<void> {
        socket.close();
        await cleanUp();
    }

    return { debugPort, openTab, kill };
}
