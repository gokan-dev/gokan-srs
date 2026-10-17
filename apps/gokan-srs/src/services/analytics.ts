/**
 * Custom events for Umami (the script tag is injected by vite.config.ts in production builds
 * only, see @gokan/analytics). Visits are counted by the script itself; these events separate
 * the people who actually study from everyone who opens the app.
 */

/** What the dashboard can report, beyond page views. */
export type AnalyticsEvent =
    /** A vocab or grammar session began: a learner, not just a visitor. */
    | { name: 'session_started'; data: { activity: 'vocab' | 'grammar' } };

interface UmamiTracker {
    track(name: string, data: Record<string, string>): void;
}

declare global {
    interface Window {
        /** Defined once the deferred Umami script has loaded; absent outside production. */
        umami?: UmamiTracker;
    }
}

/**
 * Events sent while the Umami script is still downloading. The app's module script runs before
 * the deferred tag, and a returning learner's dataset comes from the HTTP cache, so a reload or
 * the PWA opening on /quiz can start a session before `window.umami` exists: dropping those
 * would undercount exactly the regular learners the event is for.
 */
const queued: AnalyticsEvent[] = [];

/**
 * Registered once, when the app starts, so the script's `load` or `error` is never missed.
 * Without a tag (local, CI, staging) nothing is ever queued; a blocked script drops the queue.
 */
let waitingForScript = watchScript();

function watchScript(): boolean {
    // Unit tests import this module without a DOM.
    if (!('document' in globalThis)) return false;
    const script = document.querySelector('script[data-website-id]');
    if (!script || window.umami) return false;
    script.addEventListener(
        'load',
        () => {
            waitingForScript = false;
            for (const event of queued.splice(0)) send(event);
        },
        { once: true },
    );
    script.addEventListener(
        'error',
        () => {
            waitingForScript = false;
            queued.length = 0;
        },
        { once: true },
    );
    return true;
}

function send(event: AnalyticsEvent): void {
    window.umami?.track(event.name, event.data);
}

/** Sends the event now if the tracker is there, after the script loads if it is on its way. */
export function trackEvent(event: AnalyticsEvent): void {
    if (waitingForScript && !window.umami) queued.push(event);
    else send(event);
}
