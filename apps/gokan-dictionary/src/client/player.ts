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

// The markup leaves `aria-pressed` out (bytes on every sentence of a budgeted page): it is set here, as
// the player starts, which is also when the buttons first show.
const showPlaying = () => {
    const playing = player.playing();
    for (const button of buttons()) button.setAttribute('aria-pressed', String(button.dataset.clip === playing));
};
showPlaying();
player.subscribe(showPlaying);

// The button pressed, not only its clip: the same sentence can show in two sections (Dict's Examples
// and Sentences), and the clip ends with the one that started it.
let pressed: HTMLButtonElement | null = null;

document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-clip]') : null;
    const url = button?.dataset.clip;
    if (!url) return;
    pressed = button;
    // The URL is the page's own, so it is always built: `toggle` never rejects here.
    void player.toggle(url);
});

// A clip does not outlive its button: whatever hides it stops it, as leaving the page does. A tab
// chosen (the tab script writes its hash with replaceState, so it says so itself), a hash typed or
// stepped to, a disclosure closed (`toggle` does not bubble, so captured), a section search
// filtering its row out (its own listener, on the field, runs first).
const stopIfHidden = () => {
    const playing = player.playing();
    // A closed disclosure's content keeps its boxes (content-visibility), so it is asked for by name.
    const hidden = pressed === null || pressed.getClientRects().length === 0 || pressed.closest('details:not([open])') !== null;
    if (playing !== null && hidden) player.stopIf(playing);
};
document.addEventListener('detail-tabs-change', stopIfHidden);
window.addEventListener('hashchange', stopIfHidden);
document.addEventListener('toggle', stopIfHidden, true);
document.addEventListener('input', stopIfHidden);
window.addEventListener('pagehide', () => {
    const playing = player.playing();
    if (playing !== null) player.stopIf(playing);
});
