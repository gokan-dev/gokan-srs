// The site's one page-wide script, plain DOM and TypeScript (no framework runtime on any page):
// the search combobox in the header or the home hero, the /search/ results page, and the
// furigana toggle. Linked from every page; everything else on the site is static HTML.
//
// Nothing is downloaded before the search field is first focused. Then the core index loads
// (common words, kanji, grammar); after the first query has run on it the full index follows in
// the background, and the current query re-runs when it arrives. Most lookups of common words
// never need the full file.

import { prepareIndex, search, type SearchResults, type WordHit } from '../lib/searchQuery';
import type { SearchGrammarRow, SearchIndexFile, SearchKanjiRow } from '../lib/types';
import { grammarPath, kanjiPath, searchIndexPaths, searchPath, vocabJlptPath, vocabPath } from '../lib/urls';
import { readingOfRow } from '../lib/searchIndex';

const PANEL_LIMITS = { words: 8, kanji: 3, grammar: 3 };
const RESULTS_PAGE_SIZE = 50;
const DEBOUNCE_MS = 100;
const FURIGANA_KEY = 'gokan-dictionary:furigana-hidden';

// -- Index ----------------------------------------------------------------------

let core: SearchIndexFile | null = null;
let full: SearchIndexFile | null = null;
let corePromise: Promise<void> | null = null;
let fullRequested = false;
let index: ReturnType<typeof prepareIndex> | null = null;
/** Re-run the current query when more of the index arrives. */
const onIndexChange: (() => void)[] = [];

async function fetchIndex(url: string): Promise<SearchIndexFile> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`search index request failed: ${response.status}`);
    return (await response.json()) as SearchIndexFile;
}

function rebuild(): void {
    if (!core) return;
    index = prepareIndex(full ? [core, full] : [core]);
    onIndexChange.forEach(callback => callback());
}

function loadCore(): Promise<void> {
    corePromise ??= fetchIndex(searchIndexPaths().core).then(file => {
        core = file;
        rebuild();
    });
    return corePromise;
}

/** The long tail, once a query has run on the core. */
function loadFullLater(): void {
    if (fullRequested) return;
    fullRequested = true;
    fetchIndex(searchIndexPaths().full)
        .then(file => {
            full = file;
            rebuild();
        })
        .catch(() => {
            // The core still answers; a failed long tail only means rarer words are missing.
        });
}

function run(query: string): SearchResults | null {
    if (!index) return null;
    const results = search(index, query);
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
const chip = (level: number) => el('span', { class: 'chip' }, `N${level}`);

/** A word's gloss line; a conjugated query says what it was read as ("from 食べた"). */
function glossLine(hit: WordHit): HTMLElement {
    return hit.via ? el('span', {}, 'from ', ja(hit.via), ` · ${hit.row[3]}`) : el('span', {}, hit.row[3]);
}

function wordCells(hit: WordHit): Node[] {
    const reading = readingOfRow(hit.row);
    return [ja(hit.row[1]), ...(reading !== hit.row[1] ? [ja(reading)] : [])];
}

/** "No results for 'xyz'.", the kana a romaji query was read as, and where to go instead. */
function noResults(results: SearchResults): HTMLElement {
    const levels = [5, 4, 3, 2, 1].map(level => el('a', { href: vocabJlptPath(level) }, `N${level}`));
    return el('span', {},
        `No results for “${results.query}”. `,
        ...(results.kana ? ['Searched as ', ja(results.kana), '. '] : []),
        'Try kana, kanji or English, or browse the JLPT lists: ', ...levels);
}

function total(results: SearchResults): number {
    return results.words.length + results.kanji.length + results.grammar.length;
}

// -- Combobox -----------------------------------------------------------------------

function initCombobox(form: HTMLFormElement): void {
    const input = form.querySelector<HTMLInputElement>('[data-search-input]');
    const panel = form.querySelector<HTMLElement>('[data-search-panel]');
    const message = form.querySelector<HTMLElement>('[data-search-message]');
    const listbox = form.querySelector<HTMLElement>('[data-search-results]');
    const status = form.querySelector<HTMLElement>('[data-search-status]');
    if (!input || !panel || !message || !listbox || !status) return;

    let active = -1;
    let timer: ReturnType<typeof setTimeout> | undefined;
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
        const all = options();
        active = all.length === 0 || next < 0 ? -1 : (next + all.length) % all.length;
        all.forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
        if (active >= 0) {
            input!.setAttribute('aria-activedescendant', all[active].id);
            all[active].scrollIntoView({ block: 'nearest' });
        } else {
            input!.removeAttribute('aria-activedescendant');
        }
    }

    let optionCount = 0;
    function option(href: string, cells: (Node | string)[], extraClass = ''): HTMLAnchorElement {
        return el('a', { class: `search-option${extraClass}`, role: 'option', id: `search-option-${optionCount++}`, href, tabindex: '-1', 'aria-selected': 'false' }, ...cells);
    }

    function group(label: string, key: string, rows: HTMLAnchorElement[]): HTMLElement[] {
        if (rows.length === 0) return [];
        const id = `search-group-${key}`;
        return [el('div', { role: 'group', 'aria-labelledby': id }, el('p', { class: 'search-group-label', id, role: 'presentation' }, label), ...rows)];
    }

    function render(): void {
        const query = input!.value;
        if (!query.trim()) {
            listbox!.replaceChildren();
            message!.replaceChildren();
            status!.textContent = '';
            close();
            return;
        }
        const results = run(query);
        if (!results) return;

        optionCount = 0;
        const words = results.words.slice(0, PANEL_LIMITS.words).map(hit =>
            option(vocabPath(hit.row[0]), [...wordCells(hit), ...(hit.row[4] ? [chip(hit.row[4])] : []), glossLine(hit)]));
        const kanji = results.kanji.slice(0, PANEL_LIMITS.kanji).map((row: SearchKanjiRow) =>
            option(kanjiPath(row[0]), [ja(row[0]), el('span', {}, 'Kanji'), ...(row[1] ? [chip(row[1])] : [])]));
        const grammar = results.grammar.slice(0, PANEL_LIMITS.grammar).map((row: SearchGrammarRow) =>
            option(grammarPath(row[0]), [ja(row[1]), el('span', {}, row[2]), chip(row[4]), el('span', {}, row[3])]));

        const count = total(results);
        listbox!.replaceChildren(
            ...group('Words', 'words', words),
            ...group('Kanji', 'kanji', kanji),
            ...group('Grammar', 'grammar', grammar),
            ...(count > 0 ? [option(searchPath(query.trim()), [`See all results for “${query.trim()}”`], ' search-option--all')] : []),
        );
        message!.replaceChildren(...(count === 0 ? [noResults(results)] : []));
        status!.textContent = count === 0 ? 'No results' : `${count} result${count === 1 ? '' : 's'}`;
        setActive(-1);
        open();
    }

    onIndexChange.push(() => {
        if (document.activeElement === input || !panel.hidden) render();
    });

    input.addEventListener('focus', () => {
        if (index) {
            if (input.value.trim()) render();
            return;
        }
        message.textContent = 'Loading the dictionary…';
        open();
        loadCore()
            .then(() => {
                message.textContent = '';
                if (!input.value.trim()) close();
            })
            .catch(() => {
                message.textContent = 'Search is unavailable right now.';
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
    const page = Math.max(1, Number(params.get('p')) || 1);
    root.querySelector('[data-search-nojs]')?.remove();

    const input = document.querySelector<HTMLInputElement>('[data-search-input]');
    if (input) input.value = query;
    const title = document.querySelector('[data-search-title]');
    if (title && query) title.textContent = `Results for “${query}”`;
    if (query) document.title = `${query}: ${document.title}`;

    function section(heading: string, ...content: Node[]): HTMLElement {
        return el('section', { class: 'section' }, el('h2', {}, heading), ...content);
    }

    function render(): void {
        if (!query) {
            root.replaceChildren(el('p', { class: 'support' }, 'Type a word, a kanji or a grammar point in the search field.'));
            return;
        }
        const results = run(query);
        if (!results) return;
        if (total(results) === 0) {
            root.replaceChildren(el('p', { class: 'support' }, noResults(results)));
            return;
        }

        const pageCount = Math.ceil(results.words.length / RESULTS_PAGE_SIZE);
        const shown = results.words.slice((page - 1) * RESULTS_PAGE_SIZE, page * RESULTS_PAGE_SIZE);
        const pager = () => el('nav', { class: 'pager', 'aria-label': 'Result pages' },
            ...Array.from({ length: pageCount }, (_, i) =>
                el('a', { href: `${searchPath(query)}&p=${i + 1}`, ...(i + 1 === page ? { 'aria-current': 'page' } : {}) }, String(i + 1))));
        const wordList = el('ul', { class: 'entry-list' }, ...shown.map(hit =>
            el('li', {}, el('a', { href: vocabPath(hit.row[0]) }, ...wordCells(hit), glossLine(hit)))));

        root.replaceChildren(
            ...(results.words.length > 0
                ? [section(`Words (${results.words.length.toLocaleString('en')})`, ...(pageCount > 1 ? [pager()] : []), wordList, ...(pageCount > 1 ? [pager()] : []))]
                : []),
            ...(results.kanji.length > 0
                ? [section('Kanji', el('ul', { class: 'entry-list' }, ...results.kanji.map(row =>
                    el('li', {}, el('a', { href: kanjiPath(row[0]) }, ja(row[0]), el('span', {}, row[1] ? `JLPT N${row[1]}` : 'Outside JLPT'))))))]
                : []),
            ...(results.grammar.length > 0
                ? [section('Grammar', el('ul', { class: 'grammar-list' }, ...results.grammar.map(row =>
                    el('li', {}, el('a', { href: grammarPath(row[0]) }, ja(row[1]), ...(row[2] ? [el('small', {}, row[2])] : []), el('small', {}, `N${row[4]}`), el('span', {}, row[3]))))))]
                : []),
        );
    }

    onIndexChange.push(render);
    root.replaceChildren(el('p', { class: 'support' }, 'Searching…'));
    loadCore().catch(() => root.replaceChildren(el('p', { class: 'support' }, 'Search is unavailable right now.')));
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
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-furigana-toggle]'));

    function apply(): void {
        root.classList.toggle('furigana-hidden', hidden);
        for (const button of buttons) button.textContent = hidden ? 'Show furigana' : 'Hide furigana';
    }

    for (const button of buttons) {
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
