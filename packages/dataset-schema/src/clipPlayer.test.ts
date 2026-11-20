import { describe, expect, it, vi } from 'vitest';
import { createClipPlayer, type PlayableClip } from './clipPlayer';

/** A fake audio element: `play()` resolves (or rejects) when the test says, `ended` fires on demand. */
class FakeClip implements PlayableClip {
    paused = false;
    private listeners: Record<string, (() => void)[]> = {};
    readonly url: string;
    private readonly playResult: Promise<void>;
    constructor(url: string, playResult: Promise<void> = Promise.resolve()) {
        this.url = url;
        this.playResult = playResult;
    }
    play() { return this.playResult; }
    pause() { this.paused = true; }
    addEventListener(type: 'ended' | 'error', listener: () => void) { (this.listeners[type] ??= []).push(listener); }
    fire(type: 'ended' | 'error') { for (const listener of this.listeners[type] ?? []) listener(); }
}

function setup(playResult?: () => Promise<void>) {
    const opened: FakeClip[] = [];
    const player = createClipPlayer({
        urlOf: clip => Promise.resolve(`/audio/${clip}.opus`),
        open: url => {
            const clip = new FakeClip(url, playResult?.());
            opened.push(clip);
            return clip;
        },
    });
    return { player, opened };
}

describe('createClipPlayer', () => {
    it('opens a clip only when it is pressed', async () => {
        const { player, opened } = setup();
        expect(opened).toHaveLength(0);
        await player.toggle('a');
        expect(opened.map(c => c.url)).toEqual(['/audio/a.opus']);
        expect(player.playing()).toBe('a');
    });

    it('plays one clip at a time: a second press elsewhere stops the first', async () => {
        const { player, opened } = setup();
        await player.toggle('a');
        await player.toggle('b');
        expect(opened[0].paused).toBe(true);
        expect(player.playing()).toBe('b');
    });

    it('stops the playing clip when its button is pressed again', async () => {
        const { player, opened } = setup();
        await player.toggle('a');
        await player.toggle('a');
        expect(opened[0].paused).toBe(true);
        expect(player.playing()).toBeNull();
        expect(opened).toHaveLength(1);
    });

    it('returns to rest when the clip ends, and a replaced clip ending changes nothing', async () => {
        const { player, opened } = setup();
        await player.toggle('a');
        await player.toggle('b');
        opened[0].fire('ended');
        expect(player.playing()).toBe('b');
        opened[1].fire('ended');
        expect(player.playing()).toBeNull();
    });

    it('returns to rest when a clip cannot play', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { player } = setup(() => Promise.reject(new Error('NotAllowedError')));
        await player.toggle('a');
        expect(player.playing()).toBeNull();
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it('says how each start ended', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(await setup().player.toggle('a')).toBe('played');
        const blocked = Object.assign(new Error('autoplay'), { name: 'NotAllowedError' });
        expect(await setup(() => Promise.reject(blocked)).player.toggle('a')).toBe('blocked');
        expect(await setup(() => Promise.reject(new Error('network'))).player.toggle('a')).toBe('failed');
        const { player } = setup();
        await player.toggle('a');
        expect(await player.toggle('a')).toBe('stopped');
        warn.mockRestore();
    });

    it('play restarts the clip already playing instead of stopping it', async () => {
        const { player, opened } = setup();
        await player.play('a');
        expect(await player.play('a')).toBe('played');
        expect(opened).toHaveLength(2);
        expect(opened[0].paused).toBe(true);
        expect(player.playing()).toBe('a');
    });

    it('rejects, at rest, when the clip URL cannot be built', async () => {
        const player = createClipPlayer({ urlOf: () => Promise.reject(new Error('no index')), open: url => new FakeClip(url) });
        await expect(player.toggle('a')).rejects.toThrow('no index');
        expect(player.playing()).toBeNull();
    });

    it('does not open a clip stopped while its URL was still on its way', async () => {
        let resolveUrl: (url: string) => void = () => {};
        const opened: FakeClip[] = [];
        const player = createClipPlayer({
            urlOf: () => new Promise(resolve => { resolveUrl = resolve; }),
            open: url => { const clip = new FakeClip(url); opened.push(clip); return clip; },
        });
        const pending = player.toggle('a');
        expect(player.playing()).toBe('a');
        player.stopIf('a');
        resolveUrl('/audio/a.opus');
        await pending;
        expect(opened).toHaveLength(0);
        expect(player.playing()).toBeNull();
    });

    it('stopIf leaves another clip playing', async () => {
        const { player } = setup();
        await player.toggle('a');
        player.stopIf('b');
        expect(player.playing()).toBe('a');
    });

    it('tells subscribers when the playing clip changes', async () => {
        const { player } = setup();
        const listener = vi.fn();
        const unsubscribe = player.subscribe(listener);
        await player.toggle('a');
        await player.toggle('a');
        expect(listener).toHaveBeenCalledTimes(2);
        unsubscribe();
        await player.toggle('a');
        expect(listener).toHaveBeenCalledTimes(2);
    });
});
