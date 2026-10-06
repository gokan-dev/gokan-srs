// Client entry for the grammar index page's interactive browser.
//
// The page is server-rendered as a plain grouped list, which is what crawlers and no-JS readers
// get. This script fetches the browse rows and mounts the runes-based component over that list,
// replacing it. mount(), not hydrate(): the static markup is a fallback rather than the same
// tree the component would produce, so there is nothing to reconcile and no mismatch to get
// wrong. If the fetch fails the static list simply stays, which is a working page.

import { mount } from 'svelte';
import GrammarBrowser from '../pages/GrammarBrowser.svelte';
import type { BrowseRow } from '../lib/grammarBrowse';
import { grammarBrowseDataPath } from '../lib/urls';

async function init(): Promise<void> {
    const target = document.querySelector<HTMLElement>('[data-grammar-browser]');
    const fallback = document.querySelector<HTMLElement>('[data-grammar-static]');
    if (!target) return;

    let rows: BrowseRow[];
    try {
        const response = await fetch(grammarBrowseDataPath());
        if (!response.ok) throw new Error(`grammar browse data request failed: ${response.status}`);
        rows = (await response.json()) as BrowseRow[];
    } catch {
        return; // Leave the server-rendered list in place.
    }

    mount(GrammarBrowser, { target, props: { rows } });
    if (fallback) fallback.remove();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void init());
} else {
    void init();
}
