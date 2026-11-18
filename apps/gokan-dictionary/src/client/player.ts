// The clip player, in plain TypeScript (no framework runtime on any page): linked only by the pages
// with a play button (PageDocument `player`), a word's and a grammar point's.
//
// Markup it reads: `button[data-clip]`, the clip's full URL (built at render by `audioUrl`, so the
// script fetches nothing of its own: no index, no clip before a press). One clip plays at a time on
// the page, a press on the playing button stops it: the app's state machine, `createClipPlayer`
// from `@gokan/dataset-schema`, keyed here by the URL itself. The button shows what it does next
// through `aria-pressed` (the stylesheet swaps the speaker for a stop square).

import { createClipPlayer } from '@gokan/dataset-schema';

const player = createClipPlayer({ urlOf: url => Promise.resolve(url), open: url => new Audio(url) });

const buttons = (): HTMLButtonElement[] => Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-clip]'));

player.subscribe(() => {
    const playing = player.playing();
    for (const button of buttons()) button.setAttribute('aria-pressed', String(button.dataset.clip === playing));
});

document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-clip]') : null;
    const url = button?.dataset.clip;
    // The URL is the page's own, so it is always built: `toggle` never rejects here.
    if (url) void player.toggle(url);
});

// A clip does not outlive its button: a tab switch that hides it stops it, as leaving the page does.
window.addEventListener('hashchange', () => {
    const playing = player.playing();
    const button = buttons().find(candidate => candidate.dataset.clip === playing);
    if (playing !== null && (button === undefined || button.getClientRects().length === 0)) player.stopIf(playing);
});
window.addEventListener('pagehide', () => {
    const playing = player.playing();
    if (playing !== null) player.stopIf(playing);
});
