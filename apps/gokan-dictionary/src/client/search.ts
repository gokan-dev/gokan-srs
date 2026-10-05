// Progressive-enhancement client script for the site-wide search box (see SiteHeader.svelte).
// Deliberately plain DOM/TS, not a hydrated Svelte island: this search box is the only
// interactive piece on the entire site, so pulling in a second Svelte compile pass (and the
// SSR/hydration markup matching it requires) for one <input> isn't worth it. Built as its own
// Vite entry (see vite.config.ts) and linked from every prerendered page, since the box lives
// in the shared header; pages stay fully static otherwise, and the ~3MB index is fetched
// lazily on first focus rather than at page load.

import type { SearchIndex, SearchIndexEntry } from '@gokan/dataset-schema';
import { searchIndexPath, vocabPath } from '../lib/urls';

const MAX_RESULTS = 12;
const DEBOUNCE_MS = 120;

function debounce<Args extends unknown[]>(fn: (...args: Args) => void, ms: number): (...args: Args) => void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return (...args: Args) => {
        if (timer !== undefined) clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

export function matches(entry: SearchIndexEntry, query: string): boolean {
    const normalized = query.toLowerCase();
    return entry.w.includes(query) || entry.r.includes(query) || entry.m.toLowerCase().includes(normalized);
}

/**
 * Higher is better; 0 means "no match at all".
 *
 * Ranking exists because a bare substring filter over ~36k entries buries the obvious answer:
 * typing the kanji for "book" matched that word itself somewhere below hundreds of compounds
 * containing it, purely by index order. An exact hit on the written form or reading always
 * wins, then prefix hits, then substring hits, with the Japanese fields beating the English
 * gloss (someone typing kana wants that word, not every definition mentioning it). Shorter
 * entries break ties, as a cheap proxy for "more basic word": the compact search index carries
 * no frequency data to sort on.
 */
export function scoreEntry(entry: SearchIndexEntry, rawQuery: string): number {
    const query = rawQuery.trim();
    if (!query) return 0;
    const lower = query.toLowerCase();
    const gloss = entry.m.toLowerCase();

    let score: number;
    if (entry.w === query || entry.r === query) score = 100;
    else if (entry.w.startsWith(query) || entry.r.startsWith(query)) score = 80;
    else if (entry.w.includes(query) || entry.r.includes(query)) score = 60;
    else if (gloss === lower) score = 50;
    // A gloss is a joined list of senses, so an exact sense ("to think") should outrank a word
    // that merely mentions the query somewhere inside a longer definition.
    else if (gloss.split(/[;,]/).some(sense => sense.trim() === lower)) score = 45;
    else if (gloss.startsWith(lower)) score = 30;
    else if (gloss.includes(lower)) score = 20;
    else return 0;

    return score * 1000 - Math.min(entry.w.length + entry.m.length, 999);
}

export function filterEntries(index: SearchIndex, rawQuery: string, maxResults: number): SearchIndexEntry[] {
    if (!rawQuery.trim()) return [];

    const scored: { entry: SearchIndexEntry; score: number }[] = [];
    for (const entry of index) {
        const score = scoreEntry(entry, rawQuery);
        if (score > 0) scored.push({ entry, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults).map(s => s.entry);
}

function buildResult(entry: SearchIndexEntry): HTMLLIElement {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = vocabPath(entry.id);
    a.className = 'search-result';
    a.setAttribute('role', 'option');

    const head = document.createElement('span');
    head.className = 'search-result-head';

    const kanji = document.createElement('span');
    kanji.className = 'jp search-result-kanji';
    kanji.textContent = entry.w;

    const reading = document.createElement('span');
    reading.className = 'jp search-result-reading';
    reading.textContent = entry.r;

    head.append(kanji, reading);

    const gloss = document.createElement('span');
    gloss.className = 'search-result-gloss';
    gloss.textContent = entry.m;

    a.append(head, gloss);
    li.appendChild(a);
    return li;
}

function init(): void {
    const root = document.querySelector<HTMLElement>('[data-search]');
    const input = document.querySelector<HTMLInputElement>('[data-search-input]');
    const panel = document.querySelector<HTMLElement>('[data-search-panel]');
    const status = document.querySelector<HTMLElement>('[data-search-status]');
    const results = document.querySelector<HTMLUListElement>('[data-search-results]');
    if (!root || !input || !panel || !status || !results) return;

    let index: SearchIndex | null = null;
    let indexPromise: Promise<SearchIndex> | null = null;
    let activeIndex = -1;

    function open(): void {
        panel!.hidden = false;
        input!.setAttribute('aria-expanded', 'true');
    }

    function close(): void {
        panel!.hidden = true;
        input!.setAttribute('aria-expanded', 'false');
        activeIndex = -1;
    }

    function links(): HTMLAnchorElement[] {
        return Array.from(results!.querySelectorAll('a'));
    }

    function setActive(next: number): void {
        const all = links();
        if (all.length === 0) return;
        activeIndex = (next + all.length) % all.length;
        all.forEach((a, i) => a.classList.toggle('is-active', i === activeIndex));
        all[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    function loadIndex(): Promise<SearchIndex> {
        if (indexPromise) return indexPromise;
        status!.textContent = 'Loading search index...';
        open();
        indexPromise = fetch(searchIndexPath())
            .then(res => {
                if (!res.ok) throw new Error(`search index request failed: ${res.status}`);
                return res.json() as Promise<SearchIndex>;
            })
            .then(data => {
                index = data;
                status!.textContent = '';
                return data;
            })
            .catch(() => {
                status!.textContent = 'Search is unavailable right now.';
                throw new Error('search index unavailable');
            });
        return indexPromise;
    }

    const runSearch = debounce((rawQuery: string) => {
        activeIndex = -1;
        if (!rawQuery.trim()) {
            results.replaceChildren();
            status.textContent = '';
            close();
            return;
        }
        if (!index) return;

        const matched = filterEntries(index, rawQuery, MAX_RESULTS);
        results.replaceChildren(...matched.map(buildResult));
        status.textContent = matched.length === 0 ? 'No results.' : '';
        open();
    }, DEBOUNCE_MS);

    input.addEventListener('focus', () => {
        if (input.value.trim() || !index) {
            loadIndex().then(() => runSearch(input.value)).catch(() => {});
        }
    });

    input.addEventListener('input', () => {
        if (index) runSearch(input.value);
        else loadIndex().then(() => runSearch(input.value)).catch(() => {});
    });

    input.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            close();
            input.blur();
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (panel.hidden) return;
            event.preventDefault();
            setActive(event.key === 'ArrowDown' ? activeIndex + 1 : activeIndex - 1);
            return;
        }
        if (event.key === 'Enter' && activeIndex >= 0) {
            // Enter with nothing highlighted is left alone: the first result is never implicitly
            // selected, so a stray Enter cannot navigate somewhere the user did not choose.
            const all = links();
            if (all[activeIndex]) {
                event.preventDefault();
                all[activeIndex].click();
            }
        }
    });

    document.addEventListener('click', event => {
        if (!root.contains(event.target as Node)) close();
    });
}

// Guarded so this module can be imported from Node-environment unit tests (see search.test.ts)
// without a DOM present, and so it only self-initializes in an actual browser.
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
