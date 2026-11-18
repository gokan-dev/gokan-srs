// A detail page's tabs and section search, in plain TypeScript (no framework runtime on any page).
// Shared by every detail page: a word's, a kanji's and a grammar point's.
//
// The page's HTML is the full page: every section, in order, with its heading. Below the detail
// width this turns the sections into ARIA tabs, one shown at a time, the URL's hash naming the open
// one (the app's hashes; the first section, Dict, has none); from that width, or with no script,
// the page stays whole. The width is read off the stylesheet (`--detail-query`, from `$bp-detail`),
// never retyped here, and followed with matchMedia, so crossing it switches back and forth.
//
// Before this runs, the head's inline class (`tabbed`) lets the stylesheet show the row and only
// the hash's section, so nothing shifts once it does (styles/_tokens.scss, detail-tabs).
//
// Markup it reads: `[data-detail-tabs]`, a row of `<a href="#id" data-tab="id">`, one per section;
// `[data-detail-panels]`, holding each section by its id; `[data-section-searchable]`, a section
// with a hidden `[data-section-search]` field and count line, its rows the `li` of its lists,
// grouped by `[data-search-group]`.

import { matchesExploreQuery, readExploreQuery } from '@gokan/dataset-schema';
import { DEFAULT_LOCALE, localeOfHtmlLang } from '../lib/locale';
import { sectionSearchMessagesFor } from '../lib/messages/sectionSearch';

const locale = localeOfHtmlLang(document.documentElement.lang);
const words = sectionSearchMessagesFor(locale);
const englishPage = locale === DEFAULT_LOCALE;

// The query the stylesheet shows the tabs under, quoted as a CSS string: read once, followed by the
// tabs and by each section's search (which rows the arrangement draws). No row, no tabs: one page.
const tabRow = document.querySelector<HTMLElement>('[data-detail-tabs]');
const query = tabRow ? getComputedStyle(tabRow).getPropertyValue('--detail-query').trim().replace(/^["']|["']$/g, '') : '';
const media = query ? matchMedia(query) : null;

function initTabs(): void {
    const container = document.querySelector<HTMLElement>('[data-detail-panels]');
    if (!tabRow || !container || !media) return;
    const row = tabRow;
    const tabs = media;
    const entries = Array.from(row.querySelectorAll<HTMLAnchorElement>('a[data-tab]')).flatMap(tab => {
        const panel = tab.dataset.tab ? document.getElementById(tab.dataset.tab) : null;
        return panel ? [{ tab, panel, id: panel.id }] : [];
    });
    if (entries.length === 0) return;
    const first = entries[0].id;
    const ofHash = (): string => {
        const id = decodeURIComponent(location.hash.slice(1));
        return entries.some(entry => entry.id === id) ? id : first;
    };
    let open = ofHash();

    function apply(): void {
        const tabbed = tabs.matches;
        if (tabbed) row.setAttribute('role', 'tablist');
        else row.removeAttribute('role');
        for (const { tab, panel, id } of entries) {
            tab.id = `tab-${id}`;
            if (tabbed) {
                tab.setAttribute('role', 'tab');
                tab.setAttribute('aria-selected', String(id === open));
                tab.setAttribute('aria-controls', id);
                tab.tabIndex = id === open ? 0 : -1;
                panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('aria-labelledby', tab.id);
                panel.hidden = id !== open;
            } else {
                for (const name of ['role', 'aria-selected', 'aria-controls', 'tabindex']) tab.removeAttribute(name);
                for (const name of ['role', 'aria-labelledby']) panel.removeAttribute(name);
                panel.hidden = false;
            }
        }
        // From here on the panels' hidden attributes say what is shown, not the stylesheet's :target.
        container!.dataset.tabsReady = '';
        // Whatever this hid, the player stops a clip whose button went with it (client/player.ts).
        document.dispatchEvent(new Event('detail-tabs-change'));
    }

    function select(id: string, focus: boolean): void {
        open = id;
        apply();
        // The hash names the open section, Dict none; replaced, so Back leaves the page rather than stepping through tabs.
        history.replaceState(history.state, '', id === first ? location.pathname + location.search : `#${id}`);
        if (focus) entries.find(entry => entry.id === id)?.tab.focus();
    }

    for (const { tab, id } of entries) {
        tab.addEventListener('click', event => {
            if (!tabs.matches) return;
            event.preventDefault();
            select(id, false);
        });
    }
    row.addEventListener('keydown', event => {
        if (!tabs.matches) return;
        const at = entries.findIndex(entry => entry.id === open);
        const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: entries.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        select(entries[(to + entries.length) % entries.length].id, true);
    });
    addEventListener('hashchange', () => {
        open = ofHash();
        apply();
    });
    tabs.addEventListener('change', apply);
    apply();
    // Landing on a section's hash in tabs: the browser scrolls that section to the top, past the word
    // and the tab row. The page top instead, as the app's tab landing: the word, the tabs, the section.
    // Chrome scrolls to the fragment again after load (check:layout saw it), so every scroll is undone
    // until the reader's first input, or a second after load. Only on a fresh navigation: a chosen tab
    // writes its hash, so a reload or Back to the page has one too, and keeps the scroll it restores.
    const navigation = performance.getEntriesByType('navigation')[0];
    if (tabs.matches && location.hash && navigation instanceof PerformanceNavigationTiming && navigation.type === 'navigate') {
        // scrollTo(0, 0) at the top fires no scroll event, so it needs no guard.
        const toTop = (): void => { scrollTo(0, 0); };
        const inputs = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
        const stop = (): void => {
            removeEventListener('scroll', toTop);
            for (const name of inputs) removeEventListener(name, stop, true);
        };
        toTop();
        addEventListener('scroll', toTop);
        for (const name of inputs) addEventListener(name, stop, true);
        // A module script runs before load, so load is still to come.
        addEventListener('load', () => { setTimeout(stop, 1000); }, { once: true });
    }
}

/**
 * An element's text without its furigana or a row's note: a sentence's ruby readings are not part
 * of what it says, and a word row's `small` (a synonym's "= Interchangeable") is not what it means.
 */
function textOf(element: Element): string {
    let text = '';
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.parentElement?.closest('rt, small')) text += node.nodeValue ?? '';
    }
    return text;
}

/**
 * A row's English lines and its other lines: a word row's gloss (the span with `lang="en"`) and an
 * English translation are English; its headword, reading and sentence are matched as Japanese, and
 * so is text in the page's own language on a Chinese page (a gloss, a translation), whose script a
 * Japanese query shares.
 */
const ENGLISH = englishPage ? '[lang="en"], .sentence-en' : '[lang="en"]';
const OTHER = englishPage ? '[lang="ja"]' : '[lang="ja"], [lang^="zh"], .sentence-en:not([lang="en"])';

function rowText(row: HTMLElement): { english: string[]; japanese: string[] } {
    return {
        english: Array.from(row.querySelectorAll(ENGLISH)).map(textOf),
        japanese: Array.from(row.querySelectorAll(OTHER)).map(element => {
            // A word row's link holds its gloss too: that is matched on its own line.
            const clone = element.cloneNode(true);
            if (!(clone instanceof Element)) return '';
            for (const inner of clone.querySelectorAll(ENGLISH)) inner.remove();
            return textOf(clone);
        }),
    };
}

function initSectionSearch(section: HTMLElement): void {
    const field = section.querySelector<HTMLElement>('[data-section-search]');
    const input = field?.querySelector('input');
    const count = field?.querySelector<HTMLElement>('[data-section-count]');
    if (!field || !input || !count) return;
    const rows = Array.from(section.querySelectorAll<HTMLElement>('.sentence-list > li, .entry-list > li')).map(row => ({ row, text: rowText(row) }));
    const groups = Array.from(section.querySelectorAll<HTMLElement>('[data-search-group]'));
    const disclosures = Array.from(section.querySelectorAll<HTMLDetailsElement>('details'));
    const wasOpen = new Map(disclosures.map(details => [details, details.open]));

    function apply(): void {
        const query = readExploreQuery(input!.value);
        let shown = 0;
        let total = 0;
        // Decided by the arrangement, not by measuring a row: a row in a tab not open measures 0 too.
        const full = !media?.matches;
        for (const { row, text } of rows) {
            // A tab-only row the full page does not draw (a word's Examples in its Sentences) is neither searched nor counted.
            row.hidden = false;
            if (full && row.matches('.detail-preview')) continue;
            total += 1;
            const match = query === null || matchesExploreQuery(query, text);
            row.hidden = !match;
            if (match) shown += 1;
        }
        for (const group of groups) group.hidden = query !== null && !group.querySelector('li:not([hidden])');
        // While filtered, every row the section ships is a candidate: its disclosures open, their summaries gone.
        for (const details of disclosures) {
            details.open = query === null ? wasOpen.get(details) === true : true;
            const summary = details.querySelector('summary');
            if (summary) summary.hidden = query !== null;
            if (query !== null) details.hidden = !details.querySelector('li:not([hidden])');
            else details.hidden = false;
        }
        count!.textContent = query === null ? '' : words.matches(shown, total, query.text);
    }

    for (const details of disclosures) details.addEventListener('toggle', () => { if (!input.value.trim()) wasOpen.set(details, details.open); });
    input.addEventListener('input', apply);
    // Crossing the detail width changes which rows are drawn: a query typed on the full page then holds in tabs.
    document.addEventListener('detail-tabs-change', apply);
    field.hidden = false;
}

initTabs();
for (const section of document.querySelectorAll<HTMLElement>('[data-section-searchable]')) initSectionSearch(section);
