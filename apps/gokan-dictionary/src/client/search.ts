// The site's one page-wide script, plain DOM and TypeScript (no framework runtime on any page):
// the search combobox in the header or the home hero, the /search/ results page, and the
// furigana toggle. Both search views list one ranking across words, kanji and grammar points
// (rankedSearch, the order gokan-srs's header search lists), each row the app's two lines: the
// thing itself, then its type chip and its gloss. Linked from every page; everything else on the site is static HTML.
//
// Nothing is downloaded before the search field is first focused. Then the core index loads
// (common words, kanji, grammar) together with the query engine (lib/searchQuery.ts, with the
// romaji table and the conjugation rules: a separate chunk, so a page that is only read pays
// for neither); after the first query has run the full index follows in the background, and the
// current query re-runs when it arrives, unless the reader has already scrolled its list
// (redrawOnIndexChange): then the drawn rows stay, and the next query reads the whole index. Most lookups of common words never need the full file.
//
// In the page's locale, read off its <html lang>: its own index (a locale's words with a page in
// it, their glosses in its language), its links (linkUrls: a word's page in its section) and its
// words (lib/messages/search).

import { datasetLanguageOf, htmlLang, localeOfHtmlLang } from '../lib/locale';
import { linkLang, linkUrls } from '../lib/localeLinks';
import { searchMessagesFor } from '../lib/messages/search';
import { redrawOnIndexChange } from '../lib/searchRedraw';
import type { IndexRankedHit, IndexRankedResults, PreparedIndex } from '../lib/searchQuery';
import { kanjiRowMainReadings, kanjiRowMeanings } from '@gokan/dataset-schema';
import type { SearchGroup } from '@gokan/dataset-schema';
import type { SearchIndexFile } from '../lib/types';
import { searchIndexPaths } from '../lib/urls';

/**
 * Rows drawn at first, and added each time the list's end comes near (an IntersectionObserver on
 * a sentinel after it): every match is in the list, as in gokan-srs's header search, but only what
 * the reader scrolls to is drawn.
 */
const PANEL_PAGE_SIZE = 30;
const RESULTS_PAGE_SIZE = 50;
/** How far before the list's end (px) the next page is drawn, so it is there before it is reached. */
const LOAD_MORE_MARGIN = '400px';
const DEBOUNCE_MS = 100;
const FURIGANA_KEY = 'gokan-dictionary:furigana-hidden';

const locale = localeOfHtmlLang(document.documentElement.lang);
const links = linkUrls(locale);
const words = searchMessagesFor(locale);
/** The glosses' language, for their runs: the page's own, as the index is the locale's. */
const glossLang = htmlLang(locale);

// -- Index ----------------------------------------------------------------------

let core: SearchIndexFile | null = null;
let full: SearchIndexFile | null = null;
let corePromise: Promise<void> | null = null;
let fullRequested = false;
let engine: typeof import('../lib/searchQuery') | null = null;
let index: PreparedIndex | null = null;
/** Re-run the current query when more of the index arrives. */
const onIndexChange: (() => void)[] = [];

async function fetchIndex(url: string): Promise<SearchIndexFile> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`search index request failed: ${response.status}`);
    return (await response.json()) as SearchIndexFile;
}

function rebuild(): void {
    if (!core || !engine) return;
    index = engine.prepareIndex(full ? [core, full] : [core], datasetLanguageOf(locale));
    onIndexChange.forEach(callback => callback());
}

function loadCore(): Promise<void> {
    corePromise ??= Promise.all([fetchIndex(searchIndexPaths(locale).core), import('../lib/searchQuery')]).then(([file, module]) => {
        core = file;
        engine = module;
        rebuild();
    });
    return corePromise;
}

/** The long tail, once a query has run on the core. */
function loadFullLater(): void {
    if (fullRequested) return;
    fullRequested = true;
    fetchIndex(searchIndexPaths(locale).full)
        .then(file => {
            full = file;
            rebuild();
        })
        .catch(() => {
            // The core still answers; a failed long tail only means rarer words are missing.
        });
}

function run(query: string): IndexRankedResults | null {
    if (!index || !engine) return null;
    const results = engine.rankedSearch(index, query);
    if (results.query) loadFullLater();
    return results;
}

// -- Markup -----------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attributes: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    element.append(...children);
    return element;
}

const ja = (text: string) => el('span', { lang: 'ja' }, text);
/** Japanese in Latin letters (a grammar point's romaji): not the page's language, whatever it is. */
const JA_LATN = { lang: 'ja-Latn' };

/** A link's attributes: its href, and hreflang="en" when it leaves the locale's section (a kanji or a grammar point, which have English pages only). */
function linkTo(href: string, attributes: Record<string, string> = {}): Record<string, string> {
    const lang = linkLang(locale, href);
    return { ...attributes, href, ...(lang ? { hreflang: lang } : {}) };
}

/** The small 英文 after a row's type or a count when its links leave the locale's section (as the site header marks them), else nothing. */
function inEnglishMark(href: string | undefined): Node[] {
    return href !== undefined && linkLang(locale, href) ? [el('span', { class: 'lang-mark' }, words.inEnglish)] : [];
}

/** One row of either list: where it leads, line 1 (the thing itself) and line 2's text after its type chip. */
interface SearchRow {
    group: SearchGroup;
    href: string;
    main: Node[];
    support: Node[];
}

/** A hit as a row, the same shape as gokan-srs's: a word and its reading, a kanji and its main readings, a grammar title and its romaji. */
function rowOf(hit: IndexRankedHit): SearchRow {
    switch (hit.group) {
        case 'words': {
            const [id, headword, secondary, gloss] = hit.hit.row;
            return {
                group: 'words',
                href: links.vocabPath(id),
                // A word learned in kana names its kanji spelling where the reading would go.
                main: [ja(headword), ...(secondary !== headword ? [el('span', { class: 'search-row-form', lang: 'ja' }, secondary)] : [])],
                // A conjugated query says what it was read as ("from 食べた").
                support: [el('span', { class: 'search-row-gloss', lang: glossLang }, ...(hit.hit.via ? [words.fromForm.before, ja(hit.hit.via), words.fromForm.after] : []), gloss)],
            };
        }
        case 'kanji': {
            const readings = kanjiRowMainReadings(hit.row);
            return {
                group: 'kanji',
                href: links.kanjiPath(hit.row[0]),
                main: [ja(hit.row[0]), ...(readings.length > 0 ? [el('span', { class: 'search-row-form', lang: 'ja' }, readings.join('、'))] : [])],
                // A kanji's meanings are English in every locale (the dataset's only language for them).
                support: [el('span', { class: 'search-row-gloss', lang: 'en' }, kanjiRowMeanings(hit.row).join(', '))],
            };
        }
        case 'grammar':
            return {
                group: 'grammar',
                href: links.grammarPath(hit.row[0]),
                main: [ja(hit.row[1]), ...(hit.row[2] ? [el('span', { class: 'search-row-form', ...JA_LATN }, hit.row[2])] : [])],
                support: [el('span', { class: 'search-row-gloss', lang: 'en' }, hit.row[3])],
            };
    }
}

/** A row's two lines: the thing itself, then its type chip (and 英文 when it opens an English page) leading its gloss. */
function rowCells(row: SearchRow): HTMLElement[] {
    return [
        el('span', { class: 'search-row-main' }, ...row.main),
        el('span', { class: 'search-row-support' }, el('span', { class: 'chip', 'data-type-chip': '' }, words.types[row.group]), ...inEnglishMark(row.href), ...row.support),
    ];
}

/** "No results for 'xyz'.", the kana a romaji query was read as, and where to go instead. */
function noResults(results: IndexRankedResults): HTMLElement {
    const levels = [5, 4, 3, 2, 1].flatMap(level => [' ', el('a', { href: links.vocabJlptPath(level) }, `N${level}`)]);
    return el('span', {},
        words.noResults(results.query),
        ...(results.kana ? [words.searchedAs.before, ja(results.kana), words.searchedAs.after] : []),
        words.tryInstead, ...levels);
}

/**
 * Draws `hits` into `list` a page at a time: the first page now, the next each time `sentinel`
 * (placed after the list) comes within LOAD_MORE_MARGIN of `root`'s view (null: the page's).
 * Returns `more`, which draws the next page at once (the arrow keys past the last drawn row),
 * `drawn`, how many rows are drawn, and `stop`, which ends the observing when the list is drawn again.
 */
interface PagedList { more: () => boolean; drawn: () => number; stop: () => void }
function pagedList(hits: IndexRankedHit[], pageSize: number, list: HTMLElement, sentinel: HTMLElement, root: HTMLElement | null, item: (hit: IndexRankedHit, index: number) => HTMLElement): PagedList {
    let drawn = 0;
    const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) more();
    }, { root, rootMargin: `0px 0px ${LOAD_MORE_MARGIN} 0px` });
    const more = (): boolean => {
        if (drawn >= hits.length) return false;
        const next = hits.slice(drawn, drawn + pageSize);
        list.append(...next.map((hit, i) => item(hit, drawn + i)));
        drawn += next.length;
        sentinel.hidden = drawn >= hits.length;
        // Observed afresh, so its state is reported again: a sentinel still near the view after
        // the new rows (a short page, or a scroll to the new end before the next frame) never
        // changes state, and the observer alone would not draw the next page.
        observer.unobserve(sentinel);
        observer.observe(sentinel);
        return true;
    };
    list.replaceChildren();
    more();
    return { more, drawn: () => drawn, stop: () => observer.disconnect() };
}

// -- Combobox -----------------------------------------------------------------------

function initCombobox(form: HTMLFormElement): void {
    const input = form.querySelector<HTMLInputElement>('[data-search-input]');
    const panel = form.querySelector<HTMLElement>('[data-search-panel]');
    const message = form.querySelector<HTMLElement>('[data-search-message]');
    const listbox = form.querySelector<HTMLElement>('[data-search-results]');
    const sentinel = form.querySelector<HTMLElement>('[data-search-more]');
    const status = form.querySelector<HTMLElement>('[data-search-status]');
    if (!input || !panel || !message || !listbox || !sentinel || !status) return;

    let active = -1;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let paged: PagedList | null = null;
    const options = () => Array.from(listbox.querySelectorAll<HTMLAnchorElement>('[role="option"]'));

    function open(): void {
        // On a phone the panel is fixed below the field and takes the rest of the screen.
        panel!.style.setProperty('--panel-top', `${input!.getBoundingClientRect().bottom + 8}px`);
        panel!.hidden = false;
        input!.setAttribute('aria-expanded', 'true');
    }

    function close(): void {
        panel!.hidden = true;
        input!.setAttribute('aria-expanded', 'false');
        setActive(-1);
    }

    function setActive(next: number): void {
        let all = options();
        // Past the last drawn row: the next page, when there is one; otherwise round to the top.
        if (next >= all.length && paged?.more()) all = options();
        active = all.length === 0 || next < 0 ? -1 : (next + all.length) % all.length;
        all.forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
        if (active >= 0) {
            input!.setAttribute('aria-activedescendant', all[active].id);
            all[active].scrollIntoView({ block: 'nearest' });
        } else {
            input!.removeAttribute('aria-activedescendant');
        }
    }

    function render(): void {
        const query = input!.value;
        paged?.stop();
        paged = null;
        if (!query.trim()) {
            listbox!.replaceChildren();
            message!.replaceChildren();
            status!.textContent = '';
            sentinel!.hidden = true;
            close();
            return;
        }
        const results = run(query);
        if (!results) return;

        const count = results.hits.length;
        // Every option says its place in the whole list, as only the drawn ones are in it.
        paged = pagedList(results.hits, PANEL_PAGE_SIZE, listbox!, sentinel!, panel, (hit, index) => {
            const row = rowOf(hit);
            return el('a', linkTo(row.href, {
                class: 'search-option search-row', role: 'option', id: `search-option-${index}`, tabindex: '-1', 'aria-selected': 'false',
                'aria-setsize': String(count), 'aria-posinset': String(index + 1),
            }), ...rowCells(row));
        });
        panel!.scrollTop = 0;
        message!.replaceChildren(...(count === 0 ? [noResults(results)] : []));
        status!.textContent = words.status(count);
        active = -1;
        input!.removeAttribute('aria-activedescendant');
        open();
    }

    onIndexChange.push(() => {
        if (document.activeElement !== input && panel.hidden) return;
        if (redrawOnIndexChange({ drawn: paged?.drawn() ?? 0, pageSize: PANEL_PAGE_SIZE, scrolled: panel.scrollTop })) render();
    });

    input.addEventListener('focus', () => {
        if (index) {
            if (input.value.trim()) render();
            return;
        }
        message.textContent = words.loading;
        open();
        loadCore()
            .then(() => {
                message.textContent = '';
                if (!input.value.trim()) close();
            })
            .catch(() => {
                message.textContent = words.unavailable;
            });
    });

    input.addEventListener('input', () => {
        if (timer !== undefined) clearTimeout(timer);
        timer = setTimeout(render, DEBOUNCE_MS);
    });

    input.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            close();
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (panel.hidden) render();
            event.preventDefault();
            setActive(event.key === 'ArrowDown' ? active + 1 : (active <= 0 ? options().length - 1 : active - 1));
            return;
        }
        // Enter on a highlighted row opens it; with none highlighted the form submits to /search/.
        if (event.key === 'Enter' && active >= 0) {
            event.preventDefault();
            window.location.assign(options()[active].href);
        }
    });

    form.addEventListener('focusout', event => {
        if (!(event.relatedTarget instanceof Node) || !form.contains(event.relatedTarget)) close();
    });
}

// -- Results page ---------------------------------------------------------------------

function initResultsPage(root: HTMLElement): void {
    const params = new URLSearchParams(window.location.search);
    const query = (params.get('q') ?? '').trim();
    root.querySelector('[data-search-nojs]')?.remove();

    const input = document.querySelector<HTMLInputElement>('[data-search-input]');
    if (input) input.value = query;
    const title = document.querySelector('[data-search-title]');
    if (title && query) title.textContent = words.resultsFor(query);
    if (query) document.title = `${query}: ${document.title}`;

    let paged: PagedList | null = null;

    /** The line under the title: how many of each type the one list holds, in the order they first appear. */
    function counts(results: IndexRankedResults): HTMLElement {
        const order: SearchGroup[] = [];
        const tally: Record<SearchGroup, { count: number; href: string | undefined }> = { words: { count: 0, href: undefined }, kanji: { count: 0, href: undefined }, grammar: { count: 0, href: undefined } };
        for (const hit of results.hits) {
            if (tally[hit.group].count === 0) {
                order.push(hit.group);
                tally[hit.group].href = rowOf(hit).href;
            }
            tally[hit.group].count += 1;
        }
        return el('p', { class: 'search-counts' }, ...order.map(group => el('span', {}, words.sectionHeading(words.groups[group], tally[group].count), ...inEnglishMark(tally[group].href))));
    }

    function render(): void {
        paged?.stop();
        paged = null;
        if (!query) {
            root.replaceChildren(el('p', { class: 'support' }, words.emptyQuery));
            return;
        }
        const results = run(query);
        if (!results) return;
        if (results.hits.length === 0) {
            root.replaceChildren(el('p', { class: 'support' }, noResults(results)));
            return;
        }
        const list = el('ul', { class: 'search-results' });
        const sentinel = el('div', { class: 'search-more', 'aria-hidden': 'true' });
        root.replaceChildren(counts(results), list, sentinel);
        paged = pagedList(results.hits, RESULTS_PAGE_SIZE, list, sentinel, null, hit => {
            const row = rowOf(hit);
            return el('li', {}, el('a', linkTo(row.href, { class: 'search-row' }), ...rowCells(row)));
        });
    }

    onIndexChange.push(() => {
        if (redrawOnIndexChange({ drawn: paged?.drawn() ?? 0, pageSize: RESULTS_PAGE_SIZE, scrolled: window.scrollY })) render();
    });
    root.replaceChildren(el('p', { class: 'support' }, words.searching));
    loadCore().catch(() => root.replaceChildren(el('p', { class: 'support' }, words.unavailable)));
}

// -- Furigana toggle -------------------------------------------------------------------

function initFuriganaToggle(): void {
    const root = document.documentElement;
    let hidden = false;
    try {
        hidden = localStorage.getItem(FURIGANA_KEY) === '1';
    } catch {
        // Storage blocked (a private window, a policy): furigana stay shown.
    }
    // Each button's two labels in the page's language: the one it is rendered with, and its data-show-label.
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-furigana-toggle]'))
        .map(button => ({ button, hide: button.textContent, show: button.dataset.showLabel ?? button.textContent }));

    function apply(): void {
        root.classList.toggle('furigana-hidden', hidden);
        for (const { button, hide, show } of buttons) button.textContent = hidden ? show : hide;
    }

    for (const { button } of buttons) {
        button.hidden = false;
        button.addEventListener('click', () => {
            hidden = !hidden;
            try {
                localStorage.setItem(FURIGANA_KEY, hidden ? '1' : '0');
            } catch {
                // Not remembered, but still applied to this page.
            }
            apply();
        });
    }
    apply();
}

function init(): void {
    initFuriganaToggle();
    const form = document.querySelector<HTMLFormElement>('[data-search]');
    if (form) initCombobox(form);
    const resultsRoot = document.querySelector<HTMLElement>('[data-search-page]');
    if (resultsRoot) initResultsPage(resultsRoot);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
