import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const event = { name: 'session_started', data: { activity: 'vocab' } } as const;

let script: EventTarget | null;
let win: { umami?: { track: (name: string, data: Record<string, string>) => void } };

/** The module watches the tag when it is first evaluated, so each test imports it afresh. */
async function loadAnalytics() {
    vi.resetModules();
    return import('./analytics');
}

beforeEach(() => {
    script = new EventTarget();
    win = {};
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', { querySelector: () => script });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('trackEvent', () => {
    it('queues an event sent before the Umami script loads, and sends it once on load', async () => {
        const { trackEvent } = await loadAnalytics();
        trackEvent(event);
        const track = vi.fn();
        win.umami = { track };
        expect(track).not.toHaveBeenCalled();
        script?.dispatchEvent(new Event('load'));
        expect(track).toHaveBeenCalledExactlyOnceWith('session_started', { activity: 'vocab' });
        script?.dispatchEvent(new Event('load'));
        expect(track).toHaveBeenCalledOnce();
    });

    it('sends at once when the tracker is already there', async () => {
        const track = vi.fn();
        win.umami = { track };
        const { trackEvent } = await loadAnalytics();
        trackEvent(event);
        expect(track).toHaveBeenCalledExactlyOnceWith('session_started', { activity: 'vocab' });
    });

    it('sends at once after the script has loaded', async () => {
        const { trackEvent } = await loadAnalytics();
        const track = vi.fn();
        win.umami = { track };
        script?.dispatchEvent(new Event('load'));
        trackEvent(event);
        expect(track).toHaveBeenCalledOnce();
    });

    it('drops the queue when the script fails to load', async () => {
        const { trackEvent } = await loadAnalytics();
        trackEvent(event);
        script?.dispatchEvent(new Event('error'));
        const track = vi.fn();
        win.umami = { track };
        script?.dispatchEvent(new Event('load'));
        expect(track).not.toHaveBeenCalled();
    });

    it('queues nothing on a page without the tag', async () => {
        script = null;
        const { trackEvent } = await loadAnalytics();
        expect(() => {
            trackEvent(event);
        }).not.toThrow();
        const track = vi.fn();
        win.umami = { track };
        trackEvent(event);
        expect(track).toHaveBeenCalledExactlyOnceWith('session_started', { activity: 'vocab' });
    });
});
