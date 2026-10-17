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
 * Sends the event if the tracker is there. It is absent outside production, and when a
 * content blocker removed it; an event before the deferred script loads is dropped, which
 * costs nothing here because a session cannot start before the dataset has loaded.
 */
export function trackEvent(event: AnalyticsEvent): void {
    window.umami?.track(event.name, event.data);
}
